"use node";

import { ActionCtx, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";
import { SubagentRegistry } from "./registry";
import { createSimpleToolRegistry } from "../toolRegistry";
import { streamText, stepCountIs } from "ai";

const KNOWN_INVALID_PROVIDER_SLUGS = new Set([
  "web_search",
  "internal_reasoning",
  "prompt",
  "completion",
  "request",
  "image",
  "image_output",
  "cache_read",
  "cache_write",
  "discount"
]);

/**
 * Subagent Execution Engine
 * Implements OpenCode-style isolated subagent execution in Convex
 */

export interface SubagentExecutionResult {
  subagentName: string;
  executionTimeMs: number;
  result: string;
  toolCallsCount: number;
  sessionId: string;
  success: boolean;
  error?: string;
}

export interface SubagentExecutionContext {
  userId: string;
  parentSessionId: Id<"chatSessions">;
  sessionId: Id<"chatSessions">;
  currentTimeContext: string;
}

/**
 * Create isolated subagent conversation (like OpenCode's Session.create)
 */
export async function createSubagentSession(
  ctx: ActionCtx,
  {
    userId,
    parentSessionId,
    subagentName,
    delegatedTask,
  }: {
    userId: string;
    parentSessionId: Id<"chatSessions">;
    subagentName: string;
    delegatedTask: string;
  }
): Promise<Id<"chatSessions">> {
  // Validate subagent exists
  const subagentConfig = SubagentRegistry.getSubagent(subagentName);
  if (!subagentConfig) {
    throw new Error(`Unknown subagent: ${subagentName}`);
  }

  // Create isolated conversation session
  const subagentSessionId = await ctx.runMutation(api.chatSessions.create, {
    tokenIdentifier: userId,
    title: `${subagentName} subagent`,
    sessionType: "subagent",
    subagentType: subagentName,
    parentSessionId,
    delegationContext: {
      delegatedTask,
      delegationType: "subagent",
      targetName: subagentName,
      createdAt: Date.now(),
      status: "running",
    },
  });

  console.log(`[SUBAGENT_SESSION] Created isolated session ${subagentSessionId} for ${subagentName}`);
  return subagentSessionId;
}

/**
 * Execute subagent in complete isolation (like OpenCode's pattern)
 */
export async function executeSubagent(
  ctx: ActionCtx,
  {
    subagentName,
    prompt,
    parentSessionId,
    userId,
    currentTimeContext,
  }: {
    subagentName: string;
    prompt: string;
    parentSessionId: Id<"chatSessions">;
    userId: string;
    currentTimeContext: string;
  }
): Promise<SubagentExecutionResult> {
  const executionStartTime = Date.now();

  try {
    // 1. Get subagent configuration
    const subagentConfig = SubagentRegistry.getSubagent(subagentName);
    if (!subagentConfig) {
      throw new Error(`Unknown subagent: ${subagentName}`);
    }

    // 2. Create isolated conversation (like OpenCode Session.create)
    const subagentSessionId = await createSubagentSession(ctx, {
      userId,
      parentSessionId,
      subagentName,
      delegatedTask: prompt,
    });

    // 3. Create tool registry filtered for this subagent
    const subagentContext: SubagentExecutionContext = {
      userId,
      parentSessionId,
      sessionId: subagentSessionId,
      currentTimeContext,
    };

    const filteredTools = await createFilteredToolsForSubagent(
      ctx,
      subagentConfig,
      subagentContext
    );

    console.log(`[SUBAGENT_EXECUTION] Starting ${subagentName} with ${Object.keys(filteredTools).length} tools`);

    // 4. Get user's provider configuration and create OpenRouter client for isolated execution
    const userConfig = await ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier: userId });
    const apiKey = userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error("OpenRouter API key is required. Please configure it in the admin dashboard.");
    }

    // Model selection: Subagent override OR dashboard selection (NO fallback)
    const model = subagentConfig.model?.modelId || userConfig?.activeModelId;
    
    if (!model) {
      throw new Error("No model selected. Please select a model in the Admin Dashboard.");
    }
    
    console.log(`🎯 [SUBAGENT_MODEL] Using model for ${subagentName}: ${model} (source: ${subagentConfig.model?.modelId ? 'subagent-config' : 'dashboard'})`);
    
    let lockedProvider = userConfig?.openRouterSpecificProvider?.trim() || undefined;
    if (lockedProvider && lockedProvider.length === 0) {
      lockedProvider = undefined;
    }

    let providerPreferenceCleared = false;
    const persistProviderReset = async () => {
      if (!userConfig || providerPreferenceCleared) {
        return;
      }
      providerPreferenceCleared = true;
      try {
        await ctx.runMutation(api.providers.unified.setProviderConfig, {
          apiProvider: userConfig.apiProvider || "openrouter",
          openRouterApiKey: userConfig.openRouterApiKey,
          openRouterModelId: userConfig.openRouterModelId,
          openRouterBaseUrl: userConfig.openRouterBaseUrl,
          openRouterSpecificProvider: undefined,
          openRouterUseMiddleOutTransform: userConfig.openRouterUseMiddleOutTransform,
          googleProjectId: userConfig.googleProjectId,
          googleRegion: userConfig.googleRegion,
          googleCredentials: userConfig.googleCredentials,
          googleModelId: userConfig.googleModelId,
          googleEnableUrlContext: userConfig.googleEnableUrlContext,
          googleEnableGrounding: userConfig.googleEnableGrounding,
          googleEnableReasoning: userConfig.googleEnableReasoning,
          activeModelId: userConfig.activeModelId,
        });
        console.log(`🔁 [SUBAGENT_MODEL] Cleared OpenRouter provider override for ${model}`);
        try {
          const refreshedConfig = await ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier: userId });
          const stillLocked = refreshedConfig?.openRouterSpecificProvider;
          if (stillLocked) {
            console.warn(`[SUBAGENT_MODEL] Provider override persisted after reset attempt: ${stillLocked}`);
          } else {
            console.log(`[SUBAGENT_MODEL] Provider override successfully cleared for ${model}`);
          }
        } catch (recheckError) {
          console.warn(`[SUBAGENT_MODEL] Failed to verify provider override reset: ${recheckError instanceof Error ? recheckError.message : recheckError}`);
        }
      } catch (mutationError) {
        console.warn(`⚠️ [SUBAGENT_MODEL] Failed to persist provider override reset:`, mutationError);
      }
    };

    if (lockedProvider) {
      const lowerLockedProvider = lockedProvider.toLowerCase();
      if (KNOWN_INVALID_PROVIDER_SLUGS.has(lowerLockedProvider)) {
        console.warn(`⚠️ [SUBAGENT_MODEL] Ignoring invalid provider override "${lockedProvider}" for ${model}`);
        lockedProvider = undefined;
        await persistProviderReset();
      } else {
        try {
          const detailedInfo = await ctx.runQuery(api.providers.openrouterDetailed.getCachedDetailedModelInfo, { modelId: model });
          if (detailedInfo?.providerSlugs && detailedInfo.providerSlugs.length > 0) {
            const validSlugs = new Set(detailedInfo.providerSlugs.map((slug: string) => slug.toLowerCase()));
            if (!validSlugs.has(lowerLockedProvider)) {
              console.warn(`⚠️ [SUBAGENT_MODEL] Provider "${lockedProvider}" unavailable for ${model}, reverting to automatic routing`);
              lockedProvider = undefined;
              await persistProviderReset();
            }
          }
        } catch (validationError) {
          console.warn(`⚠️ [SUBAGENT_MODEL] Failed to validate provider override "${lockedProvider}":`, validationError);
        }
      }
    }

    const baseURL = userConfig?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    const buildProviderPreferences = (slug?: string) => slug && slug.length > 0
      ? { provider: { order: [slug], allow_fallbacks: false } }
      : { provider: { sort: "throughput" } };

    const createClient = (slug?: string) => createOpenRouter({
      apiKey,
      baseURL,
      extraBody: buildProviderPreferences(slug),
    });

    let openrouterClient = createClient(lockedProvider);
    console.info(`[SUBAGENT_MODEL] Prepared client for ${subagentName} (${model}) with routing:`, buildProviderPreferences(lockedProvider));

    const executeStream = async (client: ReturnType<typeof createOpenRouter>) => {
      return streamText({
        model: client.chat(model),
        messages: [
          {
            role: "system",
            content: SubagentRegistry.getSystemPrompt(subagentName),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        tools: filteredTools,
        temperature: subagentConfig.temperature || 0.3,
        maxRetries: 3,
        stopWhen: stepCountIs(12),
      });
    };

    const isNoEndpointsError = (err: unknown) => {
      if (!(err instanceof Error)) {
        return false;
      }
      const message = err.message || "";
      const statusCode = (err as any)?.statusCode;
      return message.toLowerCase().includes("no endpoints found") || statusCode === 404;
    };

    let result;

    const attemptRouting = lockedProvider ? "locked" : "auto";
    console.info(`[SUBAGENT_MODEL] Executing stream for ${subagentName} (${model}) routing=${attemptRouting}`);
    try {
      result = await executeStream(openrouterClient);
    } catch (error) {
      console.warn(`[SUBAGENT_MODEL] Stream error routing=${attemptRouting}:`, error);
      if (isNoEndpointsError(error)) {
        if (lockedProvider) {
          console.warn(`⚠️ [SUBAGENT_MODEL] Provider "${lockedProvider}" returned no endpoints. Clearing override and falling back.`);
          await persistProviderReset();
          lockedProvider = undefined;
        }
        openrouterClient = createClient();
        const fallbackRouting = buildProviderPreferences();
        console.info(`[SUBAGENT_MODEL] Retrying ${model} with automatic routing preferences:`, fallbackRouting);
        result = await executeStream(openrouterClient);
      } else {
        throw error;
      }
    }

    // 6. Get final results
    const finalText = await result.text;
    const finalToolCalls = await result.toolCalls;
    const executionTime = Date.now() - executionStartTime;

    // 7. Update subagent session with completion
    await ctx.runMutation(api.chatSessions.updateDelegationStatus, {
      sessionId: subagentSessionId,
      status: "completed",
      result: finalText || "Subagent completed successfully",
    });

    // 8. Store conversation in isolated session
    await ctx.runMutation(api.conversations.upsertConversation, {
      sessionId: subagentSessionId,
      messages: [
        {
          role: "user",
          content: prompt,
          timestamp: executionStartTime,
        },
        {
          role: "assistant",
          content: finalText || "Task completed successfully",
          toolCalls: finalToolCalls.map(tc => ({
            name: tc.toolName,
            args: tc.input,
            toolCallId: tc.toolCallId,
          })),
          timestamp: Date.now(),
        },
      ],
    });

    console.log(`[SUBAGENT_COMPLETED] ${subagentName} completed in ${executionTime}ms`);

    return {
      subagentName,
      executionTimeMs: executionTime,
      result: finalText || "Task completed successfully",
      toolCallsCount: finalToolCalls.length,
      sessionId: subagentSessionId,
      success: true,
    };

  } catch (error) {
    const executionTime = Date.now() - executionStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[SUBAGENT_ERROR] ${subagentName} failed after ${executionTime}ms:`, errorMessage);

    // Try to update session status if session was created
    try {
      // This might fail if session creation failed, but that's ok
      const failedSessionId = await createSubagentSession(ctx, {
        userId,
        parentSessionId,
        subagentName,
        delegatedTask: prompt,
      });
      
      await ctx.runMutation(api.chatSessions.updateDelegationStatus, {
        sessionId: failedSessionId,
        status: "failed",
        result: `Execution failed: ${errorMessage}`,
      });
    } catch {
      // Ignore session update errors
    }

    return {
      subagentName,
      executionTimeMs: executionTime,
      result: `Subagent execution failed: ${errorMessage}`,
      toolCallsCount: 0,
      sessionId: "",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create filtered tool registry for subagent (like OpenCode's tool filtering)
 */
async function createFilteredToolsForSubagent(
  ctx: ActionCtx,
  subagentConfig: any,
  subagentContext: SubagentExecutionContext
): Promise<Record<string, any>> {
  try {
    // Create full tool registry first
    const allTools = await createSimpleToolRegistry(
      ctx,
      subagentContext.userId,
      subagentContext.currentTimeContext,
      subagentContext.sessionId
    );

    // Filter tools based on subagent permissions
    const filteredTools: Record<string, any> = {};
    const subagentTools = subagentConfig.tools;

    for (const [toolName, tool] of Object.entries(allTools)) {
      // Ensure subagents cannot use task tool (prevent recursion)
      if (toolName === "task") {
        continue;
      }

      // Check if subagent has permission for this tool
      if (subagentTools[toolName] === true) {
        filteredTools[toolName] = tool;
      }
    }

    console.log(`[SUBAGENT_TOOLS] Created ${Object.keys(filteredTools).length} filtered tools for ${subagentConfig.name}`);
    return filteredTools;

  } catch (error) {
    console.error(`[SUBAGENT_TOOLS_ERROR] Failed to create filtered tools for ${subagentConfig.name}:`, error);
    return {};
  }
}

/**
 * Get subagent execution history for a parent session
 */
export async function getSubagentExecutionHistory(
  ctx: ActionCtx,
  parentSessionId: Id<"chatSessions">
): Promise<Array<{
  sessionId: string;
  subagentName: string;
  delegatedTask: string;
  status: string;
  result?: string;
  createdAt: number;
}>> {
  const subagentSessions = await ctx.runQuery(api.chatSessions.getSubagentSessions, {
    parentSessionId,
  });

  return subagentSessions.map((session: Doc<"chatSessions">) => ({
    sessionId: session._id,
    subagentName: session.subagentType || "unknown",
    delegatedTask: session.delegationContext?.delegatedTask || "",
    status: session.delegationContext?.status || "unknown",
    result: session.delegationContext?.result,
    createdAt: session.delegationContext?.createdAt || session.createdAt,
  }));
}

/**
 * Cleanup completed subagent sessions (optional garbage collection)
 */
export async function cleanupCompletedSubagentSessions(
  ctx: ActionCtx,
  parentSessionId: Id<"chatSessions">,
  olderThanMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<number> {
  const cutoffTime = Date.now() - olderThanMs;
  
  const completedSessions = await ctx.runQuery(api.chatSessions.getCompletedSubagentSessions, {
    parentSessionId,
    beforeTimestamp: cutoffTime,
  });

  let cleanedCount = 0;
  for (const session of completedSessions) {
    await ctx.runMutation(api.chatSessions.deleteSession, {
      sessionId: session._id,
    });
    cleanedCount++;
  }

  if (cleanedCount > 0) {
    console.log(`[SUBAGENT_CLEANUP] Cleaned up ${cleanedCount} completed subagent sessions`);
  }

  return cleanedCount;
}

// Expose an action wrapper to avoid importing this Node module from default runtime files
export const executeSubagentAction = action({
  args: {
    subagentName: v.string(),
    prompt: v.string(),
    parentSessionId: v.id("chatSessions"),
    userId: v.string(),
    currentTimeContext: v.optional(v.any()),
  },
  handler: async (ctx, { subagentName, prompt, parentSessionId, userId, currentTimeContext }) => {
    const result = await executeSubagent(ctx as ActionCtx, {
      subagentName,
      prompt,
      parentSessionId,
      userId,
      currentTimeContext: currentTimeContext as any,
    });
    return result;
  },
});