import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

const CACHE_TTL = 3600000; // 1 hour in ms

// Internal mutation to cache models
export const internalCacheModels = mutation({
  args: {
    models: v.array(v.object({
      id: v.string(),
      name: v.string(),
      provider: v.object({ id: v.string() }),
      context_window: v.number(),
      max_input_tokens: v.number(),
      max_output_tokens: v.number(),
      pricing: v.optional(v.any()),
      category: v.optional(v.string())
    })),
    lastFetched: v.number()
  },
  handler: async (ctx, { models, lastFetched }) => {
    const results = await ctx.db.query("cachedModels").collect();
    const existing = results[0];
    if (existing) {
      await ctx.db.patch(existing._id, { lastFetched, models });
    } else {
      await ctx.db.insert("cachedModels", { lastFetched, models });
    }
  }
});

// Helper to derive category from model name
export function deriveCategory(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("claude") || lowerName.includes("anthropic")) {
    return "Anthropic";
  }
  if (lowerName.includes("gpt") || lowerName.includes("openai")) {
    return "OpenAI";
  }
  if (lowerName.includes("llama") || lowerName.includes("meta")) {
    return "Meta";
  }
  if (lowerName.includes("gemini") || lowerName.includes("google")) {
    return "Google";
  }
  if (lowerName.includes("mistral")) {
    return "Mistral";
  }
  if (lowerName.includes("command") || lowerName.includes("cohere")) {
    return "Cohere";
  }
  return "Other";
}

// Helper to get user tokenIdentifier from auth
async function getTokenIdentifier(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.tokenIdentifier || identity.subject;
}

// Query to get user config
export const getUserConfig = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    return await ctx.db.query("systemConfig").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier)).first();
  }
});

// Query: getModels - admin only
export const getModels = query({
  args: {},
  handler: async (ctx) => {
    // Use new secure admin check (no tokenIdentifier needed)
    const isAdmin = await ctx.runQuery(api.auth.admin.isCurrentUserAdmin, {});
    
    // Get current user info for logging
    const identity = await ctx.auth.getUserIdentity();
    const userInfo = identity ? `${identity.subject?.slice(0, 20)}... (${identity.email})` : "unknown";
    
    console.log(`🔐 [Admin] Admin panel access attempt: ${userInfo} (isAdmin: ${isAdmin})`);
    
    if (!isAdmin) {
      console.log(`❌ [Admin] Access denied for non-admin user: ${userInfo}`);
      throw new Error("Admin access required");
    }

    const results = await ctx.db.query("cachedModels").collect();
    const cached = results[0];
    const cacheAge = cached ? Math.floor((Date.now() - cached.lastFetched) / (1000 * 60)) : null;
    
    if (cached && Date.now() - cached.lastFetched < CACHE_TTL) {
      console.log(`💾 [Models] Cache HIT: ${cached.models.length} models, ${cacheAge} minutes old`);
      return cached.models;
    } else {
      console.log(`💾 [Models] Cache MISS: ${cacheAge ? `${cacheAge} minutes old (expired)` : 'no cache found'}`);
      return [];
    }
  }
});

// Mutation: setActiveModel
export const setActiveModel = mutation({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const tokenIdentifier = await getTokenIdentifier(ctx);

    // Validate modelId against cached models
    const results = await ctx.db.query("cachedModels").collect();
    const cached = results[0];
    if (!cached || !cached.models.some((m: any) => m.id === modelId)) {
      throw new Error("Invalid model ID. Fetch models first.");
    }

    // Upsert in systemConfig
    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        activeModelId: modelId,
        updatedAt: now
      });
    } else {
      await ctx.db.insert("systemConfig", {
        tokenIdentifier,
        activeModelId: modelId,
        updatedAt: now,
        isAdmin: false // default
      });
    }
  }
});