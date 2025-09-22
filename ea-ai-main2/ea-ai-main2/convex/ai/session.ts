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
import { createSimpleToolRegistry, createPrimaryModeToolRegistry } from "./toolRegistry";
import { createModeToolRegistry as createSessionModeToolRegistry } from "./toolRegistry";
import { ToolRepetitionDetector } from "./tools/ToolRepetitionDetector";
import { parseAssistantMessage } from "./assistantMessage/parseAssistantMessage";

// Import mode components
import { ModeRegistry } from "./modes/registry";

// Import clean logging system
import { logModeSwitch, logUserMessage, logSession, logToolCalls, logCurrentMode, logNoToolsCalled } from "./logger";

// Langfuse Cloud tracing imports
import {
  createConversationTrace,
  createUserMessageSpan,
  createPromptGeneration,
  updatePromptGeneration,
  createToolCallSpan,
  createToolResultSpan,
  createAssistantMessageSpan,
  endConversation,
  endSpan
} from "./langfuse/logger";

/**
 * Simplified Convex + AI SDK integration
 * 
 * Key changes from complex version:
 * - Direct message conversion (no 4-layer pipeline)
 * - Let AI SDK handle tool execution natively  
 * - Remove manual stream processing complexity
 * - Use Convex patterns instead of fighting them
 * - Simple, direct approach that works reliably
 * - Uses mode-based system instead of agent-based system
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
    

    const modelName = useHaiku ? "anthropic/claude-3.5-haiku-20241022" : "anthropic/claude-3.5-haiku-20241022";
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    
    // Initialize Langfuse tracing
    const conversationTrace = createConversationTrace({
      sessionId: sessionId || "default",
      userId: userId,
    });
    
    // Declare Langfuse spans outside try block
    let userMessageSpan: any = null;
    let promptGeneration: any = null;
    let assistantMessageSpan: any = null;
    let tools: Record<string, any> = {}; // Declare tools here so it's available in catch block

    try {
      // Load conversation history and session state - simple, direct approach
      let conversation;
      let session;
      if (sessionId) {
        conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
        session = await ctx.runQuery(api.chatSessions.getChatSession, { sessionId });
      } else {
        conversation = await ctx.runQuery(api.conversations.getConversation);
      }
      
      const history = (conversation?.messages as ConvexMessage[]) || [];
      
      // Determine active mode from session or use intelligent routing
      // Always use primary mode - let the LLM determine when to switch via task tool
      // This follows the OpenCode pattern where primary agents share context in same session
      const activeMode = session?.activeMode || "primary";
      const currentModeName = activeMode;
      
      console.log(`[ModeAnalysis] Using primary mode - LLM will determine delegation via task tool`);
      
      // Log mode information but don't update session mode in database
      // Primary modes share context in same session (like OpenCode)
      tools = await createSessionModeToolRegistry(ctx, userId, currentModeName, currentTimeContext, sessionId);
      logCurrentMode(currentModeName, Object.keys(tools).length, "orchestration mode");
      console.log(`[ModeTools] Created tool registry for mode: ${currentModeName} with ${Object.keys(tools).length} tools available`);
      
      // Log user message
      logUserMessage(message, sessionId);
      
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
      
      // Inject mode-specific prompts if needed
      const historyWithModePrompts = await injectModePrompts(cleanHistory, sessionId, currentModeName);

      // Direct conversion to AI SDK format - no complex pipeline
      const modelMessages = convertConvexToModelMessages(historyWithModePrompts);

      // Initialize caching for performance
      MessageCaching.initializeCaching();

      // Generate system prompt using mode-specific system
      const systemPrompt = await SystemPrompt.getSystemPrompt(
        ctx,
        modelName, 
        "", // No special instructions needed 
        message,
        userId,
        currentModeName
      );
      
      console.log(`[SystemPrompt] Generated system prompt for mode: ${currentModeName}`);
      
      // Add system message to conversation
      const messagesWithSystem = [
        { role: "system" as const, content: systemPrompt },
        ...modelMessages
      ];

      // Apply caching optimization
      const cachedMessages = MessageCaching.applyCaching(messagesWithSystem, modelName);

      // Create Langfuse prompt generation for AI execution
      promptGeneration = createPromptGeneration({
        model: modelName,
        systemPrompt: systemPrompt,
        messageCount: cachedMessages.length,
        sessionId: sessionId || "default",
        userId: userId,
        messages: cachedMessages
      });

      // Create mode-specific tool registry and log current mode with tool count
      tools = await createSessionModeToolRegistry(ctx, userId, currentModeName, currentTimeContext, sessionId);
      const toolCount = Object.keys(tools).length;
      logCurrentMode(currentModeName, toolCount, "orchestration mode");
      console.log(`[ModeTools] Created tool registry for mode: ${currentModeName} with ${toolCount} tools available`);

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
      

      // Let AI SDK handle the entire streaming and tool execution process
      // This is much simpler than manual stream processing

      // Get final result from AI SDK - properly await promises
      const finalText = await result.text;
      const finalToolCalls = await result.toolCalls;
      const finalToolResults = await result.toolResults;
      const finalUsage = await result.usage;
      
      // Log tool calls if any were made, or log why none were called
      if (finalToolCalls && finalToolCalls.length > 0) {
        const toolCallsForLogging = finalToolCalls.map(call => ({
          name: call.toolName,
          args: call.input
        }));
        logToolCalls(toolCallsForLogging);
        console.log(`[ToolExecution] Successfully executed ${finalToolCalls.length} tool(s)`);
      } else {
        // Log when no tools are called to help debug AI behavior
        const availableToolNames = Object.keys(tools);
        logNoToolsCalled(availableToolNames, message);
        console.log(`[ToolExecution] No tools were called. Available tools: ${availableToolNames.join(", ")}`);
        
        // Special handling for information-collector mode
        // Check if we just switched to information-collector mode
        // Using cleanHistory instead of finalHistory since finalHistory isn't declared yet
        const lastAssistantMessageInNoTools = cleanHistory.filter(msg => msg.role === "assistant").pop();
        if (lastAssistantMessageInNoTools && lastAssistantMessageInNoTools.toolCalls) {
          const modeSwitchCall = lastAssistantMessageInNoTools.toolCalls.find((tc: any) =>
            tc.name === "task" &&
            tc.args?.targetType === "primary-mode" &&
            tc.args?.targetName === "information-collector"
          );
          
          if (modeSwitchCall) {
            console.log(`[ModeSwitch] Detected switch to information-collector mode. Preparing to collect information.`);
          }
        }
      }
      
      // Update Langfuse prompt generation with response information
      if (promptGeneration && finalUsage) {
        updatePromptGeneration(
          finalText || "",
          finalToolCalls,
          {
            inputTokens: finalUsage.inputTokens || 0,
            outputTokens: finalUsage.outputTokens || 0,
            totalTokens: finalUsage.totalTokens || 0
          }
        );
      }
      
      // Create assistant message span with final result
      if (finalText && finalUsage) {
        assistantMessageSpan = createAssistantMessageSpan({
          sessionId: sessionId || "default",
          userId: userId,
          message: finalText,
          model: modelName
        });
      }


      // Build final conversation history using simple approach
     const finalHistory = [...cleanHistory];

     // Debug: Log the current conversation state
     console.log(`[ConversationState] Building final history with ${finalHistory.length} messages`);
     
     // Check if we have a mode switch that should trigger information collection
     const lastAssistantMessageBeforeResponse = finalHistory.filter(msg => msg.role === "assistant").pop();
     if (lastAssistantMessageBeforeResponse && lastAssistantMessageBeforeResponse.toolCalls) {
       const modeSwitchCall = lastAssistantMessageBeforeResponse.toolCalls.find((tc: any) =>
         tc.name === "task" &&
         tc.args?.targetType === "primary-mode" &&
         tc.args?.targetName === "information-collector"
       );
       
       if (modeSwitchCall) {
         console.log(`[ModeSwitch] Detected information-collector mode switch. Adding follow-up message.`);
       }
     }

      // Add consolidated assistant response (fix double response issue)
      if (finalToolCalls.length > 0 || (finalText && finalText.trim())) {
        // Single assistant message with both tool calls and text content
        const assistantMessage: any = {
          role: "assistant",
          content: finalText || "",
          timestamp: Date.now()
        };

        // Add tool calls if present
        if (finalToolCalls.length > 0) {
          assistantMessage.toolCalls = finalToolCalls.map(tc => ({
            name: tc.toolName,
            args: tc.input,
            toolCallId: tc.toolCallId
          }));
        }

        finalHistory.push(assistantMessage);

        // Add tool results as separate message (required for conversation flow)
        if (finalToolResults.length > 0) {
          finalHistory.push({
            role: "tool",
            toolResults: finalToolResults.map(tr => ({
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              output: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output)
            })),
            timestamp: Date.now()
          });
        }
      } else if (finalToolCalls.length === 0 && finalToolResults.length === 0) {
        // If no tools were called and no results, check if we switched to information-collector mode
        // In this case, we should continue the conversation with the information collector
        const modeSwitchToolCall = finalHistory.find(msg => 
          msg.role === "assistant" && 
          msg.toolCalls && 
          msg.toolCalls.some((tc: any) => 
            tc.name === "task" && 
            tc.args?.targetType === "primary-mode" && 
            tc.args?.targetName === "information-collector"
          )
        );

        if (modeSwitchToolCall) {
          // Add a message indicating that the information collector should take over
          finalHistory.push({
            role: "assistant",
            content: "I'm now collecting information to help organize your tasks. Please answer the following questions:",
            timestamp: Date.now()
          });
        }
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

      // Tool calls and results are automatically tracked in createToolCallSpan/createToolResultSpan
      
      // Create spans for tool calls and results
      for (const toolCall of finalToolCalls) {
        createToolCallSpan({
          toolName: toolCall.toolName,
          input: toolCall.input as Record<string, any>,
          sessionId: sessionId || "default",
          userId: userId
        });
      }
      
      for (const toolResult of finalToolResults) {
        createToolResultSpan({
          toolName: toolResult.toolName || "unknown",
          output: toolResult.output,
          success: true,
          sessionId: sessionId || "default",
          userId: userId
        });
      }

      // End conversation and flush to Langfuse Cloud
      await endConversation({
        response: finalText || "I've completed the requested actions.",
        toolCalls: finalToolCalls.length,
        toolResults: finalToolResults.length,
        tokens: finalUsage ? {
          input: finalUsage.inputTokens || 0,
          output: finalUsage.outputTokens || 0,
          total: finalUsage.totalTokens || 0
        } : undefined
      });
      
      // Return simple response
      // Remove any XML tags from the response to prevent them from being returned to the user
      let cleanResponse = finalText || "I've completed the requested actions.";
      
      // Special handling for information-collector mode switch
      const lastAssistantMessageFinal = finalHistory.filter(msg => msg.role === "assistant").pop();
      if (lastAssistantMessageFinal && lastAssistantMessageFinal.toolCalls) {
        const modeSwitchCall = lastAssistantMessageFinal.toolCalls.find((tc: any) =>
          tc.name === "task" &&
          tc.args?.targetType === "primary-mode" &&
          tc.args?.targetName === "information-collector"
        );
        
        if (modeSwitchCall && finalToolResults.length === 0 && finalToolCalls.length > 0) {
          cleanResponse = "I'm now collecting information to help organize your tasks. I'll ask you some questions to better understand your situation.";
        }
      }
      
      cleanResponse = cleanResponse.replace(/<[^>]*>/g, '').trim();
      
      return {
        response: cleanResponse,
        fromCache: false,
        metadata: {
          toolCalls: finalToolCalls.length,
          toolResults: finalToolResults.length,
          tokens: finalUsage ? {
            input: finalUsage.inputTokens || 0,
            output: finalUsage.outputTokens || 0,
            total: finalUsage.totalTokens
          } : undefined,
          processingTime: Date.now() - Date.now() // Will be calculated properly
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error('[SessionSimplified] Chat failed:', error);
      
      // End conversation with error
      await endConversation({
        response: `Error: ${errorMessage}`,
        toolCalls: 0,
        toolResults: 0
      });
      
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

/**
 * Mode determination - always returns primary mode
 * The LLM itself should determine when to use the task tool for delegation
 * This follows the OpenCode pattern where the AI decides when to switch modes
 */
