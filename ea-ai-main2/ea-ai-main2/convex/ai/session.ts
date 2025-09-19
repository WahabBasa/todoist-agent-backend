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
import { createSimpleToolRegistry, createPrimaryAgentToolRegistry, createAgentToolRegistry } from "./toolRegistry";
import { ToolRepetitionDetector } from "./tools/ToolRepetitionDetector";
import { parseAssistantMessage } from "./assistantMessage/parseAssistantMessage";

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
      
      // Determine active agent from session or use intelligent routing
      const currentAgentName = session?.agentName || await determineOptimalAgent(message, history);
      
      console.log(`[Session] Using agent: ${currentAgentName} for request: "${message.substring(0, 50)}..."`);
      
      // Update session with determined agent if different
      if (session && session.agentName !== currentAgentName) {
        await ctx.runMutation(api.chatSessions.updateChatSession, {
          sessionId: session._id,
          agentName: currentAgentName,
        });
      }
      
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

      // Generate system prompt using agent-specific system
      const systemPrompt = await SystemPrompt.getSystemPrompt(
        ctx,
        modelName, 
        "", // No special instructions needed 
        message,
        userId,
        currentAgentName
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

      // Create agent-specific tool registry 
      const tools = await createAgentToolRegistry(ctx, userId, currentAgentName, currentTimeContext, sessionId);

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
 * Intelligent agent determination based on request analysis
 * Implements automatic mode switching for 4-mode architecture
 */
async function determineOptimalAgent(message: string, history: any[]): Promise<string> {
  const msg = message.toLowerCase().trim();
  
  // Direct execution patterns - simple operations
  const directExecutionPatterns = [
    /^(create|add|make)\s+(task|project|event)/,
    /^(update|edit|modify|change)\s+(task|project|event)/,
    /^(delete|remove|complete)\s+(task|project|event)/,
    /^(schedule|set)\s+/,
    /^mark\s+.+as\s+(complete|done)/,
  ];
  
  if (directExecutionPatterns.some(pattern => pattern.test(msg))) {
    console.log(`[AgentRouter] Direct execution detected: ${message.substring(0, 50)}...`);
    return "execution";
  }
  
  // Information gathering patterns - questions and clarifications needed
  const informationGatheringPatterns = [
    /what\s+(are|is)\s+my/,
    /show\s+me\s+my/,
    /list\s+my/,
    /how\s+many/,
    /when\s+(is|are)/,
    /which\s+/,
    /where\s+/,
    /tell\s+me\s+about/,
    /need\s+to\s+know/,
    /want\s+to\s+understand/,
    /clarify/,
    /explain/,
  ];
  
  if (informationGatheringPatterns.some(pattern => pattern.test(msg))) {
    console.log(`[AgentRouter] Information gathering detected: ${message.substring(0, 50)}...`);
    return "information-collector";
  }
  
  // Strategic planning patterns - complex analysis and planning
  const planningPatterns = [
    /plan\s+my\s+(week|day|month)/,
    /organize\s+my\s+(tasks|projects|schedule)/,
    /prioritize/,
    /strategy/,
    /optimize/,
    /restructure/,
    /analyze\s+my/,
    /recommend/,
    /suggest\s+how/,
    /help\s+me\s+plan/,
    /roadmap/,
    /workflow/,
  ];
  
  if (planningPatterns.some(pattern => pattern.test(msg))) {
    console.log(`[AgentRouter] Planning detected: ${message.substring(0, 50)}...`);
    return "planning";
  }
  
  // Complex operations that require orchestration
  const complexPatterns = [
    /delete\s+all/,
    /update\s+all/,
    /move\s+all/,
    /sync\s+with/,
    /integrate/,
    /migrate/,
    /bulk\s+/,
    /batch\s+/,
    /multiple\s+/,
    /everything/,
    /across\s+/,
  ];
  
  if (complexPatterns.some(pattern => pattern.test(msg))) {
    console.log(`[AgentRouter] Complex operation detected, using orchestrator: ${message.substring(0, 50)}...`);
    return "primary";
  }
  
  // Check conversation context - if we're in middle of information gathering
  const recentAssistantMessages = history
    .filter(m => m.role === "assistant")
    .slice(-2);
  
  const hasQuestions = recentAssistantMessages.some(m => 
    typeof m.content === 'string' && m.content.includes('?')
  );
  
  if (hasQuestions) {
    console.log(`[AgentRouter] Continuing information gathering context: ${message.substring(0, 50)}...`);
    return "information-collector";
  }
  
  // Default to primary orchestrator for routing
  console.log(`[AgentRouter] Defaulting to primary orchestrator: ${message.substring(0, 50)}...`);
  return "primary";
}