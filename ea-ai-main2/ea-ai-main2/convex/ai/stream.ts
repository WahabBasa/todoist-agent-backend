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
import { logToolCalls } from "./logger";

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
  let streamChunkCount = 0;
  let streamBytes = 0;
  let firstChunkDeltaMs: number | null = null;
  let lastChunkDeltaMs: number | null = null;

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

    // OpenCode-style: start an assistant turn placeholder so we never end with a noop
    if (sessionConvexId) {
      try {
        await ctx.runMutation(api.conversations.beginAssistantTurn, {
          sessionId: sessionConvexId,
          requestId,
          historyVersion: historyVersionAfterUser,
          metadata: { mode: currentMode, toolStates: {}, requestId },
        });
      } catch (e) {
        console.warn("[STREAM][beginAssistantTurn] failed", { sessionId, requestId, error: String((e as any)?.message || e) });
      }
    }

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
          const { toolCalls: normalizedToolCalls, toolResults: normalizedToolResults } = collectToolPayloads(
            finish
          );

          if (normalizedToolCalls.length) {
            logToolCalls(normalizedToolCalls.map((call) => ({ name: call.name, args: call.args })));
          }

          console.log("[STREAM][persist_attempt]", {
            sessionId: sessionId ?? null,
            requestId,
            historyVersion,
            assistantLength: assistantText.length,
            chunkCount: streamChunkCount,
            streamBytes,
            toolCallCount: normalizedToolCalls.length,
            toolResultCount: normalizedToolResults.length,
          });

          if (sessionConvexId) {
            // Update tool states and payloads first
            try {
              const toolStates: Record<string, "running" | "completed"> = {};
              for (const c of normalizedToolCalls) toolStates[c.toolCallId] = "running";
              for (const r of normalizedToolResults) toolStates[r.toolCallId] = "completed";

              await ctx.runMutation(api.conversations.updateAssistantTurn, {
                sessionId: sessionConvexId,
                requestId,
                patch: {
                  toolCalls: normalizedToolCalls.length ? normalizedToolCalls : undefined,
                  toolResults: normalizedToolResults.length ? normalizedToolResults : undefined,
                  metadata: Object.keys(toolStates).length ? { toolStates, requestId, mode: currentMode } : { requestId, mode: currentMode },
                },
              });
            } catch (updateErr) {
              console.warn("[STREAM][updateAssistantTurn] failed", { sessionId, requestId, error: String((updateErr as any)?.message || updateErr) });
            }

            const persistResult = await ctx.runMutation(api.conversations.finishAssistantTurn, {
              sessionId: sessionConvexId,
              requestId,
              content: assistantText,
              metadata: { mode: currentMode, requestId },
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
                status: persistResult.status,
                chunkCount: streamChunkCount,
                streamBytes,
                firstChunkMs: firstChunkDeltaMs,
                lastChunkMs: lastChunkDeltaMs,
                toolCallCount: normalizedToolCalls.length,
                toolResultCount: normalizedToolResults.length,
              });
              const durationMs = Date.now() - startedAt;
              tlog("finish", {
                requestId,
                sessionId,
                durationMs,
                dbBefore: persistResult.previousVersion,
                dbAfter: persistResult.version,
                persisted: persistResult.status === "appended",
                chunkCount: streamChunkCount,
                streamBytes,
                toolCallCount: normalizedToolCalls.length,
                toolResultCount: normalizedToolResults.length,
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

    const baseResponse = result.toUIMessageStreamResponse();
    const mergedHeaders = corsHeadersFor(request);
    baseResponse.headers.forEach((value, key) => {
      mergedHeaders.set(key, value);
    });

    const originalBody = baseResponse.body;
    if (!originalBody) {
      return new Response(null, { status: baseResponse.status, headers: mergedHeaders });
    }

    const reader = originalBody.getReader();
    const instrumentedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const pump = (): void => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                try {
                  reader.releaseLock?.();
                } catch {}
                controller.close();
                return;
              }

              if (!value) {
                pump();
                return;
              }

              streamChunkCount += 1;
              streamBytes += value.byteLength ?? value.length ?? 0;
              const delta = Date.now() - startedAt;
              if (streamChunkCount === 1) {
                firstChunkDeltaMs = delta;
                console.log("[STREAM][chunk:first]", {
                  sessionId: sessionId ?? null,
                  requestId,
                  msSinceStart: delta,
                  bytes: streamBytes,
                });
              }
              lastChunkDeltaMs = delta;

              controller.enqueue(value);
              pump();
            })
            .catch((err) => {
              console.error("[STREAM][chunk:error]", { err, sessionId, requestId });
              try {
                controller.error(err);
              } catch {}
            });
        };
        pump();
      },
    });

    return new Response(instrumentedStream, { status: baseResponse.status, headers: mergedHeaders });
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

type NormalizedToolCall = {
  name: string;
  args: any;
  toolCallId: string;
};

type NormalizedToolResult = {
  toolCallId: string;
  toolName: string;
  result: any;
};

