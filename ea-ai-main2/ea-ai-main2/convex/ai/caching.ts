// OpenCode-inspired caching for Anthropic models via OpenRouter
// Enables Anthropic server-side ephemeral caching through strategic cache_control placement

import { ModelMessage } from "ai";

export namespace MessageCaching {
  
  /**
   * Apply Anthropic ephemeral caching using OpenCode's proven strategy
   * Works with OpenRouter using cache_control parameter in providerOptions
   */
  export function applyCaching(messages: ModelMessage[], modelName: string): ModelMessage[] {
    // Only apply to Claude models
    if (!modelName.includes("claude")) {
      return messages;
    }

    // OpenCode's strategy: system prompts (first 2) + recent messages (last 2)
    const system = messages.filter((msg) => msg.role === "system").slice(0, 2);
    const final = messages.filter((msg) => msg.role !== "system").slice(-2);

    // OpenRouter's cache_control syntax (different from direct Anthropic)
    const providerOptions = {
      openrouter: {
        cache_control: { type: "ephemeral" },
      },
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    };

    // Apply cache control to unique messages (avoid duplicates)
    const uniqueMessages = Array.from(new Set([...system, ...final]));
    
    for (const msg of uniqueMessages) {
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

    return messages;
  }

  /**
   * Simple message optimization for context management
   * Keeps conversation manageable while preserving context
   */
  export function optimizeForCaching(messages: ModelMessage[]): ModelMessage[] {
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
    console.log("[Cache] OpenRouter + Anthropic ephemeral caching ready");
  }
}