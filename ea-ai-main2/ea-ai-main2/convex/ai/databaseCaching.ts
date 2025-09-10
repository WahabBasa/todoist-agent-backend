"use node";

// Database-backed caching system for Convex stateless environment
// Replaces in-memory Maps to enable consistent request payloads for Anthropic ephemeral caching

import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { ModelMessage } from "ai";
import { createHash } from "crypto";

export namespace DatabaseCaching {
  
  /**
   * Create a deterministic cache key for content
   */
  export function createCacheKey(
    type: "mental_model" | "custom_prompt" | "system_prompt" | "tool_result" | "request_payload",
    userId: string,
    additionalData?: string,
    sessionId?: string
  ): string {
    const components = [type, userId];
    if (sessionId) components.push(sessionId);
    if (additionalData) components.push(additionalData);
    
    return createHash("sha256")
      .update(components.join("-"))
      .digest("hex")
      .substring(0, 32); // 32 chars for readability
  }

  /**
   * Create content hash for fast comparison
   */
  export function createContentHash(content: string): string {
    return createHash("sha256")
      .update(content)
      .digest("hex");
  }

  /**
   * Calculate TTL based on cache type
   */
  export function calculateTTL(
    type: "mental_model" | "custom_prompt" | "system_prompt" | "tool_result" | "request_payload"
  ): number {
    const now = Date.now();
    const ttlMap = {
      mental_model: 10 * 60 * 1000,    // 10 minutes
      custom_prompt: 10 * 60 * 1000,   // 10 minutes  
      system_prompt: 5 * 60 * 1000,    // 5 minutes
      tool_result: 2 * 60 * 1000,      // 2 minutes
      request_payload: 30 * 60 * 1000  // 30 minutes
    };
    
    return now + ttlMap[type];
  }
}

// Query: Get cached content by cache key
export const getCachedContent = query({
  args: { 
    cacheKey: v.string() 
  },
  handler: async (ctx, { cacheKey }): Promise<{ content: string; contentHash: string; metadata: any; hitCount: number; _id: string } | null> => {
    const cached = await ctx.db
      .query("aiCache")
      .withIndex("by_cache_key", (q: any) => q.eq("cacheKey", cacheKey))
      .first();

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      return null; // Expired entries will be cleaned up by separate cleanup process
    }

    return {
      content: cached.content,
      contentHash: cached.contentHash,
      metadata: cached.metadata,
      hitCount: cached.hitCount,
      _id: cached._id // Include ID for hit count update
    };
  }
});

// Mutation: Update hit count for cache entry
export const updateCacheHitCount = mutation({
  args: {
    cacheId: v.id("aiCache")
  },
  handler: async (ctx, { cacheId }): Promise<void> => {
    const cached = await ctx.db.get(cacheId);
    if (cached) {
      await ctx.db.patch(cacheId, {
        hitCount: cached.hitCount + 1,
        updatedAt: Date.now()
      });
    }
  }
});

// Mutation: Store content in cache
export const setCachedContent = mutation({
  args: {
    cacheKey: v.string(),
    cacheType: v.union(
      v.literal("mental_model"), 
      v.literal("custom_prompt"), 
      v.literal("system_prompt"),
      v.literal("tool_result"),
      v.literal("request_payload")
    ),
    tokenIdentifier: v.string(),
    sessionId: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(v.object({
      promptName: v.optional(v.string()),
      toolName: v.optional(v.string()),
      args: v.optional(v.any()),
      contextLength: v.optional(v.number()),
    }))
  },
  handler: async (ctx, { cacheKey, cacheType, tokenIdentifier, sessionId, content, metadata }): Promise<string> => {
    const contentHash = DatabaseCaching.createContentHash(content);
    const expiresAt = DatabaseCaching.calculateTTL(cacheType);
    const now = Date.now();

    // Check if entry already exists
    const existing = await ctx.db
      .query("aiCache")
      .withIndex("by_cache_key", (q: any) => q.eq("cacheKey", cacheKey))
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        content,
        contentHash,
        metadata,
        updatedAt: now,
        expiresAt
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert("aiCache", {
        cacheKey,
        cacheType,
        tokenIdentifier,
        sessionId,
        content,
        contentHash,
        metadata,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        hitCount: 0
      });
    }
  }
});

