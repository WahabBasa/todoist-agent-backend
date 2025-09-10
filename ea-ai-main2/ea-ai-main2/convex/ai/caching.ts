// Database-backed message caching system for Todoist Agent Backend
// Replaces in-memory Maps with Convex database for stateless environment compatibility
// Enables consistent request payloads for Anthropic ephemeral caching

import { ModelMessage } from "ai";
import { DatabaseCaching } from "./databaseCaching";
import { api } from "../_generated/api";

export namespace MessageCaching {
  
  /**
   * Apply Anthropic ephemeral cache control to messages
   * Based on OpenCode's ProviderTransform.applyCaching pattern
   * Caches system prompts and final conversation messages for efficiency
   */
  export function applyCaching(messages: ModelMessage[]): ModelMessage[] {
    // Separate system messages and conversation messages
    const systemMessages = messages.filter(msg => msg.role === "system").slice(0, 2); // Max 2 system messages
    const conversationMessages = messages.filter(msg => msg.role !== "system");
    const finalMessages = conversationMessages.slice(-2); // Cache last 2 conversation messages

    // Anthropic cache control configuration
    const cacheControl = { type: "ephemeral" as const };

    // Apply caching to system messages and final conversation messages
    const messagesToCache = [...systemMessages, ...finalMessages];
    const uniqueMessages = Array.from(new Set(messagesToCache)); // Remove duplicates

    for (const msg of uniqueMessages) {
      // For messages with content arrays, apply cache control to the last content item
      if (Array.isArray(msg.content) && msg.content.length > 0) {
        const lastContent = msg.content[msg.content.length - 1];
        if (lastContent && typeof lastContent === "object" && "type" in lastContent) {
          (lastContent as any).experimental_providerMetadata = {
            ...((lastContent as any).experimental_providerMetadata || {}),
            anthropic: { cacheControl }
          };
        }
      } else {
        // For string content, apply cache control at message level
        (msg as any).experimental_providerMetadata = {
          ...((msg as any).experimental_providerMetadata || {}),
          anthropic: { cacheControl }
        };
      }
    }

    return messages;
  }

  /**
   * Optimize message selection for caching
   * Implements intelligent conversation compaction while preserving context
   * Updated to preserve more conversation history for better AI context
   */
  export function optimizeForCaching(messages: ModelMessage[]): ModelMessage[] {
    const systemMessages = messages.filter(msg => msg.role === "system");
    const conversationMessages = messages.filter(msg => msg.role !== "system");

    // Keep max 2 system messages (for caching efficiency)
    const optimizedSystemMessages = systemMessages.slice(0, 2);

    // For conversation messages, preserve more context with intelligent selection
    let optimizedConversationMessages = conversationMessages;
    
    // Updated thresholds: preserve more conversation history
    const maxCachedMessages = process.env.MAX_CACHED_MESSAGES ? parseInt(process.env.MAX_CACHED_MESSAGES) : 30;
    
    if (conversationMessages.length > maxCachedMessages) {
      // Preserve conversation flow: first 3 messages + recent 80% of context
      const firstMessages = conversationMessages.slice(0, 3); // Opening context
      const recentMessages = conversationMessages.slice(-Math.floor(maxCachedMessages * 0.8)); 
      optimizedConversationMessages = [...firstMessages, ...recentMessages];
      
      console.log(`[CACHING] Optimized conversation: ${conversationMessages.length} → ${optimizedConversationMessages.length} messages`);
    }

    return [...optimizedSystemMessages, ...optimizedConversationMessages];
  }

  /**
   * Create cache key for conversation state deduplication
   * Prevents identical requests from being processed multiple times
   */
  export function createCacheKey(
    userId: string, 
    message: string, 
    conversationLength: number,
    sessionId?: string
  ): string {
    const userPrefix = userId.substring(0, 20);
    const messageHash = message.substring(0, 50);
    const sessionPrefix = sessionId ? sessionId.substring(0, 8) : "default";
    
    return `${userPrefix}-${sessionPrefix}-${messageHash}-${conversationLength}`;
  }

