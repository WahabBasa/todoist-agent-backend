"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { streamText, ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { api } from "../_generated/api";
import { SystemPrompt } from "./system";
import { MessageCaching } from "./caching";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { ToolRegistryManager } from "./toolRegistry";
import { createProcessor, ProcessorContext } from "./processor";
import { MessageV2 } from "./messageV2";

// OpenCode-inspired session orchestrator using streamText
// This replaces the manual iteration loop with proper streaming integration

/**
 * Main chat action using streamText instead of manual orchestration
 * Follows OpenCode session patterns with processor-based tool execution
 */
export const chatWithAIV2 = action({
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
    // Authentication using big-brain pattern
    const { userId } = await requireUserAuthForAction(ctx);
    console.log(`[SessionV2] Authenticated user: ${userId.substring(0, 20)}...`);

    const modelName = useHaiku ? "anthropic/claude-3-5-haiku" : "anthropic/claude-3-haiku";
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

    // Load conversation history (session-aware)
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }
    
    const history = (conversation?.messages as MessageV2.ConvexMessage[]) || [];
    history.push({ role: "user", content: message, timestamp: Date.now() });

    console.log(`[SessionV2] Starting streamText interaction for: "${message}"`);

    // Initialize OpenCode-style caching system
    MessageCaching.initializeCaching();

    
    // Intelligent context optimization (OpenCode pattern)
    const maxContextMessages = parseInt(process.env.MAX_CONTEXT_MESSAGES || "50");
    let optimizedHistory = MessageV2.optimizeContext(history, maxContextMessages);
    optimizedHistory = MessageV2.sanitizeMessages(optimizedHistory);
    
    console.log(`[SessionV2] Context optimization: ${history.length} → ${optimizedHistory.length} messages`);

    // Convert to ModelMessages using MessageV2 architecture
    let modelMessages: ModelMessage[];
    try {
      modelMessages = MessageV2.convertMessages(optimizedHistory);
      console.log(`[SessionV2] Message conversion successful: ${modelMessages.length} model messages`);
    } catch (error) {
      console.warn('[SessionV2] Message conversion failed, using error handler');
      modelMessages = MessageV2.ErrorHandler.handleConversionError(error as Error, optimizedHistory);
    }

    // Note: Caching will be applied after system prompt is added to messages

    // Detect enhanced internal todo prompt usage
    let dynamicInstructions = "";
    const shouldUseEnhanced = SystemPrompt.shouldUseEnhancedTodoPrompt(message);
    if (shouldUseEnhanced) {
      console.log(`[SessionV2] Using enhanced internal todolist prompt for complex operation`);
      dynamicInstructions = `
<mandatory_workflow>
This is a complex multi-system operation requiring internal todolist coordination.
Your FIRST action must be to use internalTodoWrite to create 3-5 specific todos.
Then execute systematically with progress updates.
</mandatory_workflow>`;
    }

    try {
      // Create processor context with ActionCtx bound
      const processorContext = {
        sessionID: sessionId || "default",
        messageID: `msg-${Date.now()}`,
        userId,
        currentTimeContext
      };

      // Get tools using Convex-recommended pattern (ActionCtx captured in closure)
      const tools = await ToolRegistryManager.getTools(
        ctx, // ActionCtx passed directly - prevents context loss
        processorContext,
        "anthropic", 
        modelName
      );
      const toolNames = Object.keys(tools);
      const batchTools = toolNames.filter(name => name.includes('Batch') || name.includes('batch'));
      
      console.log(`[SessionV2] ✅ Created ${toolNames.length} tools with ActionCtx bound`);
      console.log(`[SessionV2] Available tools: ${toolNames.join(', ')}`);
      console.log(`[SessionV2] Batch tools available: ${batchTools.length > 0 ? batchTools.join(', ') : 'NONE FOUND'}`);
      
      if (batchTools.length === 0) {
        console.warn(`[SessionV2] ⚠️  No batch tools found! Expected: createBatchTasks, deleteBatchTasks, completeBatchTasks, updateBatchTasks, createProjectWithTasks, reorganizeTasksBatch`);
      } else {
        console.log(`[SessionV2] ✅ Batch tools successfully loaded: ${batchTools.length}/6`);
      }

      // Create full processor context for stream processing
      const fullProcessorContext: ProcessorContext = {
        sessionID: sessionId || "default",
        messageID: `msg-${Date.now()}`,
        userId,
        actionCtx: ctx,
        currentTimeContext
      };
      
      const processor = createProcessor(fullProcessorContext);

      // Generate system prompt with custom prompts integration (async)
      const systemPrompt = await SystemPrompt.getSystemPrompt(
        ctx, // ActionCtx for database access
        modelName, 
        dynamicInstructions, 
        message, 
        userId // User ID for custom prompt loading
      );
      
      console.log(`[SessionV2] System prompt generated for user ${userId.substring(0, 20)}... (length: ${systemPrompt.length})`);
      if (systemPrompt.includes('<custom_system_prompt>')) {
        console.log(`[SessionV2] ✅ Custom system prompt loaded and integrated`);
      }

      // Add system prompt as simple string message (AI SDK schema compliant)
      const systemMessage: ModelMessage = {
        role: "system",
        content: systemPrompt
      };
      
      // Prepend system message 
      let messagesWithSystem = [systemMessage, ...modelMessages];
      console.log(`[SessionV2] Added system prompt as cacheable system message`);

      // Apply OpenCode-style Anthropic ephemeral caching to ALL messages (including system prompt)
      console.log(`[SessionV2] Applying OpenCode-style caching to ${messagesWithSystem.length} messages`);
      
      // Optimize messages for better context management
      messagesWithSystem = MessageCaching.optimizeForCaching(messagesWithSystem);
      
      // Apply Anthropic ephemeral caching (targeting system prompts + recent messages)
      messagesWithSystem = MessageCaching.applyCaching(messagesWithSystem, modelName);
      
      console.log(`[SessionV2] Caching applied to messages including ${systemPrompt.length}-char system prompt`);

      // Use streamText with proper stopping conditions (OpenCode pattern)
      // Use proper AI SDK pattern with openrouter.chat() method
      const stream = streamText({
        model: openrouter.chat(modelName, {
          usage: {
            include: true, // Enable OpenRouter usage tracking for cache monitoring
          },
        }),
        messages: messagesWithSystem,
        tools,
        maxRetries: 3,
        // Allow up to 100 steps for complex multi-step tasks
        stopWhen: async ({ steps }) => {
          // Log progress every 10 steps for monitoring
          if (steps.length % 10 === 0 && steps.length > 0) {
            console.log(`[SessionV2] Step ${steps.length}/100 - continuing...`);
          }
          
          if (steps.length >= 100) {
            console.log(`[SessionV2] Stopping at step ${steps.length} - maximum steps reached`);
            return true;
          }

          // Check for conversation loops using MessageV2
          if (MessageV2.ContextManager.detectConversationLoop(history)) {
            console.warn(`[SessionV2] Conversation loop detected, stopping`);
            return true;
          }

          return false;
        },
        // Enhanced error handling
        onError: (error) => {
          console.error('[SessionV2] StreamText error:', error);
        }
      });

      // Process the stream using our OpenCode-inspired processor
      console.log('[SessionV2] Starting stream processing...');
      const result = await processor.process(stream);
      
      console.log(`[SessionV2] Stream processing completed:`, {
        hasText: !!result.text,
        toolCalls: result.toolCalls.length,
        toolResults: result.toolResults.length,
        tokens: result.tokens,
        cost: result.cost,
        completed: result.completed,
        error: result.error
      });

      // Log OpenRouter usage tracking data for cache monitoring
      if (result.providerMetadata?.openrouter?.usage) {
        const usage = result.providerMetadata.openrouter.usage;
        console.log(`[CACHE TRACKING] OpenRouter usage data:`, {
          cost: usage.cost,
          totalTokens: usage.totalTokens,
          inputTokens: usage.promptTokens || usage.inputTokens,
          outputTokens: usage.completionTokens || usage.outputTokens,
          cacheData: usage.cache || 'No cache data available'
        });
        
        // Specifically log cache performance if available
        if (usage.cache) {
          console.log(`[CACHE PERFORMANCE] Cache hits/misses:`, usage.cache);
        } else {
          console.log(`[CACHE PERFORMANCE] No cache data in response - verify caching is working`);
        }
      } else {
        console.log(`[CACHE TRACKING] No OpenRouter usage metadata available - check provider configuration`);
      }

      // Build final conversation history
      const finalHistory = [...history];

      // Add assistant message with tool calls
      if (result.toolCalls.length > 0) {
        finalHistory.push({
          role: "assistant",
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
        });

        // Add tool results
        if (result.toolResults.length > 0) {
          finalHistory.push({
            role: "tool",
            toolResults: result.toolResults,
            timestamp: Date.now(),
          });
        }
      }

      // Add final response if we have text
      if (result.text && result.text.trim()) {
        finalHistory.push({
          role: "assistant",
          content: result.text,
          timestamp: Date.now(),
        });
      }

      // Clean up internal todolist if conversation is complete
      try {
        if (result.completed && !result.error) {
          await ctx.runMutation(api.aiInternalTodos.deactivateInternalTodos, { sessionId });
          console.log(`[SessionV2] Deactivated internal todolist for completed conversation`);
        }
      } catch (error) {
        console.warn(`[SessionV2] Failed to deactivate todolist:`, error);
      }

      // Save conversation with session awareness
      await ctx.runMutation(api.conversations.upsertConversation, { 
        sessionId,
        messages: finalHistory as any 
      });

      // Return response with metadata
      const response = result.text || "I've completed the requested actions.";
      
      return {
        response,
        fromCache: false,
        metadata: {
          toolCalls: result.toolCalls.length,
          tokens: result.tokens,
          cost: result.cost,
          completed: result.completed,
          error: result.error,
          processingTime: Date.now() - (processorContext as any).startTime || 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error('[SessionV2] Session orchestration failed:', error);
      
      // Save error state to conversation for debugging
      const errorHistory = [...history, {
        role: "assistant",
        content: `I encountered an error: ${errorMessage}. Please try again or contact support if this persists.`,
        timestamp: Date.now(),
      }];

      await ctx.runMutation(api.conversations.upsertConversation, { 
        sessionId,
        messages: errorHistory as any 
      });

      return {
        response: `I encountered an error while processing your request: ${errorMessage}. Please try again.`,
        fromCache: false,
        metadata: {
          error: errorMessage,
          completed: false
        }
      };
    }
  }
});

