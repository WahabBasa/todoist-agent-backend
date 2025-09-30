import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// OpenRouter provider settings schema
export interface OpenRouterProviderSettings {
  apiProvider: "openrouter";
  openRouterApiKey?: string;
  openRouterModelId?: string;
  openRouterBaseUrl?: string;
  openRouterSpecificProvider?: string;
  openRouterUseMiddleOutTransform?: boolean;
}

// Model information structure
export interface ModelInfo {
  id: string;
  name: string;
  provider: {
    id: string;
  };
  context_window: number;
  max_input_tokens: number;
  max_output_tokens: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  category?: string;
}

// Cached models schema
export const cachedModelsSchema = v.object({
  lastFetched: v.number(),
  models: v.array(v.object({
    id: v.string(),
    name: v.string(),
    provider: v.object({
      id: v.string()
    }),
    context_window: v.number(),
    max_input_tokens: v.number(),
    max_output_tokens: v.number(),
    pricing: v.optional(v.any()),
    category: v.optional(v.string())
  })),
});

// System config schema for user settings
export const systemConfigSchema = v.object({
  tokenIdentifier: v.string(),
  openRouterApiKey: v.optional(v.string()),
  openRouterModelId: v.optional(v.string()),
  openRouterBaseUrl: v.optional(v.string()),
  openRouterSpecificProvider: v.optional(v.string()),
  openRouterUseMiddleOutTransform: v.optional(v.boolean()),
  updatedAt: v.number(),
});

// Query to get user's OpenRouter configuration
export const getUserOpenRouterConfig = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    return await ctx.db.query("systemConfig")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
  }
});

// Mutation to set user's OpenRouter configuration
export const setOpenRouterConfig = mutation({
  args: {
    openRouterApiKey: v.optional(v.string()),
    openRouterModelId: v.optional(v.string()),
    openRouterBaseUrl: v.optional(v.string()),
    openRouterSpecificProvider: v.optional(v.string()),
    openRouterUseMiddleOutTransform: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;
    
    // Upsert in systemConfig
    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        openRouterApiKey: args.openRouterApiKey,
        openRouterModelId: args.openRouterModelId,
        openRouterBaseUrl: args.openRouterBaseUrl,
        openRouterSpecificProvider: args.openRouterSpecificProvider,
        openRouterUseMiddleOutTransform: args.openRouterUseMiddleOutTransform,
        activeModelId: args.openRouterModelId || existing.activeModelId,
        updatedAt: now
      });
    } else {
      await ctx.db.insert("systemConfig", {
        tokenIdentifier,
        openRouterApiKey: args.openRouterApiKey,
        openRouterModelId: args.openRouterModelId,
        openRouterBaseUrl: args.openRouterBaseUrl,
        openRouterSpecificProvider: args.openRouterSpecificProvider,
        openRouterUseMiddleOutTransform: args.openRouterUseMiddleOutTransform,
        activeModelId: args.openRouterModelId,
        updatedAt: now,
        isAdmin: false // default
      });
    }
  }
});

// Action to fetch models from OpenRouter API
export const fetchOpenRouterModels = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;
    
    // Get user's OpenRouter API key
    const userConfig = await ctx.runQuery(api.providers.openrouter.getUserOpenRouterConfig, { tokenIdentifier });
    const apiKey = userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    console.log(`📥 [OpenRouter] Starting API fetch for user: ${tokenIdentifier.slice(0, 20)}...`);

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      console.error(`❌ [OpenRouter] API failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    const models: ModelInfo[] = data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      provider: { id: m.provider?.id || "unknown" },
      context_window: m.context_window || 128000, // default fallback
      max_input_tokens: m.max_input_tokens || 128000,
      max_output_tokens: m.max_output_tokens || 4096,
      pricing: m.pricing,
      category: deriveCategory(m.name)
    }));

    console.log(`✅ [OpenRouter] Successfully fetched ${models.length} models from API`);

    // Cache the models
    const now = Date.now();
    await ctx.runMutation(api.providers.openrouter.cacheOpenRouterModels, { models, lastFetched: now });
    
    console.log(`💾 [OpenRouter] Successfully cached ${models.length} models at ${new Date(now).toISOString()}`);

    return models;
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

// Internal mutation to cache OpenRouter models
export const cacheOpenRouterModels = mutation({
  args: {
    models: v.array(v.object({
      id: v.string(),
      name: v.string(),
      provider: v.object({
        id: v.string()
      }),
      context_window: v.number(),
      max_input_tokens: v.number(),
      max_output_tokens: v.number(),
      pricing: v.optional(v.any()),
      category: v.optional(v.string())
    })),
    lastFetched: v.number()
  },
  handler: async (ctx, { models, lastFetched }) => {
    const results = await ctx.db.query("cachedOpenrouterModels").collect();
    const existing = results[0];
    if (existing) {
      await ctx.db.patch(existing._id, { lastFetched, models });
    } else {
      await ctx.db.insert("cachedOpenrouterModels", { lastFetched, models });
    }
  }
});

// Query to get cached OpenRouter models
export const getCachedOpenRouterModels = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db.query("cachedOpenrouterModels").collect();
    return results[0] || null;
  }
});