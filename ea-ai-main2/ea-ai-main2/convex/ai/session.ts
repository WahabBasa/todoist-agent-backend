"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { streamText, stepCountIs, type StreamTextResult } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createVertex } from "@ai-sdk/google-vertex";
import { api } from "../_generated/api";
import { SystemPrompt } from "./system";
import { autoCompactHistory } from "./compaction";
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
import { ModeController } from "./modes/controller";

// Import clean logging system
import { logStep, logModeSwitch, logUserMessage, logSession, logToolCalls, logCurrentMode, logNoToolsCalled, logDebug, logError, logFinalResponse, logWarning } from "./logger";

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

// Enhanced Error Types - Following OpenCode's structured error approach
export class RateLimitError extends Error {
  constructor(
    public statusCode: number, 
    public retryAfter?: number,
    public provider?: string,
    public modelId?: string
  ) {
    super(`Rate limited (${statusCode})${provider ? ` by ${provider}` : ''}${modelId ? ` for model ${modelId}` : ''}`);
    this.name = 'RateLimitError';
  }
}

export class ProviderAuthError extends Error {
  constructor(public provider: string, message: string, public modelId?: string) {
    super(`${provider}: ${message}${modelId ? ` (model: ${modelId})` : ''}`);
    this.name = 'ProviderAuthError';
  }
}

export class ModelNotFoundError extends Error {
  constructor(public modelId: string, public provider: string) {
    super(`Model ${modelId} not found on ${provider}`);
    this.name = 'ModelNotFoundError';
  }
}

// Type definitions for session.ts following OpenCode's pragmatic approach

/**
 * SECURITY: Sanitizes user input to prevent variable injection vulnerabilities
 * Prevents user content from contaminating JavaScript execution context
 */