// Action: Get user mental model with database caching  
export const getUserMentalModelCached = action({
  args: { 
    tokenIdentifier: v.string() 
  },
  handler: async (ctx, { tokenIdentifier }): Promise<{ content: string; fromCache: boolean; hitCount: number }> => {
    const cacheKey = DatabaseCaching.createCacheKey("mental_model", tokenIdentifier);
    
    // Try cache first
    const cached = await ctx.runQuery(api.ai.databaseCaching.getCachedContent, { cacheKey });
    if (cached) {
      return {
        content: cached.content,
        fromCache: true,
        hitCount: cached.hitCount
      };
    }

    // Cache miss - fetch from database
    const mentalModelData = await ctx.runQuery(api.mentalModels.getUserMentalModel, {
      tokenIdentifier,
    });

    let content: string;
    if (mentalModelData.exists && mentalModelData.content) {
      content = `<user_mental_model>
${mentalModelData.content}
</user_mental_model>`;
    } else {
      content = `<user_mental_model>
No user mental model found - AI should create one by observing behavioral patterns in conversation.
Use readUserMentalModel and editUserMentalModel tools to learn and update user preferences.
</user_mental_model>`;
    }

    // Cache the result
    await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
      cacheKey,
      cacheType: "mental_model",
      tokenIdentifier,
      content,
      metadata: {
        contextLength: content.length
      }
    });

    return {
      content,
      fromCache: false,
      hitCount: 0
    };
  }
});

// Query: Get custom prompt from database (helper for action)
export const getCustomPromptFromDB = query({
  args: {
    tokenIdentifier: v.string()
  },
  handler: async (ctx, { tokenIdentifier }): Promise<string> => {
    const customPrompts = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier_and_active", (q: any) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true))
      .first();

    return customPrompts?.content || "";
  }
});

// Action: Get custom prompt with database caching
export const getCustomPromptCached = action({
  args: { 
    tokenIdentifier: v.string(),
    promptName: v.optional(v.string())
  },
  handler: async (ctx, { tokenIdentifier, promptName = "active" }): Promise<{ content: string; fromCache: boolean; hitCount: number }> => {
    const cacheKey = DatabaseCaching.createCacheKey("custom_prompt", tokenIdentifier, promptName);
    
    // Try cache first
    const cached = await ctx.runQuery(api.ai.databaseCaching.getCachedContent, { cacheKey });
    if (cached) {
      return {
        content: cached.content,
        fromCache: true,
        hitCount: cached.hitCount
      };
    }

    // Cache miss - fetch from database via helper query
    const content = await ctx.runQuery(api.ai.databaseCaching.getCustomPromptFromDB, {
      tokenIdentifier
    });

    // Cache the result (even if empty)
    await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
      cacheKey,
      cacheType: "custom_prompt",
      tokenIdentifier,
      content,
      metadata: {
        promptName,
        contextLength: content.length
      }
    });

    return {
      content,
      fromCache: false,
      hitCount: 0
    };
  }
});

// Mutation: Store tool result in cache
export const cacheToolResult = mutation({
  args: {
    toolName: v.string(),
    args: v.any(),
    result: v.any(),
    sessionId: v.string(),
    tokenIdentifier: v.string()
  },
  handler: async (ctx, { toolName, args, result, sessionId, tokenIdentifier }): Promise<string> => {
    const argsHash = DatabaseCaching.createContentHash(JSON.stringify(args, Object.keys(args).sort()));
    const cacheKey = DatabaseCaching.createCacheKey("tool_result", tokenIdentifier, `${toolName}-${argsHash}`, sessionId);
    
    const content = JSON.stringify(result);
    
    return await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
      cacheKey,
      cacheType: "tool_result",
      tokenIdentifier,
      sessionId,
      content,
      metadata: {
        toolName,
        args,
        contextLength: content.length
      }
    });
  }
});

// Query: Get cached tool result
export const getCachedToolResult = query({
  args: {
    toolName: v.string(),
    args: v.any(),
    sessionId: v.string(),
    tokenIdentifier: v.string()
  },
  handler: async (ctx, { toolName, args, sessionId, tokenIdentifier }): Promise<{ result: any; fromCache: boolean; hitCount: number } | null> => {
    const argsHash = DatabaseCaching.createContentHash(JSON.stringify(args, Object.keys(args).sort()));
    const cacheKey = DatabaseCaching.createCacheKey("tool_result", tokenIdentifier, `${toolName}-${argsHash}`, sessionId);
    
    const cached = await ctx.runQuery(api.ai.databaseCaching.getCachedContent, { cacheKey });
    if (cached) {
      return {
        result: JSON.parse(cached.content),
        fromCache: true,
        hitCount: cached.hitCount
      };
    }
    
    return null;
  }
});