function collectToolPayloads(finish: any): {
  toolCalls: NormalizedToolCall[];
  toolResults: NormalizedToolResult[];
} {
  if (!finish) {
    return { toolCalls: [], toolResults: [] };
  }

  const steps = Array.isArray(finish.steps) ? finish.steps : [];
  const responseMessages = Array.isArray(finish.response?.messages) ? finish.response.messages : [];

  const rawToolCalls = [
    ...(Array.isArray(finish.toolCalls) ? finish.toolCalls : []),
    ...(Array.isArray(finish.response?.toolCalls) ? finish.response.toolCalls : []),
    ...steps.flatMap((step: any) => (Array.isArray(step?.toolCalls) ? step.toolCalls : [])),
    ...responseMessages.flatMap(extractToolCallsFromMessage),
  ];

  const rawToolResults = [
    ...(Array.isArray(finish.toolResults) ? finish.toolResults : []),
    ...(Array.isArray(finish.response?.toolResults) ? finish.response.toolResults : []),
    ...steps.flatMap((step: any) => (Array.isArray(step?.toolResults) ? step.toolResults : [])),
    ...responseMessages.flatMap(extractToolResultsFromMessage),
  ];

  const normalizedCalls = dedupeToolCalls(
    rawToolCalls
      .map((call) => normalizeToolCall(call))
      .filter((call): call is NormalizedToolCall => !!call)
  );

  const normalizedResults = dedupeToolResults(
    rawToolResults
      .map((result) => normalizeToolResult(result))
      .filter((result): result is NormalizedToolResult => !!result)
  );

  return {
    toolCalls: normalizedCalls,
    toolResults: normalizedResults,
  };
}

function normalizeToolCall(call: any): NormalizedToolCall | null {
  if (!call) return null;

  const toolCallId = pickString(call?.toolCallId, call?.id, call?.callId);
  const name = pickString(call?.toolName, call?.name, call?.function, call?.tool);

  if (!toolCallId || !name) {
    return null;
  }

  const args =
    call?.args !== undefined
      ? call.args
      : call?.input !== undefined
        ? call.input
        : call?.parameters !== undefined
          ? call.parameters
          : call?.arguments !== undefined
            ? call.arguments
            : {};

  return {
    name,
    toolCallId,
    args,
  };
}

function normalizeToolResult(result: any): NormalizedToolResult | null {
  if (!result) return null;

  const toolCallId = pickString(result?.toolCallId, result?.callId, result?.id);
  const toolName = pickString(result?.toolName, result?.name, result?.tool);

  if (!toolCallId || !toolName) {
    return null;
  }

  const payload =
    result?.result !== undefined
      ? result.result
      : result?.output !== undefined
        ? result.output
        : result?.data !== undefined
          ? result.data
          : result?.value !== undefined
            ? result.value
            : result?.toolResult !== undefined
              ? result.toolResult
              : result?.content !== undefined
                ? result.content
                : result?.response !== undefined
                  ? result.response
                  : null;

  return {
    toolCallId,
    toolName,
    result: payload,
  };
}

function dedupeToolCalls(calls: NormalizedToolCall[]): NormalizedToolCall[] {
  const map = new Map<string, NormalizedToolCall>();

  for (const call of calls) {
    const existing = map.get(call.toolCallId);
    if (!existing) {
      map.set(call.toolCallId, {
        name: call.name,
        toolCallId: call.toolCallId,
        args: call.args === undefined ? {} : call.args,
      });
      continue;
    }

    const mergedName = existing.name || call.name;
    const shouldReplaceArgs = !hasMeaningfulValue(existing.args) && hasMeaningfulValue(call.args);
    map.set(call.toolCallId, {
      name: mergedName,
      toolCallId: call.toolCallId,
      args: shouldReplaceArgs ? call.args : existing.args,
    });
  }

  return Array.from(map.values()).map((call) => ({
    name: call.name,
    toolCallId: call.toolCallId,
    args: call.args === undefined ? {} : call.args,
  }));
}

function dedupeToolResults(results: NormalizedToolResult[]): NormalizedToolResult[] {
  const map = new Map<string, NormalizedToolResult>();

  for (const result of results) {
    const existing = map.get(result.toolCallId);
    if (!existing) {
      map.set(result.toolCallId, result);
      continue;
    }

    const mergedName = existing.toolName || result.toolName;
    const mergedResult = result.result !== undefined ? result.result : existing.result;
    map.set(result.toolCallId, {
      toolCallId: result.toolCallId,
      toolName: mergedName,
      result: mergedResult,
    });
  }

  return Array.from(map.values());
}

function extractToolCallsFromMessage(message: any): any[] {
  if (!message) return [];

  const collected: any[] = [];
  if (Array.isArray(message?.toolCalls)) {
    collected.push(...message.toolCalls);
  }
  if (Array.isArray(message?.toolInvocations)) {
    collected.push(...message.toolInvocations);
  }

  const parts = getMessageParts(message);
  for (const part of parts) {
    if (!part) continue;
    if (part.type === "tool-call" || part.type === "tool_call") {
      collected.push(part);
    } else if (Array.isArray(part?.toolInvocations)) {
      collected.push(...part.toolInvocations);
    } else if (part.type === "toolInvocations" && Array.isArray(part?.value)) {
      collected.push(...part.value);
    }
  }

  if (message?.type === "tool-call" || message?.type === "tool_call") {
    collected.push(message);
  }

  return collected;
}

function extractToolResultsFromMessage(message: any): any[] {
  if (!message) return [];

  const collected: any[] = [];
  if (Array.isArray(message?.toolResults)) {
    collected.push(...message.toolResults);
  }

  const parts = getMessageParts(message);
  for (const part of parts) {
    if (!part) continue;
    if (part.type === "tool-result" || part.type === "tool_result") {
      collected.push(part);
    } else if (Array.isArray(part?.toolResults)) {
      collected.push(...part.toolResults);
    }
  }

  if (message?.type === "tool-result" || message?.type === "tool_result") {
    collected.push(message);
  }

  return collected;
}

function getMessageParts(message: any): any[] {
  if (Array.isArray(message?.content)) {
    return message.content;
  }
  if (Array.isArray(message?.parts)) {
    return message.parts;
  }
  if (Array.isArray(message?.toolInvocations)) {
    return message.toolInvocations;
  }
  return [];
}

function hasMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function isPlainObject(value: any): value is Record<string, any> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function pickString(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
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