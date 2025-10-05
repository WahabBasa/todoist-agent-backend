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

    let streamedAssistantText = "";
    let pendingSseText = "";
    const textDecoder = new TextDecoder();

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
          if (pendingSseText) {
            const flush = extractTextFromSseBuffer(`${pendingSseText}\n`);
            pendingSseText = flush.remainder;
            if (flush.text) {
              streamedAssistantText += flush.text;
            }
          }

          const assistantTextFromChunks = (streamedAssistantText || "").trim();
          const assistantText =
            assistantTextFromChunks ||
            extractAssistantResponse(finish?.response?.messages) ||
            extractFinishText(finish?.response);
          const { toolCalls: normalizedToolCalls, toolResults: normalizedToolResults } = collectToolPayloads(
            finish
          );

          const finalAssistantText = assistantText.trim().length
            ? assistantText.trim()
            : synthesizeAssistantSummary(normalizedToolResults, currentMode);

          if (normalizedToolCalls.length) {
            logToolCalls(normalizedToolCalls.map((call) => ({ name: call.name, args: call.args })));
          }

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
              content: finalAssistantText,
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
                assistantPreview: finalAssistantText.slice(0, 120),
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
              }
              lastChunkDeltaMs = delta;

              try {
                const textChunk = decodeStreamChunkToText(value, textDecoder);
                if (textChunk) {
                  pendingSseText += textChunk;
                  const consumed = extractTextFromSseBuffer(pendingSseText);
                  pendingSseText = consumed.remainder;
                  if (consumed.text) {
                    streamedAssistantText += consumed.text;
                  }
                }
              } catch (chunkErr) {
                console.warn("[STREAM][chunk:decode_failed]", {
                  error: chunkErr,
                  sessionId,
                  requestId,
                });
              }

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

function synthesizeAssistantSummary(
  toolResults: NormalizedToolResult[],
  mode: string
): string {
  if (!Array.isArray(toolResults) || toolResults.length === 0) {
    return mode === "primary"
      ? "I reviewed your request but didn’t produce any additional summary."
      : "No additional information was generated.";
  }

  const summaries: string[] = [];
  for (const result of toolResults) {
    const normalizedText = normalizeToolResultForSummary(result);
    if (normalizedText) {
      summaries.push(normalizedText);
    }
  }

  if (summaries.length === 0) {
    return `Here is what I found:
${JSON.stringify(toolResults.map((r) => r.result), null, 2)}`;
  }

  if (summaries.length === 1) {
    return summaries[0];
  }

  return summaries.map((summary, idx) => `${idx + 1}. ${summary}`).join("\n");
}

function normalizeToolResultForSummary(result: NormalizedToolResult): string {
  if (!result || typeof result !== "object") return "";
  const toolName = result.toolName ? result.toolName.trim() : "Tool";
  const payload = result.result;

  if (payload == null) {
    return `${toolName} completed without returning additional details.`;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return `${toolName} completed without returning additional details.`;
    }
    if (/^{\s*"?[\w\s-]+"?\s*:/i.test(trimmed) || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return summarizeStructuredPayload(toolName, parsed) ?? `${toolName} result: ${trimmed}`;
      } catch {
        return `${toolName} result: ${trimmed}`;
      }
    }
    return `${toolName}: ${trimmed}`;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return `${toolName} returned no results.`;
    }
    const formatted = payload
      .slice(0, 5)
      .map((entry, idx) => {
        if (typeof entry === "string") {
          return `- ${entry}`;
        }
        if (entry && typeof entry === "object") {
          const text = summarizableFields(entry);
          return text ? `- ${text}` : `- Item ${idx + 1}`;
        }
        return `- ${String(entry)}`;
      })
      .join("\n");
    const suffix = payload.length > 5 ? "\n…" : "";
    return `${toolName} results:\n${formatted}${suffix}`;
  }

  if (typeof payload === "object") {
    const text = summarizeStructuredPayload(toolName, payload);
    if (text) return text;
    try {
      return `${toolName} result: ${JSON.stringify(payload, null, 2)}`;
    } catch {
      return `${toolName} result available.`;
    }
  }

  return `${toolName} result: ${String(payload)}`;
}

function summarizeStructuredPayload(toolName: string, data: any): string | null {
  if (!data || typeof data !== "object") return null;

  if (toolName === "getCurrentTime" && typeof data.localTime === "string") {
    const tz = typeof data.userTimezone === "string" ? data.userTimezone : "local time";
    return `It is currently ${data.localTime} in ${tz}.`;
  }

  if (Array.isArray((data as any).events) && (data as any).events.length > 0) {
    const events = (data as any).events.slice(0, 5).map((event: any, idx: number) => {
      const title = typeof event?.title === "string" && event.title.trim() ? event.title.trim() : `Event ${idx + 1}`;
      const start = typeof event?.start === "string" ? event.start : event?.startTime;
      const when = start ? formatDateLike(start) : "unscheduled time";
      return `• ${title} — ${when}`;
    });
    const suffix = (data as any).events.length > 5 ? "\n…" : "";
    return `${toolName} summary:\n${events.join("\n")}${suffix}`;
  }

  const display = summarizableFields(data);
  return display ? `${toolName}: ${display}` : null;
}

function summarizableFields(value: Record<string, any>): string {
  const fields = ["title", "summary", "content", "due", "localTime", "currentTime"];
  for (const key of fields) {
    if (typeof value?.[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }

  if (typeof value?.start === "string") {
    return formatDateLike(value.start);
  }

  if (typeof value?.startTime === "string") {
    return formatDateLike(value.startTime);
  }

  if (typeof value?.description === "string" && value.description.trim()) {
    return value.description.trim();
  }

  return "";
}

function formatDateLike(raw: string): string {
  try {
    const date = new Date(raw);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  } catch {}
  return raw;
}

function decodeStreamChunkToText(chunk: Uint8Array, decoder: TextDecoder): string {
  if (!(chunk instanceof Uint8Array)) {
    return "";
  }
  return decoder.decode(chunk, { stream: true });
}

function extractTextFromSseBuffer(buffer: string): { text: string; remainder: string } {
  if (!buffer) return { text: "", remainder: "" };
  let accumulated = "";

  const endsWithNewline = /\r?\n$/.test(buffer);
  const lines = buffer.split(/\r?\n/);
  let remainder = "";

  if (!endsWithNewline) {
    remainder = lines.pop() ?? "";
  }

  for (const line of lines) {
    if (!line || !line.startsWith("data:")) continue;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") continue;
    try {
      const payload = JSON.parse(dataStr);
      const text = extractTextFromSsePayload(payload);
      if (text) accumulated += text;
    } catch {
      // ignore malformed lines; they will be retried when remainder completes
    }
  }

  return { text: accumulated, remainder };
}

function extractTextFromSsePayload(payload: any): string {
  if (!payload || typeof payload !== "object") return "";

  if (typeof payload.text === "string") {
    return payload.text;
  }

  if (payload.type === "response.delta" && payload.delta?.type === "text-delta" && typeof payload.delta.text === "string") {
    return payload.delta.text;
  }

  if (payload.type === "message.delta" && typeof payload.delta?.text === "string") {
    return payload.delta.text;
  }

  if (Array.isArray(payload.data)) {
    return payload.data
      .map((entry: any) => extractTextFromSsePayload(entry))
      .filter(Boolean)
      .join("");
  }

  if (typeof payload.delta?.value === "string") {
    return payload.delta.value;
  }

  if (typeof payload.delta?.text === "string") {
    return payload.delta.text;
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