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
import { ModeController } from "./modes/controller";
import { ModeRegistry } from "./modes/registry";

// Import clean logging system
import { logModeSwitch, logUserMessage, logSession, logToolCalls, logCurrentMode, logNoToolsCalled } from "./logger";

// Read mode-specific prompt files
import fs from "fs/promises";
import path from "path";

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
      
      // Initialize mode controller for session
      if (sessionId) {
        ModeController.initializeSession(sessionId);
      }
      
      // Determine active mode from session or use intelligent routing
      const currentModeName = session?.modeName || await determineOptimalMode(message, history);
      
      // Log mode switch if needed (only when not primary)
      if (session && session.modeName !== currentModeName) {
        logModeSwitch(session.modeName || "primary", currentModeName, "intelligent routing");
        await ctx.runMutation(api.chatSessions.updateChatSession, {
          sessionId: session._id,
          modeName: currentModeName,
        });
      }
      
      // Create mode-specific tool registry and log current mode with tool count
      const tools = await createSessionModeToolRegistry(ctx, userId, currentModeName, currentTimeContext, sessionId);
      const toolCount = Object.keys(tools).length;
      logCurrentMode(currentModeName, toolCount, "orchestration mode");
      
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

      // Tool registry already created above for logging

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
      } else {
        // Log when no tools are called to help debug AI behavior
        const availableToolNames = Object.keys(tools);
        logNoToolsCalled(availableToolNames, message);
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
 * Intelligent mode determination based on request analysis
 * Implements automatic mode switching for mode-based architecture
 */
async function determineOptimalMode(message: string, history: any[]): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  // Check for overwhelm/stress indicators → information-collector mode
  const overwhelmKeywords = [
    "drowning", "overwhelmed", "stressed", "too much", "can't handle", 
    "falling behind", "deadlines", "pressure", "urgent", "emergency",
    "help me organize", "don't know where to start", "chaos", "mess"
  ];
  
  if (overwhelmKeywords.some(keyword => lowerMessage.includes(keyword))) {
    console.log(`[ModeRouter] Detected overwhelm scenario → information-collector: "${message.substring(0, 50)}..."`);
    return "information-collector";
  }
  
  // Check for complex planning needs → planning mode
  const planningKeywords = [
    "plan my", "organize my", "schedule", "timeline", "roadmap",
    "strategy", "approach", "break down", "structure", "workflow",
    "multiple projects", "long term", "quarterly", "weekly planning"
  ];
  
  if (planningKeywords.some(keyword => lowerMessage.includes(keyword))) {
    console.log(`[ModeRouter] Detected planning needs → planning: "${message.substring(0, 50)}..."`);
    return "planning";
  }
  
  // Check for simple execution tasks → execution mode
  const executionKeywords = [
    "create task", "add task", "new task", "mark complete", "update task",
    "delete task", "create project", "add to project", "quick add"
  ];
  
  if (executionKeywords.some(keyword => lowerMessage.includes(keyword))) {
    console.log(`[ModeRouter] Detected execution task → execution: "${message.substring(0, 50)}..."`);
    return "execution";
  }
  
  // Default to primary mode for orchestration and delegation
  console.log(`[ModeRouter] Using primary mode for orchestration: "${message.substring(0, 50)}..."`);
  return "primary";
}

/**
 * Inject mode-specific prompts into the conversation history
 * Similar to how OpenCode injects plan.txt and build-switch.txt
 */
async function injectModePrompts(history: any[], sessionId: string | undefined, currentMode: string): Promise<any[]> {
  if (!sessionId) {
    return history;
  }

  // Get the previous mode to determine if we need to inject a switch prompt
  const modeHistory = ModeController.getModeHistory(sessionId);
  const previousMode = modeHistory.length > 1 ? modeHistory[modeHistory.length - 2] : null;

  // Clone the history to avoid modifying the original
  const updatedHistory = [...history];

  // Inject mode switch prompt if switching between modes
  if (previousMode && previousMode !== currentMode) {
    let switchPrompt = "";
    
    // Determine the appropriate switch prompt based on the mode transition
    if (previousMode === "information-collector" && currentMode === "planning") {
      try {
        switchPrompt = await fs.readFile(
          path.join(__dirname, "modes", "prompts", "information-to-planning-switch.txt"),
          "utf-8"
        );
      } catch (error) {
        switchPrompt = "Your operational mode has changed from information collection to planning.";
      }
    } else if (previousMode === "planning" && currentMode === "execution") {
      try {
        switchPrompt = await fs.readFile(
          path.join(__dirname, "modes", "prompts", "planning-to-execution-switch.txt"),
          "utf-8"
        );
      } catch (error) {
        switchPrompt = "Your operational mode has changed from planning to execution.";
      }
    } else if (previousMode === "execution" && currentMode === "primary") {
      try {
        switchPrompt = await fs.readFile(
          path.join(__dirname, "modes", "prompts", "execution-to-primary-switch.txt"),
          "utf-8"
        );
      } catch (error) {
        switchPrompt = "Your operational mode has changed from execution to primary.";
      }
    }

    // Add the switch prompt to the last user message
    if (switchPrompt && updatedHistory.length > 0) {
      const lastMessage = updatedHistory[updatedHistory.length - 1];
      if (lastMessage.role === "user") {
        lastMessage.content += "\n" + switchPrompt;
      }
    }
  }

  // Inject mode-specific prompt for the current mode
  let modePrompt = "";
  try {
    const promptPath = path.join(__dirname, "modes", "prompts", `${currentMode}.txt`);
    modePrompt = await fs.readFile(promptPath, "utf-8");
  } catch (error) {
    // If no specific prompt file exists, use a generic mode prompt
    modePrompt = `<system-reminder>
CRITICAL: ${currentMode} mode ACTIVE. You are operating in ${currentMode} mode with specific permissions and responsibilities.
</system-reminder>`;
  }

  // Add the mode prompt to the last user message\n  if (modePrompt && updatedHistory.length > 0) {\n    const lastMessage = updatedHistory[updatedHistory.length - 1];\n    if (lastMessage.role === \"user\") {\n      lastMessage.content += \"\\n\" + modePrompt;\n    }\n  }

  return updatedHistory;
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