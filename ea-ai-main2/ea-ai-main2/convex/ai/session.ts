"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { api } from "../_generated/api";
import { SystemPrompt } from "./system";
import { MessageCaching } from "./caching";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { 
  ConvexMessage, 
  convertConvexToModelMessages, 
  optimizeConversation, 
  sanitizeMessages,
  addMessageToConversation 
} from "./simpleMessages";
import { createSimpleToolRegistry } from "./toolRegistry";

/**
 * Simplified Convex + AI SDK integration
 * 
 * Key changes from complex version:
 * - Direct message conversion (no 4-layer pipeline)
 * - Let AI SDK handle tool execution natively  
 * - Remove manual stream processing complexity
 * - Use Convex patterns instead of fighting them
 * - Simple, direct approach that works reliably
 */
export const chatWithAI = action({
  args: {
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
    sessionId: v.optional(v.id("chatSessions")),
    currentTimeContext: v.optional(v.object({
      currentTime: v.string(),
      userTimezone: v.string(),
      localTime: v.string(),
      timestamp: v.number(),
      source: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { message, useHaiku = true, sessionId, currentTimeContext }) => {
    // Authentication
    const { userId } = await requireUserAuthForAction(ctx);
    console.log(`[SessionSimplified] Starting chat for user: ${userId.substring(0, 20)}...`);

    const modelName = useHaiku ? "anthropic/claude-3-5-haiku" : "anthropic/claude-3-haiku";
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

    try {
      // Load conversation history - simple, direct approach
      let conversation;
      if (sessionId) {
        conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
      } else {
        conversation = await ctx.runQuery(api.conversations.getConversation);
      }
      
      const history = (conversation?.messages as ConvexMessage[]) || [];
      
      // Add user message to conversation
      const updatedHistory = addMessageToConversation(history, {
        role: "user",
        content: message
      });

      // Simple conversation optimization
      const optimizedHistory = optimizeConversation(updatedHistory, 50);
      const cleanHistory = sanitizeMessages(optimizedHistory);
      
      console.log(`[SessionSimplified] Message history: ${history.length} → ${optimizedHistory.length} → ${cleanHistory.length}`);

      // Direct conversion to AI SDK format - no complex pipeline
      const modelMessages = convertConvexToModelMessages(cleanHistory);
      console.log(`[SessionSimplified] Converted to ${modelMessages.length} model messages`);

      // Initialize caching for performance
      MessageCaching.initializeCaching();

      // Generate system prompt
      const systemPrompt = await SystemPrompt.getSystemPrompt(
        ctx, 
        modelName, 
        "", // No special instructions needed 
        message, 
        userId
      );
      
      // Add system message to conversation
      const messagesWithSystem = [
        { role: "system" as const, content: systemPrompt },
        ...modelMessages
      ];

      // Apply caching optimization
      const cachedMessages = MessageCaching.applyCaching(messagesWithSystem, modelName);
      console.log(`[SessionSimplified] Applied caching to ${cachedMessages.length} messages`);

      // Create simplified tool registry - direct Convex action mapping
      const tools = await createSimpleToolRegistry(ctx, userId, currentTimeContext);
      console.log(`[SessionSimplified] Created ${Object.keys(tools).length} tools`);

      // Use AI SDK's streamText with native tool handling
      const result = await streamText({
        model: openrouter.chat(modelName, {
          usage: { include: true }
        }),
        messages: cachedMessages,
        tools,
        maxRetries: 3,
        // maxSteps removed - not available in current AI SDK version
      });

      // Let AI SDK handle the entire streaming and tool execution process
      // This is much simpler than manual stream processing
      console.log('[SessionSimplified] AI SDK processing completed');

      // Get final result from AI SDK - properly await promises
      const finalText = await result.text;
      const finalToolCalls = await result.toolCalls;
      const finalToolResults = await result.toolResults;
      const finalUsage = await result.usage;

      console.log(`[SessionSimplified] Result: text=${!!finalText}, toolCalls=${finalToolCalls.length}, toolResults=${finalToolResults.length}`);

      // Build final conversation history using simple approach
      const finalHistory = [...cleanHistory];

      // Add assistant response
      if (finalToolCalls.length > 0) {
        // Add tool calls message
        finalHistory.push({
          role: "assistant",
          content: finalText || "",
          toolCalls: finalToolCalls.map(tc => ({
            name: tc.toolName,
            args: tc.args,
            toolCallId: tc.toolCallId
          })),
          timestamp: Date.now()
        });

        // Add tool results
        if (finalToolResults.length > 0) {
          finalHistory.push({
            role: "tool",
            toolResults: finalToolResults.map(tr => ({
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)
            })),
            timestamp: Date.now()
          });
        }
      }

      // Add final text response if we have one
      if (finalText && finalText.trim()) {
        finalHistory.push({
          role: "assistant",
          content: finalText,
          timestamp: Date.now()
        });
      }

      // Save conversation - simple, direct approach
      await ctx.runMutation(api.conversations.upsertConversation, { 
        sessionId,
        messages: finalHistory as any 
      });

      // Clean up internal todos if conversation is complete
      try {
        if (sessionId && finalToolResults.length === 0) {
          await ctx.runMutation(api.aiInternalTodos.deactivateInternalTodos, { sessionId });
        }
      } catch (error) {
        console.warn(`[SessionSimplified] Todo cleanup failed:`, error);
      }

      // Return simple response
      return {
        response: finalText || "I've completed the requested actions.",
        fromCache: false,
        metadata: {
          toolCalls: finalToolCalls.length,
          toolResults: finalToolResults.length,
          tokens: finalUsage ? {
            input: finalUsage.promptTokens,
            output: finalUsage.completionTokens,
            total: finalUsage.totalTokens
          } : undefined,
          processingTime: Date.now() - Date.now() // Will be calculated properly
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error('[SessionSimplified] Chat failed:', error);
      
      // Simple error handling - save error message to conversation
      const errorHistory = [...sanitizeMessages(((conversation as any)?.messages as ConvexMessage[]) || [])];
      errorHistory.push({
        role: "user",
        content: message,
        timestamp: Date.now()
      });
      errorHistory.push({
        role: "assistant",
        content: `I encountered an error: ${errorMessage}. Please try again or contact support if this persists.`,
        timestamp: Date.now()
      });

      await ctx.runMutation(api.conversations.upsertConversation, { 
        sessionId,
        messages: errorHistory as any 
      });

      return {
        response: `I encountered an error while processing your request: ${errorMessage}. Please try again.`,
        fromCache: false,
        metadata: {
          error: errorMessage,
          toolCalls: 0,
          toolResults: 0
        }
      };
    }
  }
});

/**
 * Simple session statistics
 */
export const getSessionStats = action({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, { sessionId }) => {
    const { userId } = await requireUserAuthForAction(ctx);
    
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }
    
    const messages = ((conversation as any)?.messages as ConvexMessage[]) || [];
    
    return {
      userId: userId.substring(0, 20) + "...",
      sessionId: sessionId || "default",
      messageCount: messages.length,
      timestamp: Date.now()
    };
  }
});