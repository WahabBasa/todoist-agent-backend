"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { streamText, stepCountIs } from "ai";
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
import { ToolRepetitionDetector } from "./tools/ToolRepetitionDetector";
import { parseAssistantMessage } from "./assistantMessage/parseAssistantMessage";

// OpenTelemetry tracing imports
import {
  initializeTracing
} from "./tracing/tracer";
import {
  createConversationSpan,
  createUserMessageSpan,
  createAssistantMessageSpan
} from "./tracing/spans/messageSpans";
import {
  createPromptSpan,
  createEnhancedPromptTracking,
  updatePromptSpanWithResponse,
  analyzeAndTrackPromptEffectiveness
} from "./tracing/spans/promptSpans";
import {
  createToolCallSpan,
  createToolResultSpan
} from "./tracing/spans/toolCallSpans";
import {
  endSpan
} from "./tracing/utils/spanUtils";
import type {
  EnhancedPromptSpanParams
} from "./tracing/enhanced/spans/enhancedPromptSpans";
import type {
  PromptAnalysisParams
} from "./tracing/enhanced/analysis/promptAnalysis";

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
    

    const modelName = useHaiku ? "anthropic/claude-3-5-haiku" : "anthropic/claude-3-5-haiku";
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    
    // Initialize OpenTelemetry tracing
    initializeTracing();
    
    // Create conversation span
    const conversationSpan = createConversationSpan({
      sessionId: sessionId || "default",
      userId: userId,
    });
    
    // Declare OpenTelemetry spans outside try block
    let userMessageSpan: any = null;
    let promptSpan: any = null;
    let enhancedPromptSpan: any = null;
    let effectivenessSpan: any = null;
    let assistantMessageSpan: any = null;

    try {
      // Load conversation history - simple, direct approach
      let conversation;
      if (sessionId) {
        conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
      } else {
        conversation = await ctx.runQuery(api.conversations.getConversation);
      }
      
      const history = (conversation?.messages as ConvexMessage[]) || [];
      
      // Create user message span
      userMessageSpan = createUserMessageSpan({
        sessionId: sessionId || "default",
        userId: userId,
        message: message
      });

      // Add user message to conversation
      const updatedHistory = addMessageToConversation(history, {
        role: "user",
        content: message
      });

      // Simple conversation optimization
      const optimizedHistory = optimizeConversation(updatedHistory, 50);
      const cleanHistory = sanitizeMessages(optimizedHistory);
      
      

      // Direct conversion to AI SDK format - no complex pipeline
      const modelMessages = convertConvexToModelMessages(cleanHistory);

      // Initialize caching for performance
      MessageCaching.initializeCaching();

      // Generate system prompt using the new modular system
      const systemPrompt = await SystemPrompt.getSystemPromptSync(
        modelName, 
        "", // No special instructions needed 
        message
      );
      
      // Add system message to conversation
      const messagesWithSystem = [
        { role: "system" as const, content: systemPrompt },
        ...modelMessages
      ];

      // Apply caching optimization
      const cachedMessages = MessageCaching.applyCaching(messagesWithSystem, modelName);

      // Create enhanced prompt span for AI generation
      const enhancedPromptParams: EnhancedPromptSpanParams = {
        model: modelName,
        systemPrompt: systemPrompt,
        history: cleanHistory,
        userMessage: message,
        sessionId: sessionId || "default",
        userId: userId,
        parentSpan: conversationSpan
      };
      
      enhancedPromptSpan = createEnhancedPromptTracking(enhancedPromptParams);
      
      // Also create the legacy prompt span for backward compatibility
      promptSpan = createPromptSpan({
        model: modelName,
        prompt: systemPrompt,
        messageCount: cachedMessages.length,
        sessionId: sessionId || "default",
        userId: userId
      });

      // Create simplified tool registry - direct Convex action mapping
      const tools = await createSimpleToolRegistry(ctx, userId, currentTimeContext, sessionId);

      // Initialize tool repetition detector
      const toolRepetitionDetector = new ToolRepetitionDetector(3);

      // Use AI SDK's streamText with native tool handling
      const result = await streamText({
        model: openrouter.chat(modelName, {
          usage: { include: true }
        }),
        messages: cachedMessages,
        tools,
        maxRetries: 3,
        // Allow multi-step tool workflows for complex operations
        stopWhen: stepCountIs(8), // Allow up to 8 steps for complex multi-tool operations
      });
      
      // Create assistant message span for AI generation
      assistantMessageSpan = createAssistantMessageSpan({
        sessionId: sessionId || "default",
        userId: userId,
        message: "AI Generation in progress...",
        model: modelName
      });

      // Let AI SDK handle the entire streaming and tool execution process
      // This is much simpler than manual stream processing

      // Get final result from AI SDK - properly await promises
      const finalText = await result.text;
      const finalToolCalls = await result.toolCalls;
      const finalToolResults = await result.toolResults;
      const finalUsage = await result.usage;
      
      // Update enhanced prompt span with response information
      if (enhancedPromptSpan && finalUsage) {
        updatePromptSpanWithResponse(
          enhancedPromptSpan,
          finalText || "",
          finalToolCalls,
          {
            inputTokens: finalUsage.inputTokens || 0,
            outputTokens: finalUsage.outputTokens || 0,
            totalTokens: finalUsage.totalTokens || 0
          }
        );
      }
      
      // Analyze prompt effectiveness and create tracking span
      if (enhancedPromptSpan) {
        const analysisParams: PromptAnalysisParams = {
          prompt: {
            systemPrompt: systemPrompt,
            history: cleanHistory,
            userMessage: message
          },
          response: finalText || "",
          toolCalls: finalToolCalls,
          tokenUsage: {
            inputTokens: finalUsage.inputTokens || 0,
            outputTokens: finalUsage.outputTokens || 0,
            totalTokens: finalUsage.totalTokens || 0
          }
        };
        
        effectivenessSpan = analyzeAndTrackPromptEffectiveness(analysisParams, enhancedPromptSpan);
      }
      
      // Update assistant message span with final result
      if (assistantMessageSpan && finalUsage) {
        assistantMessageSpan.setAttributes({
          'ai.response.length': finalText?.length || 0,
          'ai.usage.input_tokens': finalUsage.inputTokens,
          'ai.usage.output_tokens': finalUsage.outputTokens,
          'ai.usage.total_tokens': finalUsage.totalTokens,
          'ai.tool_calls.count': finalToolCalls.length,
          'ai.tool_results.count': finalToolResults.length
        });
      }


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
            args: tc.input,
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
              result: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output)
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

      // Update conversation span with final result
      if (conversationSpan && finalUsage) {
        conversationSpan.setAttributes({
          'conversation.final_response': finalText || "I've completed the requested actions.",
          'conversation.tool_calls': finalToolCalls.length,
          'conversation.tool_results': finalToolResults.length,
          'conversation.tokens.input': finalUsage.inputTokens,
          'conversation.tokens.output': finalUsage.outputTokens,
          'conversation.tokens.total': finalUsage.totalTokens
        });
      }
      
      // Create spans for tool calls and results
      for (const toolCall of finalToolCalls) {
        const toolCallSpan = createToolCallSpan({
          toolName: toolCall.toolName,
          input: toolCall.input as Record<string, any>,
          sessionId: sessionId || "default",
          userId: userId
        });
        endSpan(toolCallSpan);
      }
      
      for (const toolResult of finalToolResults) {
        const toolResultSpan = createToolResultSpan({
          toolName: toolResult.toolName || "unknown",
          output: toolResult.output,
          success: true,
          sessionId: sessionId || "default",
          userId: userId
        });
        endSpan(toolResultSpan);
      }

      // End all spans successfully
      if (userMessageSpan) endSpan(userMessageSpan, 'USER MESSAGE');
      if (promptSpan) endSpan(promptSpan, 'AI PROMPT');
      if (enhancedPromptSpan) endSpan(enhancedPromptSpan, 'ENHANCED AI PROMPT');
      if (effectivenessSpan) endSpan(effectivenessSpan, 'PROMPT EFFECTIVENESS');
      if (assistantMessageSpan) endSpan(assistantMessageSpan, 'ASSISTANT MESSAGE');
      endSpan(conversationSpan, 'CONVERSATION');
      
      console.log("[OpenTelemetry] All spans ended successfully");
      
      // Return simple response
      return {
        response: finalText || "I've completed the requested actions.",
        fromCache: false,
        metadata: {
          toolCalls: finalToolCalls.length,
          toolResults: finalToolResults.length,
          tokens: finalUsage ? {
            input: finalUsage.inputTokens,
            output: finalUsage.outputTokens,
            total: finalUsage.totalTokens
          } : undefined,
          processingTime: Date.now() - Date.now() // Will be calculated properly
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error('[SessionSimplified] Chat failed:', error);
      
      // Record error in spans
      const err = error instanceof Error ? error : new Error(errorMessage);
      if (userMessageSpan) endSpan(userMessageSpan, 'USER MESSAGE');
      if (promptSpan) endSpan(promptSpan, 'AI PROMPT', err);
      if (assistantMessageSpan) endSpan(assistantMessageSpan, 'ASSISTANT MESSAGE', err);
      endSpan(conversationSpan, 'CONVERSATION', err);
      
      console.log("[OpenTelemetry] All spans ended with error:", errorMessage);
      
      // Simple error handling - save error message to conversation
      const conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
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

      // OpenTelemetry spans are automatically flushed
      try {
        console.log("[OpenTelemetry] Error traces recorded successfully");
      } catch (telemetryError) {
        console.error("[OpenTelemetry] Error recording traces:", telemetryError);
      }
      
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
  handler: async (ctx, { sessionId }): Promise<{
    userId: string;
    sessionId: string;
    messageCount: number;
    timestamp: number;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }
    
    const messages: ConvexMessage[] = ((conversation as any)?.messages as ConvexMessage[]) || [];
    
    return {
      userId: userId.substring(0, 20) + "...",
      sessionId: sessionId || "default",
      messageCount: messages.length,
      timestamp: Date.now()
    };
  }
});