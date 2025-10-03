"use node";

import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { streamText, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createVertex } from "@ai-sdk/google-vertex";
import { SystemPrompt } from "./system";
import {
  optimizeConversation,
  sanitizeMessages,
  convertConvexToModelMessages,
  type ConvexMessage,
} from "./simpleMessages";
import { createModeToolRegistry } from "./toolRegistry";
import { Id } from "../_generated/dataModel";

export const chat = httpAction(async (ctx, request) => {
  try {
    const { messages, id: sessionId } = await request.json();

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = identity.tokenIdentifier;

    // Load existing conversation history
    const conversation = sessionId
      ? await ctx.runQuery(api.conversations.getConversationBySession, { sessionId: sessionId as Id<"chatSessions"> })
      : await ctx.runQuery(api.conversations.getConversation);

    const history: ConvexMessage[] = (conversation?.messages as any[]) || [];

    // Prepare minimal provider/model selection (global-first, then user)
    const userConfig = await ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier: userId });
    let globalConfig: any = null;
    try {
      globalConfig = await ctx.runQuery(api.providers.unified.getGlobalProviderConfig, {});
    } catch {}

    const modelName: string | undefined = globalConfig?.activeModelId || userConfig?.activeModelId;
    if (!modelName) {
      return new Response("No model selected. Please select a model in the Admin Dashboard.", { status: 500 });
    }

    const provider = userConfig?.apiProvider || "openrouter";

    // Initialize provider client (typed as any to support .chat like in session.ts)
    let providerClient: any;
    if (provider === "google") {
      const googleProjectId = userConfig?.googleProjectId || "not-provided";
      const googleRegion = userConfig?.googleRegion || "us-central1";
      const vertex: any = createVertex({ project: googleProjectId, location: googleRegion });
      providerClient = vertex;
    } else {
      const apiKey = userConfig?.openRouterApiKey || globalConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return new Response("OpenRouter API key is required. Configure it in the Admin Dashboard.", { status: 500 });
      }
      const baseURL = userConfig?.openRouterBaseUrl || globalConfig?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
      const openrouter: any = createOpenRouter({ apiKey, baseURL });
      providerClient = openrouter;
    }

    // Mode/tools (database-first; default primary)
    const session = sessionId ? await ctx.runQuery(api.chatSessions.getChatSession, { sessionId: sessionId as Id<"chatSessions"> }) : null;
    const currentMode = (session?.activeMode as string) || "primary";
    const tools = await createModeToolRegistry(ctx as any, userId, currentMode, undefined, sessionId as Id<"chatSessions"> | undefined);

    // Build system prompt
    const lastUserText = Array.isArray(messages) && messages.length > 0 ? (messages[messages.length - 1]?.content || messages[messages.length - 1]?.parts?.[0]?.text || "") : "";
    let systemPrompt = await SystemPrompt.getSystemPrompt(
      ctx,
      modelName,
      "",
      typeof lastUserText === "string" ? lastUserText : "",
      userId,
      currentMode
    );

    // Construct model messages by combining DB history with incoming UI messages
    const cleanHistory = sanitizeMessages(optimizeConversation(history, 50));
    const modelHistory = convertConvexToModelMessages(cleanHistory);
    const modelFromUi = convertToModelMessages(messages || []);
    const modelMessages = [...modelHistory, ...modelFromUi];

    const result = streamText({
      model: providerClient.chat(modelName, { usage: { include: true } }),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      maxRetries: 3,
      onFinish: async (finish: any) => {
        try {
          const finalHistory: ConvexMessage[] = [...cleanHistory];
          // Extract final assistant text from response messages
          const msgs = finish?.response?.messages || [];
          const lastAssistant = [...msgs].reverse().find((m: any) => m?.role === 'assistant');
          let assistantText = '';
          if (lastAssistant) {
            const parts = Array.isArray(lastAssistant.content) ? lastAssistant.content : lastAssistant.parts;
            if (Array.isArray(parts)) {
              assistantText = parts
                .filter((p: any) => p?.type === 'text')
                .map((p: any) => p?.text || '')
                .join('');
            } else if (typeof lastAssistant.content === 'string') {
              assistantText = lastAssistant.content;
            }
          }

          const { createEmbeddedMessage } = await import("./messageSchemas");
          const assistantMessage: any = createEmbeddedMessage({
            role: "assistant",
            content: (assistantText || "").toString(),
            timestamp: Date.now(),
          }, { mode: currentMode });

          if (assistantMessage.content && assistantMessage.content.trim().length > 0) {
            finalHistory.push(assistantMessage);
          }

          const compacted = optimizeConversation(finalHistory, 50);
          await ctx.runMutation(api.conversations.upsertConversation, {
            sessionId: sessionId as Id<"chatSessions">,
            messages: compacted as any[],
          });
        } catch (err) {
          console.error("[STREAM][onFinish] Failed to persist conversation:", err);
        }
      },
    });

    return result.toUIMessageStreamResponse({ originalMessages: messages });
    console.error("[STREAM] Error:", e);
    return new Response("Streaming endpoint error", { status: 500 });
  }
});