  /**
   * Check if request is likely a duplicate based on recent cache keys
   * Implements conversation state deduplication
   */
  export function isDuplicateRequest(
    cacheKey: string, 
    recentKeys: Set<string>,
    timeWindow: number = 5 * 60 * 1000 // 5 minutes
  ): boolean {
    return recentKeys.has(cacheKey);
  }

  /**
   * Mental model content caching - Now database-backed
   * Provides consistent data across stateless function invocations
   */
  export async function getCachedMentalModel(ctx: any, userId: string): Promise<{ content: string; fromCache: boolean } | null> {
    try {
      return await ctx.runAction(api.ai.databaseCaching.getUserMentalModelCached, {
        tokenIdentifier: userId
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to get cached mental model:", error);
      return null;
    }
  }

  export async function setCachedMentalModel(ctx: any, userId: string, content: string): Promise<void> {
    try {
      const cacheKey = DatabaseCaching.createCacheKey("mental_model", userId);
      await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
        cacheKey,
        cacheType: "mental_model",
        tokenIdentifier: userId,
        content,
        metadata: {
          contextLength: content.length
        }
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to cache mental model:", error);
    }
  }

  export async function invalidateMentalModelCache(ctx: any, userId: string): Promise<void> {
    // Database entries will expire naturally via TTL
    console.log(`[MessageCaching] Mental model cache invalidation requested for user ${userId.substring(0, 8)}...`);
  }

  /**
   * Custom system prompt content caching - Now database-backed
   * Provides consistent data across stateless function invocations
   */
  export async function getCachedCustomPrompt(ctx: any, userId: string, promptName: string = "active"): Promise<{ content: string; fromCache: boolean } | null> {
    try {
      return await ctx.runAction(api.ai.databaseCaching.getCustomPromptCached, {
        tokenIdentifier: userId,
        promptName
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to get cached custom prompt:", error);
      return null;
    }
  }

  export async function setCachedCustomPrompt(ctx: any, userId: string, content: string, promptName: string = "active"): Promise<void> {
    try {
      const cacheKey = DatabaseCaching.createCacheKey("custom_prompt", userId, promptName);
      await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
        cacheKey,
        cacheType: "custom_prompt",
        tokenIdentifier: userId,
        content,
        metadata: {
          promptName,
          contextLength: content.length
        }
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to cache custom prompt:", error);
    }
  }

  export async function invalidateCustomPromptCache(ctx: any, userId: string): Promise<void> {
    // Database entries will expire naturally via TTL
    console.log(`[MessageCaching] Custom prompt cache invalidation requested for user ${userId.substring(0, 8)}...`);
  }

  /**
   * System prompt component caching - Now database-backed
   * Caches environment context and other dynamic prompt parts
   */
  export async function getCachedSystemPromptComponent(ctx: any, key: string, userId: string): Promise<string | null> {
    try {
      const cacheKey = DatabaseCaching.createCacheKey("system_prompt", userId, key);
      const cached = await ctx.runQuery(api.ai.databaseCaching.getCachedContent, { cacheKey });
      return cached ? cached.content : null;
    } catch (error) {
      console.warn("[MessageCaching] Failed to get cached system prompt component:", error);
      return null;
    }
  }

  export async function setCachedSystemPromptComponent(ctx: any, key: string, content: string, userId: string): Promise<void> {
    try {
      const cacheKey = DatabaseCaching.createCacheKey("system_prompt", userId, key);
      await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
        cacheKey,
        cacheType: "system_prompt",
        tokenIdentifier: userId,
        content,
        metadata: {
          contextLength: content.length
        }
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to cache system prompt component:", error);
    }
  }

  /**
   * Tool call result caching - Now database-backed
   * Caches identical tool operations within a session timeframe
   */
  export function createToolCacheKey(
    toolName: string, 
    args: any, 
    sessionId: string
  ): string {
    const argsHash = DatabaseCaching.createContentHash(JSON.stringify(args, Object.keys(args).sort()));
    return `${sessionId}-${toolName}-${argsHash}`;
  }

  export async function getCachedToolResult(ctx: any, toolName: string, args: any, sessionId: string, userId: string): Promise<any | null> {
    try {
      const result = await ctx.runQuery(api.ai.databaseCaching.getCachedToolResult, {
        toolName,
        args,
        sessionId,
        tokenIdentifier: userId
      });
      return result ? result.result : null;
    } catch (error) {
      console.warn("[MessageCaching] Failed to get cached tool result:", error);
      return null;
    }
  }

  export async function setCachedToolResult(ctx: any, toolName: string, args: any, result: any, sessionId: string, userId: string): Promise<void> {
    try {
      await ctx.runMutation(api.ai.databaseCaching.cacheToolResult, {
        toolName,
        args,
        result,
        sessionId,
        tokenIdentifier: userId
      });
    } catch (error) {
      console.warn("[MessageCaching] Failed to cache tool result:", error);
    }
  }

  /**
   * Cache statistics and monitoring - Now database-backed
   */
  export interface CacheStats {
    messagesCached: number;
    cacheHits: number;
    cacheMisses: number;
    mentalModelHits: number;
    customPromptHits: number;
    toolCallHits: number;
    requestPayloadHits: number;
    totalRequests: number;
    tokensSaved: number;
    cacheEfficiency: number;
    lastCleanup: number;
  }

  export async function getCacheStats(ctx: any, userId: string, date?: string): Promise<CacheStats> {
    try {
      const stats = await ctx.runQuery(api.ai.databaseCaching.getCacheStats, {
        tokenIdentifier: userId,
        date
      });
      return {
        ...stats,
        messagesCached: stats.totalRequests,
        lastCleanup: Date.now()
      };
    } catch (error) {
      console.warn("[MessageCaching] Failed to get cache stats:", error);
      return {
        messagesCached: 0,
        cacheHits: 0,
        cacheMisses: 0,
        mentalModelHits: 0,
        customPromptHits: 0,
        toolCallHits: 0,
        requestPayloadHits: 0,
        totalRequests: 0,
        tokensSaved: 0,
        cacheEfficiency: 0,
        lastCleanup: Date.now()
      };
    }
  }

  // Note: Individual stats tracking now handled by database layer
  export function incrementCacheHit(type: 'message' | 'mental_model' | 'custom_prompt' | 'tool_call' = 'message'): void {
    console.log(`[MessageCaching] Cache hit: ${type}`);
  }

  export function incrementCacheMiss(): void {
    console.log(`[MessageCaching] Cache miss`);
  }

  export function incrementMessagesCached(): void {
    console.log(`[MessageCaching] Message cached`);
  }

  /**
   * Periodic cache cleanup - Now database-backed
   * Removes expired entries to prevent database bloat
   */
  export async function cleanupExpiredCache(ctx: any): Promise<{ deletedCount: number; cleanupTime: number }> {
    try {
      return await ctx.runMutation(api.ai.databaseCaching.cleanupExpiredCache, {});
    } catch (error) {
      console.warn("[MessageCaching] Failed to cleanup expired cache:", error);
      return { deletedCount: 0, cleanupTime: Date.now() };
    }
  }

  /**
   * Initialize caching system - Database-backed version
   * Note: No longer runs on every request to avoid digest's identified issue
   */
  export function initializeCaching(): void {
    // Database caching is always ready - no initialization needed
    // This prevents the log that appeared "with every single message" 
    // which was proof of the stateless environment problem
    
    console.log("[Caching] Database-backed caching system ready (stateless-compatible)");
  }
}