/**

 * The new approach provides consistent request payloads for Anthropic ephemeral caching
 */

/**
 * Legacy compatibility wrapper - gradually migrate existing calls to use chatWithAIV2
 */
export const chatWithAI = chatWithAIV2;

/**
 * Diagnostic action to compare old vs new system performance
 */
export const compareChatSystems = action({
  args: {
    message: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    useV2: v.optional(v.boolean()),
  },
  handler: async (ctx, { message, sessionId, useV2 = true }): Promise<{
    response: string;
    system: string;
    processingTime: number;
    timestamp: number;
    error?: boolean;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    
    console.log(`[Comparison] Testing ${useV2 ? 'V2' : 'V1'} system for user ${userId.substring(0, 20)}...`);
    
    const startTime = Date.now();
    
    try {
      let result;
      if (useV2) {
        result = await ctx.runAction(api.ai.session.chatWithAIV2, {
          message,
          sessionId,
          useHaiku: true
        });
      } else {
        result = await ctx.runAction(api.ai.chatWithAILegacy, {
          message,
          sessionId,
          useHaiku: true
        });
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...result,
        system: useV2 ? 'V2' : 'V1',
        processingTime,
        timestamp: Date.now()
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        response: `Error in ${useV2 ? 'V2' : 'V1'} system: ${error instanceof Error ? error.message : 'Unknown error'}`,
        system: useV2 ? 'V2' : 'V1',
        processingTime,
        error: true,
        timestamp: Date.now()
      };
    }
  }
});

/**
 * Session statistics and monitoring
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
    
    const messages = (conversation?.messages as MessageV2.ConvexMessage[]) || [];
    const stats = MessageV2.ContextManager.getConversationStats(messages);
    const cacheStats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      note: "OpenCode-style server-side caching via Anthropic"
    };
    
    return {
      userId: userId.substring(0, 20) + "...",
      sessionId: sessionId || "default",
      conversation: stats,
      caching: cacheStats,
      timestamp: Date.now()
    };
  }
});