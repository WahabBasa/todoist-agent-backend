// OpenCode-inspired caching for Anthropic models via OpenRouter
// Enables Anthropic server-side ephemeral caching by targeting expensive, static content
// Strategy: Cache system prompts (expensive) + recent messages (context continuity)

import { ModelMessage } from "ai";

export namespace MessageCaching {
  
  /**
   * Apply Anthropic ephemeral caching targeting expensive, static content
   * Prioritizes system prompts and substantial content for maximum cache benefit
   */
  export function applyCaching(messages: ModelMessage[], modelName: string): ModelMessage[] {
    if (!Array.isArray(messages)) return [] as ModelMessage[];
    // Only apply to Claude models
    if (!modelName.includes("claude")) {
      return messages;
    }

    // console.log(`[CACHING] Analyzing ${messages.length} messages for caching opportunities`);

    // Priority 1: ALL system messages (these are expensive and static)
    const systemMessages = messages.filter((msg) => msg.role === "system");
    
    // Priority 2: Recent conversation context (last 2 non-system messages)  
    const nonSystemMessages = messages.filter((msg) => msg.role !== "system");
    const recentMessages = nonSystemMessages.slice(-2);

    // Combine for caching (prioritize system messages)
    const messagesToCache = [...systemMessages, ...recentMessages];

    // console.log(`[CACHING] Selected ${messagesToCache.length} messages for caching (${systemMessages.length} system + ${recentMessages.length} recent)`);

    // OpenRouter's cache_control syntax for Anthropic ephemeral caching
    const providerOptions = {
      openrouter: {
        cache_control: { type: "ephemeral" },
      },
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    };

    // Apply cache control to selected messages
    for (const msg of messagesToCache) {
      // console.log(`[CACHING] Applying cache control to ${msg.role} message`);

      const shouldUseContentOptions = Array.isArray(msg.content) && msg.content.length > 0;

      if (shouldUseContentOptions) {
        // Apply to last content item for multipart messages
        const lastContent = msg.content[msg.content.length - 1];
        if (lastContent && typeof lastContent === "object") {
          (lastContent as any).providerOptions = {
            ...(lastContent as any).providerOptions,
            ...providerOptions,
          };
          continue;
        }
      }

      // Apply to message level for string content
      (msg as any).providerOptions = {
        ...(msg as any).providerOptions,
        ...providerOptions,
      };
    }

    // console.log(`[CACHING] Applied cache control to ${messagesToCache.length} messages`);
    return messages;
  }

  /**
   * Simple message optimization for context management
   * Keeps conversation manageable while preserving context
   */
  export function optimizeForCaching(messages: ModelMessage[]): ModelMessage[] {
    if (!Array.isArray(messages)) return [] as ModelMessage[];
    const systemMessages = messages.filter(msg => msg.role === "system");
    const conversationMessages = messages.filter(msg => msg.role !== "system");

    // Keep max 2 system messages (for caching efficiency)
    const optimizedSystemMessages = systemMessages.slice(0, 2);

    // For conversation: keep reasonable context (30 messages max)
    let optimizedConversationMessages = conversationMessages;
    const maxMessages = 30;
    
    if (conversationMessages.length > maxMessages) {
      // Keep first 3 (context) + recent 80% of remaining
      const firstMessages = conversationMessages.slice(0, 3);
      const recentMessages = conversationMessages.slice(-Math.floor(maxMessages * 0.8)); 
      optimizedConversationMessages = [...firstMessages, ...recentMessages];
      
      console.log(`[CACHING] Optimized: ${conversationMessages.length} → ${optimizedConversationMessages.length} messages`);
    }

    return [...optimizedSystemMessages, ...optimizedConversationMessages];
  }

  /**
   * Simple logging functions (no database storage)
   * For monitoring cache effectiveness
   */
  export function incrementCacheHit(type: string = 'message'): void {
    console.log(`[Cache] Hit: ${type}`);
  }

  export function incrementCacheMiss(): void {
    console.log(`[Cache] Miss`);
  }

  export function incrementMessagesCached(): void {
    console.log(`[Cache] Message optimized for caching`);
  }

  /**
   * Simple initialization - no complex setup needed
   */
  export function initializeCaching(): void {
    // console.log(`[Cache] OpenRouter + Anthropic ephemeral caching ready`);
  }
}