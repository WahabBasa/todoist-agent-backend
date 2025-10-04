// NOTE: httpAction runs in Convex's default JS runtime (not Node).
// Avoid importing Node-only packages here.

import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "./system";
import { convertConvexToModelMessages, type ConvexMessage } from "./simpleMessages";
import { createModeToolRegistry } from "./toolRegistry";
import { Id } from "../_generated/dataModel";

const LOCK_TTL_MS = 15_000;

function corsHeadersFor(request: Request): Headers {
  const origin = request.headers.get("Origin") || process.env.CLIENT_ORIGIN || "*";
  const h = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Request-Id",
    Vary: "origin",
  });
  if (origin !== "*") h.set("Access-Control-Allow-Credentials", "true");
  return h;
}

// Telemetry toggle and logger (privacy-safe, no message bodies)
const TRACE = (() => {
  const v = process.env.ENABLE_CHAT_TRACE as string | undefined;
  return v === "1" || v === "true";
})();

function tlog(event: string, data: Record<string, any>) {
  if (!TRACE) return;
  try {
    console.log("[CHAT]", { event, ...data });
  } catch {
    // ignore logging errors
  }
}

function sanitizeUserText(s: string): string {
  return (s ?? "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

export const chat = httpAction(async (ctx, request) => {
  let releaseLock: (() => Promise<void>) | null = null;
  let streamStarted = false;

  try {
    const startedAt = Date.now();
    const body = await request.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];
    const sessionIdRaw = body?.sessionId ?? body?.id;
    const sessionId = typeof sessionIdRaw === "string" && sessionIdRaw.length > 0 ? sessionIdRaw : undefined;
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    let latestUserMessage = typeof body?.latestUserMessage === "string" ? body.latestUserMessage : "";
    const historyVersion = typeof body?.historyVersion === "number" ? body.historyVersion : null;

    if (!requestId) {
      tlog("bad_request", { requestId: null, reason: "missing_requestId" });
      return new Response("Missing requestId", { status: 400, headers: corsHeadersFor(request) });
    }

    const usedFallback = !latestUserMessage;
    if (!latestUserMessage) {
      latestUserMessage = extractLastUserContent(rawMessages);
    }

    latestUserMessage = sanitizeUserText(latestUserMessage);
    if (!latestUserMessage) {
      const headers = corsHeadersFor(request);
      headers.set("Content-Type", "application/json");
      tlog("bad_request", { requestId, reason: "latestUserMessage_empty" });
      return new Response(JSON.stringify({ error: "latestUserMessage_empty" }), { status: 400, headers });
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401, headers: corsHeadersFor(request) });
    }
    const userId = identity.tokenIdentifier;

    const [userConfig, globalConfig, session] = await Promise.all([
      ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier: userId }),
      ctx
        .runQuery(api.providers.unified.getGlobalProviderConfig, {})
        .catch(() => null),
      sessionId
        ? ctx.runQuery(api.chatSessions.getChatSession, {
            sessionId: sessionId as Id<"chatSessions">,
          })
        : Promise.resolve(null),
    ]);

    const modelName: string | undefined = globalConfig?.activeModelId || userConfig?.activeModelId;
    if (!modelName) {
      return new Response("No model selected. Please choose a model in the Admin Dashboard.", {
        status: 400,
        headers: corsHeadersFor(request),
      });
    }

    const provider = userConfig?.apiProvider || globalConfig?.apiProvider || "openrouter";
    if (provider !== "openrouter") {
      return new Response(
        "The streaming endpoint currently supports the OpenRouter provider. Switch to OpenRouter in settings.",
        { status: 400, headers: corsHeadersFor(request) }
      );
    }

    const apiKey = userConfig?.openRouterApiKey || globalConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response("Missing OpenRouter API key. Add one in the Admin Dashboard.", {
        status: 400,
        headers: corsHeadersFor(request),
      });
    }

    const baseURL = userConfig?.openRouterBaseUrl || globalConfig?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const openrouter = createOpenRouter({ apiKey, baseURL });

    // Start telemetry once model/provider are known
    tlog("start", {
      requestId,
      sessionId: sessionId ?? null,
      historyVersion,
      usedFallback,
      model: modelName,
      provider,
    });

    const sessionConvexId = sessionId ? (sessionId as Id<"chatSessions">) : undefined;
    let lockAcquired = false;
    let lockReleased = false;

    releaseLock = async () => {
      if (!sessionConvexId || !lockAcquired || lockReleased) {
        return;
      }
      lockReleased = true;
      try {
        await ctx.runMutation(api.sessionLocks.releaseSessionLock, {
          sessionId: sessionConvexId,
          requestId,
        });
      } catch (releaseError) {
        console.error("[STREAM][lock] Failed to release session lock", {
          error: releaseError,
          sessionId,
          requestId,
        });
      }
    };

    if (sessionConvexId) {
      const lockResult = await ctx.runMutation(api.sessionLocks.acquireSessionLock, {
        sessionId: sessionConvexId,
        requestId,
        ttlMs: LOCK_TTL_MS,
      });

      if (lockResult.status === "busy") {
        const headers = corsHeadersFor(request);
        headers.set("Content-Type", "application/json");
        const ttlMs = ("expiresAt" in lockResult && typeof lockResult.expiresAt === "number")
          ? Math.max(0, (lockResult as any).expiresAt - Date.now())
          : undefined;
        tlog("lock_busy", {
          requestId,
          sessionId,
          ownerRequestId: (lockResult as any).ownerRequestId,
          ttlMs,
        });
        return new Response(
          JSON.stringify({
            error: "session_locked",
            ownerRequestId: "ownerRequestId" in lockResult ? lockResult.ownerRequestId : undefined,
            expiresAt: "expiresAt" in lockResult ? lockResult.expiresAt : undefined,
          }),
          { status: 409, headers }
        );
      }

      lockAcquired = true;
    }

    const currentMode = (session?.activeMode as string) || "primary";
    const lastUserText = extractLastUserContent(rawMessages);
    const systemPrompt = await SystemPrompt.getSystemPrompt(
      ctx,
      modelName,
      "",
      lastUserText,
      userId,
      currentMode
    );

    const tools = await createModeToolRegistry(
      ctx as any,
      userId,
      currentMode,
      undefined,
      sessionId ? (sessionId as Id<"chatSessions">) : undefined
    ).catch(() => undefined);

    let canonicalHistory: ConvexMessage[] = [];
    let appendedUser = false;
    let dbCountBefore = 0;
    let historyVersionAfterUser = 0;

    if (sessionConvexId) {
      const appendResult = await ctx.runMutation(api.conversations.appendUserMessage, {
        sessionId: sessionConvexId,
        content: latestUserMessage,
        historyVersion: historyVersion ?? undefined,
      });

      if (appendResult.status === "conflict") {
        if (releaseLock) {
          await releaseLock();
        }
        const headers = corsHeadersFor(request);
        headers.set("Content-Type", "application/json");
        tlog("history_conflict", {
          requestId,
          sessionId,
          providedVersion: historyVersion,
          actualVersion: appendResult.version,
        });
        return new Response(
          JSON.stringify({
            error: "history_conflict",
            version: appendResult.version,
          }),
          { status: 409, headers }
        );
      }

      canonicalHistory = appendResult.messages;
      appendedUser = appendResult.status === "appended";
      dbCountBefore = appendResult.previousVersion;
      historyVersionAfterUser = appendResult.version;
    } else {
      canonicalHistory = [
        {
          role: "user",
          content: latestUserMessage,
          timestamp: Date.now(),
        },
      ];
      appendedUser = true;
      dbCountBefore = 0;
      historyVersionAfterUser = canonicalHistory.length;
    }

    console.log("[STREAM][start]", {
      sessionId: sessionId ?? null,
      requestId,
      historyVersion,
      dbCountBefore,
      appendedUser,
      fallbackUsed: usedFallback,
    });

    const modelMessages = convertConvexToModelMessages(canonicalHistory);

    const result = streamText({
      model: openrouter.chat(modelName, { usage: { include: true } }),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      maxRetries: 2,
      onError: ({ error }) => {
        console.error("[STREAM] Provider error:", error);
        tlog("provider_error", { requestId, sessionId, message: String((error as any)?.message || "") });
        if (releaseLock) {
          void releaseLock();
        }
      },
      onFinish: async (finish) => {
        try {
          const assistantText =
            extractAssistantResponse(finish?.response?.messages) ||
            extractFinishText(finish?.response);

          if (sessionConvexId) {
            const persistResult = await ctx.runMutation(api.conversations.appendAssistantMessage, {
              sessionId: sessionConvexId,
              content: assistantText,
              historyVersion: historyVersionAfterUser,
            });

            if (persistResult.status === "conflict") {
              console.warn("[STREAM][finish] History conflict when appending assistant message", {
                sessionId,
                requestId,
                providedVersion: historyVersionAfterUser,
                version: persistResult.version,
              });
              const durationMs = Date.now() - startedAt;
              tlog("finish", {
                requestId,
                sessionId,
                durationMs,
                dbBefore: persistResult.previousVersion,
                dbAfter: persistResult.version,
                persisted: false,
                conflict: true,
              });
            } else {
              console.log("[STREAM][finish]", {
                sessionId: sessionId ?? null,
                requestId,
                historyVersion,
                dbCountBefore: persistResult.previousVersion,
                dbCountAfter: persistResult.version,
                persisted: persistResult.status === "appended",
              });
              const durationMs = Date.now() - startedAt;
              tlog("finish", {
                requestId,
                sessionId,
                durationMs,
                dbBefore: persistResult.previousVersion,
                dbAfter: persistResult.version,
                persisted: persistResult.status === "appended",
              });
            }
          }
          if (!sessionConvexId) {
            const durationMs = Date.now() - startedAt;
            tlog("finish", { requestId, sessionId: null, durationMs, persisted: false });
          }
        } catch (persistError) {
          console.error("[STREAM][persist] Failed to store conversation:", {
            error: persistError,
            sessionId,
            requestId,
          });
          const durationMs = Date.now() - startedAt;
          tlog("persist_error", { requestId, sessionId, durationMs, message: String((persistError as any)?.message || "") });
        } finally {
          if (releaseLock) {
            await releaseLock();
          }
        }
      },
    });

    streamStarted = true;

    if (lockAcquired && releaseLock) {
      void result.finishReason.finally(() => {
        void releaseLock?.();
      });
    }

    const resp = result.toUIMessageStreamResponse();
    const mergedHeaders = corsHeadersFor(request);
    resp.headers.forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
    return new Response(resp.body, { status: resp.status, headers: mergedHeaders });
  } catch (error) {
    console.error("[STREAM] Unexpected error:", error);
    tlog("unexpected_error", { message: String((error as any)?.message || error || ""), where: "chat_handler" });
    if (releaseLock && !streamStarted) {
      try {
        await releaseLock();
      } catch (releaseError) {
        console.error("[STREAM][lock] Failed to release after error", {
          error: releaseError,
        });
      }
    }
    return new Response("Streaming endpoint error", { status: 500, headers: corsHeadersFor(request) });
  }
});

