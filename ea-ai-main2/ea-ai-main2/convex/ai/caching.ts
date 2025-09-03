// OpenCode-inspired message caching system for Todoist Agent Backend
// Implements intelligent prompt caching to reduce token usage and improve performance

import { ModelMessage } from "ai";

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
   * Mental model content caching
   * Avoids file I/O on every request by caching mental model data
   */
  const mentalModelCache = new Map<string, { 
    content: string; 
    timestamp: number; 
    userId: string; 
  }>();

  export function getCachedMentalModel(userId: string): string | null {
    const cached = mentalModelCache.get(userId);
    
    // Cache expires after 10 minutes
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return cached.content;
    }
    
    // Clean expired cache
    mentalModelCache.delete(userId);
    return null;
  }

  export function setCachedMentalModel(userId: string, content: string): void {
    mentalModelCache.set(userId, {
      content,
      timestamp: Date.now(),
      userId
    });
  }

  export function invalidateMentalModelCache(userId: string): void {
    mentalModelCache.delete(userId);
  }

  /**
   * System prompt component caching
   * Caches environment context and other dynamic prompt parts
   */
  const systemPromptCache = new Map<string, {
    content: string;
    timestamp: number;
    key: string;
  }>();

  export function getCachedSystemPromptComponent(key: string): string | null {
    const cached = systemPromptCache.get(key);
    
    // Cache expires after 5 minutes for dynamic content like current date
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.content;
    }
    
    systemPromptCache.delete(key);
    return null;
  }

  export function setCachedSystemPromptComponent(key: string, content: string): void {
    systemPromptCache.set(key, {
      content,
      timestamp: Date.now(),
      key
    });
  }

  /**
   * Tool call result caching
   * Caches identical tool operations within a session timeframe
   */
  const toolCallCache = new Map<string, {
    result: any;
    timestamp: number;
    sessionId: string;
  }>();

  export function createToolCacheKey(
    toolName: string, 
    args: any, 
    sessionId: string
  ): string {
    const argsHash = JSON.stringify(args, Object.keys(args).sort());
    return `${sessionId}-${toolName}-${argsHash}`;
  }

  export function getCachedToolResult(cacheKey: string): any | null {
    const cached = toolCallCache.get(cacheKey);
    
    // Tool results cache for 2 minutes (fresh data for active sessions)
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
      return cached.result;
    }
    
    toolCallCache.delete(cacheKey);
    return null;
  }

  export function setCachedToolResult(cacheKey: string, result: any, sessionId: string): void {
    toolCallCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      sessionId
    });
  }

  /**
   * Cache statistics and monitoring
   */
  export interface CacheStats {
    messagesCached: number;
    cacheHits: number;
    cacheMisses: number;
    mentalModelHits: number;
    toolCallHits: number;
    lastCleanup: number;
  }

  const cacheStats: CacheStats = {
    messagesCached: 0,
    cacheHits: 0,
    cacheMisses: 0,
    mentalModelHits: 0,
    toolCallHits: 0,
    lastCleanup: Date.now()
  };

  export function getCacheStats(): CacheStats {
    return { ...cacheStats };
  }

  export function incrementCacheHit(type: 'message' | 'mental_model' | 'tool_call' = 'message'): void {
    cacheStats.cacheHits++;
    if (type === 'mental_model') cacheStats.mentalModelHits++;
    if (type === 'tool_call') cacheStats.toolCallHits++;
  }

  export function incrementCacheMiss(): void {
    cacheStats.cacheMisses++;
  }

  export function incrementMessagesCached(): void {
    cacheStats.messagesCached++;
  }

  /**
   * Periodic cache cleanup
   * Removes expired entries to prevent memory leaks
   */
  export function cleanupExpiredCache(): void {
    const now = Date.now();
    
    // Clean mental model cache (10 minute expiry)
    for (const [key, value] of Array.from(mentalModelCache.entries())) {
      if (now - value.timestamp > 10 * 60 * 1000) {
        mentalModelCache.delete(key);
      }
    }

    // Clean system prompt cache (5 minute expiry)
    for (const [key, value] of Array.from(systemPromptCache.entries())) {
      if (now - value.timestamp > 5 * 60 * 1000) {
        systemPromptCache.delete(key);
      }
    }

    // Clean tool call cache (2 minute expiry)
    for (const [key, value] of Array.from(toolCallCache.entries())) {
      if (now - value.timestamp > 2 * 60 * 1000) {
        toolCallCache.delete(key);
      }
    }

    cacheStats.lastCleanup = now;
  }

  /**
   * Initialize caching system
   * Sets up periodic cleanup and monitoring
   */
  export function initializeCaching(): void {
    // Run cleanup every 5 minutes
    setInterval(cleanupExpiredCache, 5 * 60 * 1000);
    
    console.log("[Caching] Message caching system initialized");
  }
}