// Action: Create consistent request payload for Anthropic caching
export const createConsistentRequestPayload = action({
  args: {
    tokenIdentifier: v.string(),
    sessionId: v.optional(v.string()),
    messages: v.array(v.any()), // ModelMessage[] (simplified for Convex)
    model: v.string(),
    useHaiku: v.boolean()
  },
  handler: async (ctx, { tokenIdentifier, sessionId, messages, model, useHaiku }): Promise<{ requestPayload: any; payloadHash: string; cacheKey: string; cacheStats: any }> => {
    // Create a stable, deterministic request payload
    // This ensures byte-for-byte identical requests for Anthropic caching

    // 1. Get cached mental model
    const mentalModel = await ctx.runAction(api.ai.databaseCaching.getUserMentalModelCached, {
      tokenIdentifier
    });

    // 2. Get cached custom prompt
    const customPrompt = await ctx.runAction(api.ai.databaseCaching.getCustomPromptCached, {
      tokenIdentifier
    });

    // 3. Create stable system prompt (avoiding dynamic elements)
    const systemPromptComponents = [
      "You are Claude, an AI assistant built by Anthropic.",
      "You are a helpful AI assistant integrated with task management.",
      "Current context: Task management and productivity assistance.",
      mentalModel.content,
      customPrompt.content
    ].filter(Boolean);

    // 4. Create consistent message array
    const consistentMessages: any[] = [
      {
        role: "system",
        content: systemPromptComponents.join("\n\n"),
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } }
        }
      },
      ...messages.slice(-20) // Keep last 20 messages for context
    ];

    // Apply cache control to final messages for Anthropic ephemeral caching
    if (consistentMessages.length >= 2) {
      const lastTwoMessages = consistentMessages.slice(-2);
      lastTwoMessages.forEach(msg => {
        if (Array.isArray(msg.content)) {
          const lastContent = msg.content[msg.content.length - 1];
          if (lastContent && typeof lastContent === "object") {
            lastContent.experimental_providerMetadata = {
              anthropic: { cacheControl: { type: "ephemeral" } }
            };
          }
        } else {
          msg.experimental_providerMetadata = {
            anthropic: { cacheControl: { type: "ephemeral" } }
          };
        }
      });
    }

    const requestPayload = {
      model,
      max_tokens: 4000,
      messages: consistentMessages,
      extra_headers: {
        "anthropic-beta": "prompt-caching-2024-07-31"
      }
    };

    // 5. Cache the payload for deduplication
    const payloadHash = DatabaseCaching.createContentHash(JSON.stringify(requestPayload));
    const cacheKey = DatabaseCaching.createCacheKey("request_payload", tokenIdentifier, payloadHash, sessionId);
    
    await ctx.runMutation(api.ai.databaseCaching.setCachedContent, {
      cacheKey,
      cacheType: "request_payload", 
      tokenIdentifier,
      sessionId,
      content: JSON.stringify(requestPayload),
      metadata: {
        contextLength: consistentMessages.length
      }
    });

    return {
      requestPayload,
      payloadHash,
      cacheKey,
      cacheStats: {
        mentalModelFromCache: mentalModel.fromCache,
        customPromptFromCache: customPrompt.fromCache,
        totalCacheHits: (mentalModel.fromCache ? 1 : 0) + (customPrompt.fromCache ? 1 : 0)
      }
    };
  }
});

// Mutation: Cleanup expired cache entries
export const cleanupExpiredCache = mutation({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number; cleanupTime: number }> => {
    const now = Date.now();
    
    // Find expired entries
    const expired = await ctx.db
      .query("aiCache")
      .withIndex("by_expiration", (q: any) => q.lt("expiresAt", now))
      .collect();

    // Delete expired entries
    let deletedCount = 0;
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    // Cleanup request deduplication
    const expiredRequests = await ctx.db
      .query("requestDeduplication")
      .withIndex("by_expiration", (q: any) => q.lt("expiresAt", now))
      .collect();

    for (const entry of expiredRequests) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return {
      deletedCount,
      cleanupTime: Date.now()
    };
  }
});

// Query: Get cache statistics
export const getCacheStats = query({
  args: { 
    tokenIdentifier: v.string(),
    date: v.optional(v.string()) // YYYY-MM-DD format
  },
  handler: async (ctx, { tokenIdentifier, date }): Promise<{ date: string; cacheHits: number; cacheMisses: number; mentalModelHits: number; customPromptHits: number; toolCallHits: number; requestPayloadHits: number; totalRequests: number; tokensSaved: number; cacheEfficiency: number }> => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const stats = await ctx.db
      .query("cacheAnalytics")
      .withIndex("by_user_and_date", (q: any) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("date", targetDate))
      .first();

    if (!stats) {
      return {
        date: targetDate,
        cacheHits: 0,
        cacheMisses: 0,
        mentalModelHits: 0,
        customPromptHits: 0,
        toolCallHits: 0,
        requestPayloadHits: 0,
        totalRequests: 0,
        tokensSaved: 0,
        cacheEfficiency: 0
      };
    }

    const cacheEfficiency = stats.totalRequests > 0 
      ? (stats.cacheHits / stats.totalRequests * 100) 
      : 0;

    return {
      ...stats,
      cacheEfficiency: Math.round(cacheEfficiency * 100) / 100
    };
  }
});