function extractLastUserContent(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "user") {
      const text = extractText(message);
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function extractText(message: UIMessage): string {
  if (!message) return "";
  const anyMessage = message as any;

  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return extractTextFromParts(message.parts);
  }

  if (Array.isArray(anyMessage.content)) {
    return extractTextFromParts(anyMessage.content);
  }

  if (typeof anyMessage.content === "string") {
    return anyMessage.content.trim();
  }

  return "";
}

function extractAssistantResponse(responseMessages: any): string {
  if (!Array.isArray(responseMessages)) {
    return "";
  }

  for (let i = responseMessages.length - 1; i >= 0; i--) {
    const message = responseMessages[i];
    if (message?.role !== "assistant") {
      continue;
    }

    if (typeof message.content === "string") {
      return message.content.trim();
    }

    const parts = Array.isArray(message.content) ? message.content : message.parts;
    if (Array.isArray(parts)) {
      const text = extractTextFromParts(parts);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function extractFinishText(response: any): string {
  if (!response) {
    return "";
  }

  if (typeof response.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  if (typeof response.outputText === "string" && response.outputText.trim()) {
    return response.outputText.trim();
  }

  if (Array.isArray(response.output) && response.output.length > 0) {
    const aggregated = response.output
      .map((entry: any) => (typeof entry?.content === "string" ? entry.content : ""))
      .join("")
      .trim();
    if (aggregated) {
      return aggregated;
    }
  }

  return "";
}

function extractTextFromParts(parts: any[]): string {
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part: any) => {
      const type = typeof part?.type === "string" ? part.type : "";
      const isTextPart = type === "text" || type === "output_text" || type === "input_text" || type === "assistant_message";
      if (!isTextPart) {
        return "";
      }

      if (typeof part?.text === "string") {
        return part.text;
      }

      if (typeof part?.content === "string") {
        return part.content;
      }

      if (typeof part?.value === "string") {
        return part.value;
      }

      return "";
    })
    .join("")
    .trim();
}