async function determineOptimalMode(message: string, history: any[]): Promise<string> {
  console.log(`[ModeRouter] LLM will determine optimal mode via task tool: "${message.substring(0, 50)}..."`);
  
  // Always return primary mode - let the LLM decide when to delegate
  return "primary";
}

/**
 * Inject mode-specific prompts into the conversation history
 * This function is kept for compatibility but should not interfere with primary mode switching
 * Primary modes should use task tool delegation instead of automatic prompt injection
 */
async function injectModePrompts(history: any[], sessionId: string | undefined, currentMode: string): Promise<any[]> {
  // Don't inject mode prompts automatically - let task tool handle delegation
  // This prevents contamination and follows OpenCode's pattern
  console.log(`[ModePrompts] Skipping automatic mode prompt injection for mode: ${currentMode}`);
  return history;
}

/**
 * Create tool registry filtered for a specific mode
 * Only provides tools that the mode has permission to use
 */
async function createModeToolRegistry(
  actionCtx: any,
  userId: string,
  modeName: string = "primary",
  currentTimeContext?: any,
  sessionId?: string
): Promise<Record<string, any>> {
  try {
    // Create the full tool registry
    const allTools = await createSimpleToolRegistry(actionCtx, userId, currentTimeContext, sessionId, modeName);
    
    // Get mode configuration
    const modeConfig = ModeRegistry.getMode(modeName);
    if (!modeConfig) {
      console.error(`[ModeToolRegistry] Mode ${modeName} not found, using all tools`);
      return allTools; // Fallback to all tools if mode not found
    }
    
    // Get mode's tool permissions
    const modeTools = ModeRegistry.getModeTools(modeName);
    
    // Filter tools based on mode permissions
    const filteredTools: Record<string, any> = {};
    
    for (const [toolName, tool] of Object.entries(allTools)) {
      // Special case: submodes should not have access to task tool to prevent recursion
      if (toolName === "task" && modeConfig.type !== "primary") {
        continue; // Skip task tool for submodes
      }
      
      // Check if mode has permission for this tool
      if (modeTools[toolName] === true) {
        filteredTools[toolName] = tool;
      }
    }
    
    console.log(`[ModeToolRegistry] Filtered tools for mode ${modeName}: ${Object.keys(filteredTools).length}/${Object.keys(allTools).length}`);
    
    return filteredTools;
  } catch (error) {
    console.error(`[ModeToolRegistry] Failed to create filtered tool registry:`, error);
    // Return all tools as fallback
    return await createSimpleToolRegistry(actionCtx, userId, currentTimeContext, sessionId, modeName);
  }
}