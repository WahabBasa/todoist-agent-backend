"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { streamText, stepCountIs, type StreamTextResult } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createVertex } from "@ai-sdk/google-vertex";
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
import { logStep, logModeSwitch, logUserMessage, logSession, logToolCalls, logCurrentMode, logNoToolsCalled, logDebug, logError, logFinalResponse } from "./logger";

// Import existing types
import type { ProviderSettings, ModelInfo } from "../providers/unified";

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

// Type definitions for session.ts following OpenCode's pragmatic approach

interface ChatMetadata {
  toolCalls: number;
  toolResults: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  processingTime?: number;
  error?: string;
  userFriendlyError?: string;
  needsSetup?: boolean;
}

interface ChatResponse {
  response: string;
  text: string;
  fromCache: boolean;
  metadata: ChatMetadata;
}

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
  handler: async (ctx, { message, useHaiku = true, sessionId, currentTimeContext }): Promise<ChatResponse> => {
    // Authentication
    const { userId } = await requireUserAuthForAction(ctx);
    
    // OpenCode-style unified config retrieval
    const tokenIdentifier = userId;
    console.log(`🔍 [MODEL_SELECTION] Fetching config for user: ${userId.substring(0, 20)}...`);
    
    const userConfig = await ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier: userId });
    console.log(`📋 [MODEL_SELECTION] User config retrieved:`, {
      hasConfig: !!userConfig,
      activeModelId: userConfig?.activeModelId,
      hasApiKey: !!userConfig?.openRouterApiKey,
      apiKeyPreview: userConfig?.openRouterApiKey ? `${userConfig.openRouterApiKey.substring(0, 10)}...` : 'none'
    });
    
    // OpenCode-style model selection hierarchy - trust and validate at runtime
    const selectedModelId: string = await (async (): Promise<string> => {
      console.log(`🎯 [MODEL_SELECTION] Starting model selection hierarchy...`);
      console.log(`   - useHaiku parameter: ${useHaiku}`);
      console.log(`   - userConfig?.activeModelId: ${userConfig?.activeModelId}`);
      
      // 1. Check if model passed explicitly (highest priority)
      if (useHaiku === false && userConfig?.activeModelId) {
        console.log(`🎯 [MODEL_SELECTION] Using explicit user setting: ${userConfig.activeModelId}`);
        // Trust user's model selection - validation happens at provider API level
        return userConfig.activeModelId;
      }
      
      // 2. Check user's configured model
      if (userConfig?.activeModelId) {
        console.log(`🎯 [MODEL_SELECTION] Using user config: ${userConfig.activeModelId}`);
        // Trust user's model selection - validation happens at provider API level
        return userConfig.activeModelId;
      }
      
      // 3. Get cached models only as fallback if user hasn't selected a model
      console.log(`📦 [MODEL_FALLBACK] User has not selected a model, checking cached models...`);
      const provider = userConfig?.apiProvider || "openrouter";
      const cachedModels = await ctx.runQuery(api.providers.unified.getCachedProviderModels, { provider });
      console.log(`📦 [MODEL_FALLBACK] Cached models status:`, {
        hasCachedModels: !!cachedModels,
        modelCount: cachedModels?.models?.length || 0,
        lastFetched: cachedModels?.lastFetched ? new Date(cachedModels.lastFetched).toISOString() : 'never',
        provider
      });
      
      // 4. Find a fallback model from cached models
      if (cachedModels?.models && cachedModels.models.length > 0) {
        // Prefer Claude models as fallback for OpenRouter
        const claudeModel = cachedModels.models.find((m: any) => 
          m.id.includes('claude') && m.id.includes('3-5')
        );
        if (claudeModel) {
          console.log(`🔄 [MODEL_FALLBACK] Using Claude fallback: ${claudeModel.id}`);
          return claudeModel.id;
        }
        
        // Otherwise use the first available model
        const firstModel = cachedModels.models[0];
        console.log(`🔄 [MODEL_FALLBACK] Using first available: ${firstModel.id}`);
        return firstModel.id;
      }
      
      // 5. Ultimate fallback - use a sensible default
      const defaultModel = "anthropic/claude-3-5-haiku-20241022";
      console.warn(`⚠️ [MODEL_FALLBACK] No user model or cache available, using default: ${defaultModel}`);
      return defaultModel;
    })();
    
    // Use the full model ID directly - OpenCode's trust and validate at runtime approach
    // No need to parse the model ID, just pass it directly to the provider
    const modelName = selectedModelId;
    const provider = userConfig?.apiProvider || "openrouter";
    
    console.log(`🔄 [MODEL_SELECTION] Using full model ID:`, {
      modelId: modelName,
      provider: provider
    });
    
    if (process.env.LOG_LEVEL !== 'error') {
      logStep('Model Init', `${modelName} (${provider})`);
    }
    
    // Initialize the appropriate provider
    let modelProvider: any;
    
    if (provider === "google") {
      // Initialize Google Vertex AI
      console.log(`🔄 [MODEL_SELECTION] Initializing Google Vertex AI provider`);
      
      // Get Google credentials from config
      const googleProjectId = userConfig?.googleProjectId || "not-provided";
      const googleRegion = userConfig?.googleRegion;
      const googleCredentials = userConfig?.googleCredentials;
      
      // Set up Google credentials if provided
      if (googleCredentials) {
        try {
          // Parse the credentials JSON and set up authentication
          const credentials = JSON.parse(googleCredentials);
          process.env.GOOGLE_APPLICATION_CREDENTIALS = JSON.stringify(credentials);
        } catch (error) {
          console.warn("⚠️ [GOOGLE] Failed to parse Google credentials JSON, using default authentication");
        }
      }
      
      // Initialize Google Vertex AI provider
      modelProvider = createVertex({
        project: googleProjectId,
        location: googleRegion || "us-central1",
      });
    } else {
      // Initialize OpenRouter (default)
      console.log(`🔄 [MODEL_SELECTION] Initializing OpenRouter provider`);
      
      // Get API key from unified config
      const apiKey = userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      console.log(`🔑 [MODEL_SELECTION] API key source: ${userConfig?.openRouterApiKey ? 'user_config' : 'environment'}`);
      
      if (!apiKey) {
        console.error(`❌ [MODEL_SELECTION] No API key found - userConfig: ${!!userConfig?.openRouterApiKey}, env: ${!!process.env.OPENROUTER_API_KEY}`);
        throw new Error("OpenRouter API key is required. Please configure it in the admin dashboard.");
      }
      
      // Initialize OpenRouter with proper configuration  
      modelProvider = createOpenRouter({ 
        apiKey,
        baseURL: userConfig?.openRouterBaseUrl || "https://openrouter.ai/api/v1",
      });
    }
    
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
      // Log session start
      logSession("start", sessionId, message);
      
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
      
      logDebug("Using primary mode - LLM will determine delegation via task tool");
      
      // Log mode information but don't update session mode in database
      // Primary modes share context in same session (like OpenCode)
      tools = await createSessionModeToolRegistry(ctx, userId, currentModeName, currentTimeContext, sessionId);
      logCurrentMode(currentModeName, Object.keys(tools).length, "orchestration mode", sessionId);
      logDebug(`Created tool registry for mode: ${currentModeName} with ${Object.keys(tools).length} tools available`);
      
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
      
      logDebug(`Generated system prompt for mode: ${currentModeName}`);
      
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
      logCurrentMode(currentModeName, toolCount, "orchestration mode", sessionId);
      logDebug(`Created tool registry for mode: ${currentModeName} with ${toolCount} tools available`);

      // Initialize tool repetition detector
      const toolRepetitionDetector = new ToolRepetitionDetector(3);

      // Use AI SDK's streamText with native tool handling
      // Pass the correctly parsed model name to the appropriate provider
      const result: StreamTextResult<Record<string, any>, never> = await streamText({
        model: modelProvider.chat(modelName, {
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
      const finalText: string = await result.text;
      const finalToolCalls: any[] = await result.toolCalls;
      const finalToolResults: any[] = await result.toolResults;
      const finalUsage = await result.usage;
      
      console.log('✅ [BACKEND DEBUG] AI SDK result:', {
        finalTextType: typeof finalText,
        finalTextLength: finalText?.length || 0,
        finalTextPreview: finalText ? finalText.substring(0, 100) + '...' : null,
        toolCallsCount: finalToolCalls?.length || 0,
        toolResultsCount: finalToolResults?.length || 0,
        hasUsage: !!finalUsage
      });
      
      // Log tool calls if any were made, or log why none were called
      if (finalToolCalls && finalToolCalls.length > 0) {
        const toolCallsForLogging = finalToolCalls.map((call: any) => ({
          name: call.toolName,
          args: call.input
        }));
        logToolCalls(toolCallsForLogging);
        logDebug(`Successfully executed ${finalToolCalls.length} tool(s)`);
      } else {
        // Log when no tools are called to help debug AI behavior
        const availableToolNames = Object.keys(tools);
        logNoToolsCalled(availableToolNames, message);
        logDebug(`No tools were called. Available tools: ${availableToolNames.join(", ")}`);
        
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
            logModeSwitch("primary", "information-collector", "User delegation detected", sessionId);
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
     logDebug(`Building final history with ${finalHistory.length} messages`);
     
     // Check if we have a mode switch that should trigger information collection
     const lastAssistantMessageBeforeResponse = finalHistory.filter(msg => msg.role === "assistant").pop();
     if (lastAssistantMessageBeforeResponse && lastAssistantMessageBeforeResponse.toolCalls) {
       const modeSwitchCall = lastAssistantMessageBeforeResponse.toolCalls.find((tc: any) =>
         tc.name === "task" &&
         tc.args?.targetType === "primary-mode" &&
         tc.args?.targetName === "information-collector"
       );
       
       if (modeSwitchCall) {
         logModeSwitch("primary", "information-collector", "Follow-up message needed", sessionId);
       }
     }

      // Add consolidated assistant response (fix double response issue)
      console.log('🔄 [BACKEND DEBUG] Building final conversation history:', {
        finalHistoryLength: finalHistory.length,
        finalToolCallsLength: finalToolCalls.length,
        finalTextLength: finalText?.length || 0,
        finalTextPreview: finalText ? finalText.substring(0, 50) + '...' : null
      });
      
      if (finalToolCalls.length > 0 || (finalText && finalText.trim())) {
        // Single assistant message with both tool calls and text content
        const assistantMessage: any = {
          role: "assistant",
          content: finalText || "",
          timestamp: Date.now()
        };

        // Add tool calls if present
        if (finalToolCalls.length > 0) {
          assistantMessage.toolCalls = finalToolCalls.map((tc: any) => ({
            name: tc.toolName,
            args: tc.input,
            toolCallId: tc.toolCallId
          }));
        }

        console.log('➕ [BACKEND DEBUG] Adding assistant message to history:', {
          contentPreview: assistantMessage.content.substring(0, 50) + '...',
          hasToolCalls: !!assistantMessage.toolCalls,
          toolCallsCount: assistantMessage.toolCalls?.length || 0
        });
        
        finalHistory.push(assistantMessage);

        // Add tool results as separate message (required for conversation flow)
        if (finalToolResults.length > 0) {
          finalHistory.push({
            role: "tool",
            toolResults: finalToolResults.map((tr: any) => ({
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
      console.log('💾 [BACKEND DEBUG] Saving conversation to database:', {
        sessionId,
        messageCount: finalHistory.length,
        lastMessages: finalHistory.slice(-3).map(msg => ({
          role: msg.role,
          contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : '[structured content]'
        }))
      });
      
      const savedConversationId = await ctx.runMutation(api.conversations.upsertConversation, { 
        sessionId,
        messages: finalHistory as any 
      });
      
      console.log('✅ [BACKEND DEBUG] Conversation saved successfully:', {
        conversationId: savedConversationId,
        sessionId
      });

      // Clean up internal todos if conversation is complete
      try {
        if (sessionId && finalToolResults.length === 0) {
          await ctx.runMutation(api.aiInternalTodos.deactivateInternalTodos, { sessionId });
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), "Todo cleanup failed");
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
      
      // Log session completion (with error protection)
      try {
        logSession("end", sessionId, undefined, currentModeName);
      } catch (loggingError) {
        // Don't let logging errors prevent response from being returned
        console.warn("[Logging] Failed to log session end:", loggingError);
      }
      
      // Return simple response
      // Remove any XML tags from the response to prevent them from being returned to the user
      let cleanResponse: string = finalText || "I've completed the requested actions.";
      
      console.log('✅ [BACKEND DEBUG] Pre-cleanup response:', {
        originalResponse: cleanResponse,
        originalLength: cleanResponse.length
      });
      
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
      
      console.log('✅ [BACKEND DEBUG] Final clean response:', {
        cleanResponseLength: cleanResponse.length,
        cleanResponsePreview: cleanResponse.substring(0, 100) + '...'
      });
      
      // Log final response with metrics (with error protection)
      try {
        logFinalResponse(cleanResponse, {
          toolCalls: finalToolCalls.length,
          toolResults: finalToolResults.length,
          tokens: finalUsage ? {
            input: finalUsage.inputTokens || 0,
            output: finalUsage.outputTokens || 0,
            total: finalUsage.totalTokens || 0
          } : undefined,
          processingTime: 0 // Will be calculated properly in future enhancement
        }, sessionId);
      } catch (loggingError) {
        // Don't let logging errors prevent response from being returned
        console.warn("[Logging] Failed to log final response:", loggingError);
      }
      
      console.log('📤 [BACKEND DEBUG] Returning response to frontend:', {
        responseLength: cleanResponse.length,
        responsePreview: cleanResponse.substring(0, 100) + '...',
        hasMetadata: !!finalUsage
      });
      
      return {
        response: cleanResponse,
        text: cleanResponse,
        fromCache: false,
        metadata: {
          toolCalls: finalToolCalls.length,
          toolResults: finalToolResults.length,
          tokens: finalUsage ? {
            input: finalUsage.inputTokens || 0,
            output: finalUsage.outputTokens || 0,
            total: finalUsage.totalTokens || 0
          } : undefined,
          processingTime: Date.now() - Date.now() // Will be calculated properly
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`❌ [SESSION_ERROR] Chat session failed:`, {
        error: errorMessage,
        userId: userId.substring(0, 20) + "...",
        sessionId,
        selectedModelId: selectedModelId || 'unknown',
        hasUserConfig: !!userConfig,
        hasApiKey: !!(userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY)
      });
      
      logError(error instanceof Error ? error : new Error(String(error)), "Chat session failed");
      
      // Enhanced error handling for model selection issues
      let userFriendlyError = errorMessage;
      if (errorMessage.includes("No models available")) {
        userFriendlyError = "🔧 **Setup Required**: Please go to Admin Dashboard and fetch models from OpenRouter before chatting.";
      } else if (errorMessage.includes("OpenRouter API key")) {
        userFriendlyError = "🔑 **API Key Required**: Please configure your OpenRouter API key in the Admin Dashboard.";
      } else if (errorMessage.includes("Model not found")) {
        userFriendlyError = "🔄 **Model Issue**: Your selected model is no longer available. Please choose a different model in Admin Dashboard.";
      } else if (errorMessage.includes("Unauthorized")) {
        userFriendlyError = "🔒 **Authentication Required**: Please log in to continue.";
      }
      
      // End conversation with error
      await endConversation({
        response: `Error: ${userFriendlyError}`,
        toolCalls: 0,
        toolResults: 0
      });
      
      // Log session end with error
      logSession("end", sessionId, undefined, "error");
      
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
        content: userFriendlyError,
        timestamp: Date.now()
      });

      await ctx.runMutation(api.conversations.upsertConversation, {
        sessionId,
        messages: errorHistory as any
      });

      // OpenTelemetry spans are automatically flushed
      try {
        logDebug("Error traces recorded successfully");
      } catch (telemetryError) {
        logError(telemetryError instanceof Error ? telemetryError : new Error(String(telemetryError)), "Error recording traces");
      }
      
      return {
        response: userFriendlyError,
        text: userFriendlyError,
        fromCache: false,
        metadata: {
          error: errorMessage,
          userFriendlyError,
          toolCalls: 0,
          toolResults: 0,
          needsSetup: errorMessage.includes("No models available") || errorMessage.includes("API key")
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
  logDebug(`LLM will determine optimal mode via task tool: "${message.substring(0, 50)}..."`);
  
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
  logDebug(`Skipping automatic mode prompt injection for mode: ${currentMode}`);
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
      logError(`Mode ${modeName} not found, using all tools`, "ModeToolRegistry");
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
    
    logDebug(`Filtered tools for mode ${modeName}: ${Object.keys(filteredTools).length}/${Object.keys(allTools).length}`);
    
    return filteredTools;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), "Failed to create filtered tool registry");
    // Return all tools as fallback
    return await createSimpleToolRegistry(actionCtx, userId, currentTimeContext, sessionId, modeName);
  }
}