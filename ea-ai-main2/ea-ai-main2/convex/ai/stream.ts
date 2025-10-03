// NOTE: httpAction runs in Convex's default JS runtime (not Node).
// Avoid importing Node-only packages here.

import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "./system";
import { optimizeConversation, type ConvexMessage } from "./simpleMessages";
import { createModeToolRegistry } from "./toolRegistry";
import { createEmbeddedMessage } from "./messageSchemas";
import { Id } from "../_generated/dataModel";

export const chat = httpAction(async (ctx, request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];
    const sessionIdRaw = body?.sessionId ?? body?.id;
    const sessionId = typeof sessionIdRaw === "string" && sessionIdRaw.length > 0 ? sessionIdRaw : undefined;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401 });
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
      return new Response("No model selected. Please choose a model in the Admin Dashboard.", { status: 400 });
    }

    const provider = userConfig?.apiProvider || globalConfig?.apiProvider || "openrouter";
    if (provider !== "openrouter") {
      return new Response(
        "The streaming endpoint currently supports the OpenRouter provider. Switch to OpenRouter in settings.",
        { status: 400 }
      );
    }

    const apiKey = userConfig?.openRouterApiKey || globalConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response("Missing OpenRouter API key. Add one in the Admin Dashboard.", { status: 400 });
    }

    const baseURL = userConfig?.openRouterBaseUrl || globalConfig?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const openrouter = createOpenRouter({ apiKey, baseURL });

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

    const snapshot = uiMessagesToConvex(rawMessages);
    const modelMessages = convertToModelMessages(rawMessages);

    const result = streamText({
      model: openrouter.chat(modelName, { usage: { include: true } }),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      maxRetries: 2,
      onError: ({ error }) => {
        console.error("[STREAM] Provider error:", error);
      },
      onFinish: async (finish) => {
        try {
          let history: ConvexMessage[] = [...snapshot];
          const assistantText = extractAssistantResponse(finish?.response?.messages);

          if (assistantText) {
            history = [
              ...history,
              createEmbeddedMessage(
                {
                  role: "assistant",
                  content: assistantText,
                  timestamp: Date.now(),
                },
                { mode: currentMode }
              ),
            ];
          }

          const compacted = optimizeConversation(history, 50);
          await ctx.runMutation(api.conversations.upsertConversation, {
            sessionId: sessionId ? (sessionId as Id<"chatSessions">) : undefined,
            messages: compacted as any[],
          });
        } catch (persistError) {
          console.error("[STREAM][persist] Failed to store conversation:", persistError);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[STREAM] Unexpected error:", error);
    return new Response("Streaming endpoint error", { status: 500 });
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
    return message.parts
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part?.text || "")
      .join("")
      .trim();
  }

  if (typeof anyMessage.content === "string") {
    return anyMessage.content.trim();
  }

  return "";
}

function uiMessagesToConvex(messages: UIMessage[]): ConvexMessage[] {
  const results: ConvexMessage[] = [];
  const baseTime = Date.now() - messages.length;
  let offset = 0;

  for (const message of messages) {
    const content = extractText(message);
    if (!content) {
      continue;
    }

    const anyMessage = message as any;
    const timestamp = typeof anyMessage.timestamp === "number"
      ? anyMessage.timestamp
      : typeof anyMessage.createdAt === "number"
        ? anyMessage.createdAt
        : baseTime + offset++;

    const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";

    const metadata = typeof anyMessage.metadata === "object" && anyMessage.metadata !== null ? anyMessage.metadata : undefined;
    const mode = typeof anyMessage.mode === "string"
      ? anyMessage.mode
      : metadata && typeof metadata.mode === "string"
        ? metadata.mode
        : undefined;

    const convexMessage: ConvexMessage = {
      role,
      content,
      timestamp,
    };

    if (mode) {
      convexMessage.mode = mode;
    }

    if (metadata) {
      convexMessage.metadata = metadata;
    }

    results.push(convexMessage);
  }

  return results;
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
      const text = parts
        .filter((part: any) => part?.type === "text")
        .map((part: any) => part?.text || "")
        .join("")
        .trim();
      if (text) {
        return text;
      }
    }
  }

  return "";
}