function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potential JavaScript injection patterns
  const sanitized = input
    // Remove null bytes and control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escape potentially problematic sequences that could affect variable names
    .replace(/\${/g, '\\${')  // Template literal injection
    .replace(/`/g, '\\`')     // Template literal backticks
    .replace(/eval\s*\(/gi, 'eval_(')  // eval() calls
    // Don't remove common words like "I" - just ensure they can't become variables
    .trim();

  // Log if significant sanitization occurred
  if (sanitized !== input) {
    console.warn(`[SECURITY] User input sanitized - removed ${input.length - sanitized.length} characters`);
  }

  return sanitized;
}

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
  isRetriable?: boolean;
  embeddedMode?: string; // New: From parsed metadata
  toolStates?: Record<string, 'pending'|'running'|'completed'>;
  errorType?: string; // Enhanced: Error classification
  retryAfter?: number; // Enhanced: Rate limit retry timing
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
    sessionId: v.optional(v.id("chatSessions")),
    currentTimeContext: v.optional(v.object({
      currentTime: v.string(),
      userTimezone: v.string(),
      localTime: v.string(),
      timestamp: v.number(),
      source: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { message, sessionId, currentTimeContext }): Promise<ChatResponse> => {
    // Authentication
    const { userId } = await requireUserAuthForAction(ctx);

    // SECURITY: Sanitize user input to prevent variable injection
    const sanitizedMessage = sanitizeUserInput(message);
    
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
      console.log(`   - userConfig?.activeModelId: ${userConfig?.activeModelId}`);

      // 1. Check user's configured model (dashboard selection)
      if (userConfig?.activeModelId) {
        console.log(`🎯 [MODEL_SELECTION] Using dashboard selection: ${userConfig.activeModelId}`);
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
      
      // 4. No fallback - require dashboard selection
      console.error(`❌ [MODEL_SELECTION] No model selected in dashboard`);
      throw new Error("No model selected. Please select a model in the Admin Dashboard.");
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
        logDebug(`[QUERY] Fetching conversation for sessionId: ${sessionId} at ${new Date().toISOString()}`);
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
      const inMemoryMode = sessionId ? ModeController.getCurrentMode(sessionId) : null;
      
      // Parse embedded metadata from history (OpenCode-style)
      const { parseEmbeddedMetadata } = await import('./messageSchemas');
      const embeddedData = history.length > 0 ? parseEmbeddedMetadata(history[history.length - 1]) : null;
      const embeddedMode = embeddedData?.mode;
      
      // MODE DETERMINATION LOGGING: Enhanced logging for mode debugging
      console.log(`🔍 [MODE_DETERMINATION] Session: ${sessionId?.substring(0, 8) || 'none'}`);
      console.log(`   📊 Database mode: ${activeMode} (authoritative source)`);
      console.log(`   🧠 Memory mode: ${inMemoryMode || 'none'} (${inMemoryMode ? 'stale from reset' : 'reset due to serverless'} - IGNORED)`);
      console.log(`   📝 Embedded mode: ${embeddedMode || 'none'} (from last message metadata - fallback only)`);

      logDebug(`[MODE_PRECEDENCE] Database-first: DB=${activeMode}, Embedded=${embeddedMode || 'none'}, Memory=${inMemoryMode || 'none'} (ignored)`);
      
      // MODE PRECEDENCE FIX: Database-first precedence (no in-memory state in serverless)
      // In serverless environments, in-memory state is unreliable and resets between executions
      // Database is the authoritative source, embedded mode is fallback from message metadata
      const effectiveMode = activeMode || embeddedMode || 'primary';
      let currentModeName = effectiveMode;

      console.log(`   ✅ Effective mode: ${effectiveMode} (${
        activeMode && activeMode !== 'primary' ? 'from database' :
        embeddedMode ? 'from embedded metadata' :
        'default primary'
      })`);
      
      // Always sync ModeController with database mode at function start
      // This ensures in-memory state matches the authoritative database state
      if (sessionId && activeMode) {
        ModeController.setCurrentMode(sessionId, activeMode);
        logDebug(`[MODE_SYNC] Synced ModeController to database mode: ${activeMode}`);
        console.log(`   🔁 ModeController synchronized with database: ${activeMode}`);
      }
      
      logDebug("Using primary mode - LLM will determine delegation via task tool");
      
      // Log mode information but don't update session mode in database
      // Primary modes share context in same session (like OpenCode)
      tools = await createSessionModeToolRegistry(ctx, userId, currentModeName, currentTimeContext, sessionId);
      logCurrentMode(currentModeName, Object.keys(tools).length, "orchestration mode", sessionId);
      logDebug(`Created tool registry for mode: ${currentModeName} with ${Object.keys(tools).length} tools available`);
      
      // Log user message (use sanitized version for logging)
      logUserMessage(sanitizedMessage, sessionId);
      
      // Create user message span
      userMessageSpan = createUserMessageSpan({
        sessionId: sessionId || "default",
        userId: userId,
        message: message
      });

      // Add user message to conversation (use sanitized version)
      const updatedHistory = addMessageToConversation(history, {
        role: "user",
        content: sanitizedMessage
      });

      // Simple conversation optimization
      const optimizedHistory = optimizeConversation(updatedHistory, 50);
      const cleanHistory = sanitizeMessages(optimizedHistory);
      
      // Fetch previous mode for prompt injection
      const previousMode = sessionId ? ModeController.getPreviousMode(sessionId) : null;
      
      // Inject mode-specific prompts if needed
      const historyWithModePrompts = await injectModePrompts(cleanHistory, sessionId, currentModeName, previousMode); // Enhanced with OpenCode transitions
      if (effectiveMode !== activeMode) {
        logDebug(`[MODE_FALLBACK] Using fallback mode ${effectiveMode} (likely embedded metadata fallback)`);
      }

      // Direct conversion to AI SDK format - no complex pipeline
      const modelMessages = convertConvexToModelMessages(historyWithModePrompts);

      // Initialize caching for performance
      MessageCaching.initializeCaching();

      // Generate system prompt using mode-specific system
      let systemPrompt = await SystemPrompt.getSystemPrompt(
        ctx,
        modelName,
        "",
        message,
        userId,
        currentModeName
      );
      // Inject OpenCode-style transition instructions
      systemPrompt = systemPrompt + "\n\n<INSTRUCTIONS> For delegation/switching: If needed, use 'task' tool with structured args. Output synthetic transitions like <DELEGATE target='planning'>reason</DELEGATE> in responses.</INSTRUCTIONS>";
      
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

      // Enhanced retry wrapper for rate limiting resilience
      async function streamTextWithRateLimit(params: any): Promise<StreamTextResult<Record<string, any>, never>> {
        let attempt = 0;
        const maxAttempts = 5;
        
        while (attempt < maxAttempts) {
          try {
            logDebug(`[RETRY] Attempt ${attempt + 1}/${maxAttempts} for model ${modelName}`);
            
            return await streamText({
              ...params,
              maxRetries: 8, // Increased from 3 to 8 for rate limit resilience
            });
            
          } catch (error: any) {
            // Enhanced error classification
            const isRateLimit = error?.statusCode === 429 || 
                               error?.responseBody?.includes('rate-limited') ||
                               error?.message?.includes('rate limit') ||
                               error?.message?.includes('temporarily rate-limited');
            
            if (isRateLimit && attempt < maxAttempts - 1) {
              // Parse retry-after header if available
              const retryAfter = error?.responseHeaders?.['retry-after'] || 
                               error?.responseHeaders?.['Retry-After'];
              const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : null;
              
              // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s (capped at 30s)
              const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
              const jitter = Math.random() * 1000; // Add 0-1s jitter
              const delay = retryAfterSeconds ? retryAfterSeconds * 1000 : baseDelay + jitter;
              
              logWarning(`[RATE_LIMIT] Attempt ${attempt + 1} failed, retrying in ${Math.round(delay/1000)}s. Model: ${modelName}`);
              
              // Create structured rate limit error for logging
              const rateLimitError = new RateLimitError(
                error?.statusCode || 429,
                retryAfterSeconds ?? undefined,
                provider,
                modelName
              );
              logError(rateLimitError, `Rate limit retry ${attempt + 1}/${maxAttempts}`);
              
              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
              continue;
            }
            
            // For non-rate-limit errors or final attempt, classify and throw
            if (error?.statusCode === 401 || error?.message?.includes('API key') || error?.message?.includes('Unauthorized')) {
              throw new ProviderAuthError(provider, error.message || 'Authentication failed', modelName);
            } else if (error?.statusCode === 404 || error?.message?.includes('model not found')) {
              throw new ModelNotFoundError(modelName, provider);
            } else if (isRateLimit) {
              // Final rate limit attempt failed
              const retryAfterSeconds = error?.responseHeaders?.['retry-after'] || 
                                      error?.responseHeaders?.['Retry-After'];
              throw new RateLimitError(error?.statusCode || 429, retryAfterSeconds ? parseInt(retryAfterSeconds) : undefined, provider, modelName);
            }
            
            // Re-throw original error for unhandled cases
            throw error;
          }
        }
        
        throw new Error(`Max retry attempts (${maxAttempts}) exceeded for ${modelName}`);
      }

      // Use enhanced streamText with rate limit handling
      // Pass the correctly parsed model name to the appropriate provider
      const result: StreamTextResult<Record<string, any>, never> = await streamTextWithRateLimit({
        model: modelProvider.chat(modelName, {
          usage: { include: true }
        }),
        messages: cachedMessages,
        tools,
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

      // MODE TIMING FIX: Update currentModeName after successful mode switches
      if (finalToolCalls?.length > 0 && sessionId) {
        const modeSwitchCall = finalToolCalls.find((tc: any) => tc.toolName === "switchMode");
        if (modeSwitchCall) {
          // Get the actual current mode from the ModeController
          const updatedMode = ModeController.getCurrentMode(sessionId);

          // MODE VALIDATION: Verify database was updated correctly
          try {
            const currentSession = await ctx.runQuery(api.chatSessions.getChatSession, { sessionId });
            const dbMode = currentSession?.activeMode || "primary";

            if (dbMode !== updatedMode) {
              logError(new Error(`Mode validation failed: DB has ${dbMode}, ModeController has ${updatedMode}`), "Mode sync issue");
            } else {
              logDebug(`[MODE_VALIDATION] ✅ Mode switch successful: ${currentModeName} -> ${updatedMode} (DB confirmed)`);
            }
          } catch (validationError) {
            logError(validationError instanceof Error ? validationError : new Error(String(validationError)), "Mode validation query failed");
          }

          if (updatedMode !== currentModeName) {
            logDebug(`[MODE_TIMING_FIX] Updating currentModeName: ${currentModeName} -> ${updatedMode}`);
            currentModeName = updatedMode;
          }
        }
      }
      
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
        
        // Special handling for planning mode
        // Check if we just switched to planning mode
        // Using cleanHistory instead of finalHistory since finalHistory isn't declared yet
        const lastAssistantMessageInNoTools = cleanHistory.filter(msg => msg.role === "assistant").pop();
        if (lastAssistantMessageInNoTools && lastAssistantMessageInNoTools.toolCalls) {
          const modeSwitchCall = lastAssistantMessageInNoTools.toolCalls.find((tc: any) =>
            tc.name === "task" &&
            tc.args?.targetType === "primary-mode" &&
            tc.args?.targetName === "planning"
          );
          
          if (modeSwitchCall) {
            logModeSwitch("primary", "planning", "User delegation detected", sessionId);
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
     let finalHistory = [...cleanHistory];

     // Debug: Log the current conversation state
     logDebug(`Building final history with ${finalHistory.length} messages`);
     
     // Check if we have a mode switch that should trigger information collection
     const lastAssistantMessageBeforeResponse = finalHistory.filter(msg => msg.role === "assistant").pop();
     if (lastAssistantMessageBeforeResponse && lastAssistantMessageBeforeResponse.toolCalls) {
       const modeSwitchCall = lastAssistantMessageBeforeResponse.toolCalls.find((tc: any) =>
         tc.name === "task" &&
         tc.args?.targetType === "primary-mode" &&
         tc.args?.targetName === "planning"
       );
       
       if (modeSwitchCall) {
         logModeSwitch("primary", "planning", "Follow-up message needed", sessionId);
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
        // Single assistant message with embedded metadata (OpenCode-style)
        const { createEmbeddedMessage } = await import('./messageSchemas');
        async function updateToolStates(toolCalls: any[], toolResults: any[]): Promise<Record<string, 'pending'|'running'|'completed'>> {
          const toolStates: Record<string, 'pending' | 'running' | 'completed'> = {};
          toolCalls.forEach(tc => toolStates[tc.toolName] = 'running' as const);
          toolResults.forEach(tr => toolStates[tr.toolName] = 'completed' as const);
          return toolStates;
        }
        
        const toolStates = await updateToolStates(finalToolCalls, finalToolResults); // From ConversationState
        const base = { role: "assistant", content: finalText || "", timestamp: Date.now() };
        const metadata = { mode: currentModeName, toolStates, delegation: embeddedData?.delegation ?? undefined };
        const assistantMessage: any = createEmbeddedMessage(base, metadata);
      
        // Add tool calls if present
        if (finalToolCalls.length > 0) {
          assistantMessage.toolCalls = finalToolCalls.map((tc: any) => ({
            name: tc.toolName,
            args: tc.input,
            toolCallId: tc.toolCallId
          }));
        }
      
        console.log('➕ [BACKEND DEBUG] Adding embedded assistant message:', {
          contentPreview: assistantMessage.content.substring(0, 50) + '...',
          embeddedMode: assistantMessage.mode,
          toolStatesCount: Object.keys(toolStates || {}).length
        });
        
        finalHistory.push(assistantMessage);

        // Add tool results as separate message (required for conversation flow)
        if (finalToolResults.length > 0) {
          finalHistory.push({
            role: "tool",
            toolResults: finalToolResults.map((tr: any) => ({
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output)
            })),
            timestamp: Date.now()
          });
        }
      } else if (finalToolCalls.length === 0 && finalToolResults.length === 0) {
        // If no tools were called and no results, check if we switched to planning mode
        // In this case, we should continue the conversation with the information collector
        const modeSwitchToolCall = finalHistory.find(msg => 
          msg.role === "assistant" && 
          msg.toolCalls && 
          msg.toolCalls.some((tc: any) => 
            tc.name === "task" && 
            tc.args?.targetType === "primary-mode" &&
            tc.args?.targetName === "planning"
          )
        );

        if (modeSwitchToolCall) {
          // Check if we have an empty response after mode switch, which indicates the AI didn't respond as expected
          // If finalText is empty but a mode switch occurred, we need to ensure the new mode has a chance to respond
          if (!finalText || finalText.trim() === "") {
            logDebug("Empty response after mode switch to planning - the new mode should respond");
            
            // We don't add a placeholder message here, as the next user input should trigger the planning
            // The mode switching already happened via the task tool, so the context is set for the next turn
          }
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
      
      const compactedHistory = await autoCompactHistory(finalHistory, 50); // New: OpenCode auto-compaction
      const savedConversationId = await ctx.runMutation(api.conversations.upsertConversation, {
        sessionId,
        messages: compactedHistory as any
      });
      
      // MODE PERSISTENCE FIX: Removed embedded mode overwrite that caused reset loop
      // Database mode is now the single source of truth, updated only by switchMode tool
      // This prevents stale embedded metadata from overwriting correct database mode
      
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
      
      // Special handling for planning mode switch
      // If mode switch occurred but no response was generated, provide appropriate default response
      const lastAssistantMessageFinal = finalHistory.filter(msg => msg.role === "assistant").pop();
      if (lastAssistantMessageFinal && lastAssistantMessageFinal.toolCalls) {
        const modeSwitchCall = lastAssistantMessageFinal.toolCalls.find((tc: any) =>
          tc.name === "task" &&
          tc.args?.targetType === "primary-mode" &&
          tc.args?.targetName === "planning"
        );
        
        if (modeSwitchCall && (!finalText || finalText.trim() === "") && finalToolResults.length === 0) {
          // If the mode switch happened via tool call but no AI response was generated,
          // we need to simulate what the planning mode should say
          // In a real scenario, the AI should generate this itself based on mode context
          
          // Look for the original user message that triggered the mode switch
          const userMessage = message; // This is the user's message that triggered the switch
          
          // Generate an appropriate response for planning mode
          // This should ideally be handled by the AI itself, but we provide a fallback
          if (userMessage.toLowerCase().includes("deadline") || userMessage.toLowerCase().includes("work")) {
            cleanResponse = "I'd be happy to help you organize your tasks. When is your work deadline due?";
          } else {
            cleanResponse = "I'm now collecting information to help organize your tasks. When is your work deadline due?";
          }
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
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
        userId: userId.substring(0, 20) + "...",
        sessionId,
        selectedModelId: selectedModelId || 'unknown',
        hasUserConfig: !!userConfig,
        hasApiKey: !!(userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY)
      });
      
      logError(error instanceof Error ? error : new Error(String(error)), "Chat session failed");

      // Enhanced error classification based on error types
      let userFriendlyError = errorMessage;
      let needsSetup = false;
      let isRetriable = false;

      if (error instanceof RateLimitError) {
        // Rate limiting error - provide clear guidance
        const retryInMinutes = error.retryAfter ? Math.ceil(error.retryAfter / 60) : 1;
        userFriendlyError = `⏳ **Rate Limited**: ${error.modelId || 'The model'} is temporarily busy. ` +
                           `Please wait ${retryInMinutes} minute${retryInMinutes !== 1 ? 's' : ''} and try again. ` +
                           `This is normal during peak usage times.`;
        isRetriable = true;
      } else if (error instanceof ProviderAuthError) {
        // Authentication/API key issues
        userFriendlyError = `🔑 **Authentication Error**: ${error.message}. ` +
                           `Please check your API key configuration in the Admin Dashboard.`;
        needsSetup = true;
      } else if (error instanceof ModelNotFoundError) {
        // Model not available
        userFriendlyError = `🔄 **Model Unavailable**: The model "${error.modelId}" is not available on ${error.provider}. ` +
                           `Please select a different model in the Admin Dashboard.`;
        needsSetup = true;
      } else if (errorMessage.includes("No models available")) {
        userFriendlyError = "🔧 **Setup Required**: Please go to Admin Dashboard and fetch models from OpenRouter before chatting.";
        needsSetup = true;
      } else if (errorMessage.includes("OpenRouter API key")) {
        userFriendlyError = "🔑 **API Key Required**: Please configure your OpenRouter API key in the Admin Dashboard.";
        needsSetup = true;
      } else if (errorMessage.includes("Model not found")) {
        userFriendlyError = "🔄 **Model Issue**: Your selected model is no longer available. Please choose a different model in Admin Dashboard.";
        needsSetup = true;
      } else if (errorMessage.includes("Unauthorized")) {
        userFriendlyError = "🔒 **Authentication Required**: Please log in to continue.";
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("rate-limited") || errorMessage.includes("429")) {
        // Catch any other rate limiting patterns that weren't caught by RateLimitError
        userFriendlyError = "⏳ **Rate Limited**: The AI service is temporarily busy. Please wait a moment and try again.";
        isRetriable = true;
      } else if (errorMessage.includes("Failed after") && errorMessage.includes("attempts")) {
        userFriendlyError = "⏱️ **Service Temporarily Unavailable**: The AI service is experiencing high demand. Please try again.";
        isRetriable = true;
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
        content: sanitizedMessage,
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
          isRetriable,
          toolCalls: 0,
          toolResults: 0,
          needsSetup: needsSetup,
          errorType: error instanceof Error ? error.constructor.name : 'unknown',
          retryAfter: error instanceof RateLimitError ? error.retryAfter : undefined
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
 * Following OpenCode's approach, this function injects mode transition messages
 * as synthetic text parts to inform the AI about mode changes
 */
async function injectModePrompts(history: any[], sessionId: string | undefined, currentMode: string, previousMode: string | null): Promise<any[]> {
  logDebug(`Mode prompt injection for mode: ${currentMode}, previous: ${previousMode || 'none'}`);
  
  // Get the mode configuration to check if it has a prompt injection
  const { ModeRegistry } = await import("./modes/registry.js");
  const modeConfig = ModeRegistry.getMode(currentMode);
  const promptInjection = modeConfig?.promptInjection || "Follow mode-specific instructions.";
  
  let modifiedHistory = [...history];
  
  // Check for mode switch
  if (previousMode && currentMode !== previousMode) {
    logDebug(`[PROMPT_INJECTION] Detected switch from ${previousMode} to ${currentMode} for ${sessionId}`);
    
    // Use standard prompt injection without complex context filtering
    let contextualPrompt = promptInjection;
    
    // Create synthetic system message for mode switch
    const switchMessage = {
      role: "system" as const,
      content: `Switched to ${currentMode} mode: ${contextualPrompt}`,
      timestamp: Date.now(),
      metadata: {
        type: "mode-injection",
        mode: currentMode,
        switchFrom: previousMode,
        contextFiltered: false
      }
    };
    
    // Insert before the last user message or at the end
    const lastUserIndex = modifiedHistory.slice().reverse().findIndex(msg => msg.role === "user");
    const insertIndex = lastUserIndex >= 0 ? modifiedHistory.length - lastUserIndex : modifiedHistory.length;
    
    modifiedHistory.splice(insertIndex, 0, switchMessage);
    
    logDebug(`[PROMPT_INJECTION] Injected switch to ${currentMode} for ${sessionId}`);
  } else if (modeConfig && modeConfig.promptInjection) {
    // Fallback: inject if no recent mode prompt (for initial entry)
    const recentHistory = modifiedHistory.slice(-5);
    const hasModePrompt = recentHistory.some(msg =>
      msg.role === "system" &&
      msg.content &&
      msg.metadata?.type === "mode-injection" &&
      msg.metadata?.mode === currentMode
    );
    
    if (!hasModePrompt) {
      const modePromptMessage = {
        role: "system" as const,
        content: promptInjection,
        timestamp: Date.now(),
        metadata: {
          type: "mode-injection",
          mode: currentMode
        }
      };
      
      // Append at end for initial injection
      modifiedHistory.push(modePromptMessage);
      logDebug(`Injected initial mode prompt for ${currentMode}`);
    }
  }
  
  // Always return modified history (even if unchanged)
  return modifiedHistory;
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
async function updateToolStates(toolCalls: any[], toolResults: any[]): Promise<Record<string, 'pending'|'running'|'completed'>> {
  const toolStates: Record<string, 'pending' | 'running' | 'completed'> = {};
  toolCalls.forEach(tc => toolStates[tc.toolName] = 'running' as const);
  toolResults.forEach(tr => toolStates[tr.toolName] = 'completed' as const);
  return toolStates;
}