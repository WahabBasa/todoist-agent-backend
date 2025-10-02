import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Unified provider settings schema following OpenCode approach
export interface ProviderSettings {
  // Provider selection
  apiProvider: "openrouter" | "google" | "vercel-ai-gateway";
  
  // OpenRouter settings
  openRouterApiKey?: string;
  openRouterModelId?: string;
  openRouterBaseUrl?: string;
  openRouterSpecificProvider?: string;
  openRouterUseMiddleOutTransform?: boolean;
  
  // Google Vertex AI settings
  googleProjectId?: string;
  googleRegion?: string;
  googleCredentials?: string;
  googleModelId?: string;
  googleEnableUrlContext?: boolean;
  googleEnableGrounding?: boolean;
  googleEnableReasoning?: boolean;
  
  // Common settings
  activeModelId?: string;
  updatedAt: number;
  isAdmin: boolean;
}

// Model information structure following OpenCode models.dev format
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
  release_date?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context: number;
    output: number;
  };
}

// System config schema for user settings
export const systemConfigSchema = v.object({
  tokenIdentifier: v.string(),
  // Provider selection
  apiProvider: v.optional(v.union(v.literal("openrouter"), v.literal("google"), v.literal("vercel-ai-gateway"))),
  // OpenRouter configuration
  openRouterApiKey: v.optional(v.string()),
  openRouterModelId: v.optional(v.string()),
  openRouterBaseUrl: v.optional(v.string()),
  openRouterSpecificProvider: v.optional(v.string()),
  openRouterUseMiddleOutTransform: v.optional(v.boolean()),
  // Google Vertex AI configuration
  googleProjectId: v.optional(v.string()),
  googleRegion: v.optional(v.string()),
  googleCredentials: v.optional(v.string()),
  googleModelId: v.optional(v.string()),
  googleEnableUrlContext: v.optional(v.boolean()),
  googleEnableGrounding: v.optional(v.boolean()),
  googleEnableReasoning: v.optional(v.boolean()),
  // Common settings
  activeModelId: v.optional(v.string()),
  updatedAt: v.number(),
  isAdmin: v.boolean(),
});

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
    category: v.optional(v.string()),
    release_date: v.optional(v.string()),
    attachment: v.optional(v.boolean()),
    reasoning: v.optional(v.boolean()),
    tool_call: v.optional(v.boolean()),
    cost: v.optional(v.object({
      input: v.number(),
      output: v.number(),
      cache_read: v.optional(v.number()),
      cache_write: v.optional(v.number()),
    })),
    limit: v.optional(v.object({
      context: v.number(),
      output: v.number(),
    })),
  })),
});

// Query to get user's provider configuration
export const getUserProviderConfig = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    return await ctx.db.query("systemConfig")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
  }
});

// Mutation to set user's provider configuration
export const setProviderConfig = mutation({
  args: {
    apiProvider: v.optional(v.union(v.literal("openrouter"), v.literal("google"), v.literal("vercel-ai-gateway"))),
    openRouterApiKey: v.optional(v.string()),
    openRouterModelId: v.optional(v.string()),
    openRouterBaseUrl: v.optional(v.string()),
    openRouterSpecificProvider: v.optional(v.string()),
    openRouterUseMiddleOutTransform: v.optional(v.boolean()),
    googleProjectId: v.optional(v.string()),
    googleRegion: v.optional(v.string()),
    googleCredentials: v.optional(v.string()),
    googleModelId: v.optional(v.string()),
    googleEnableUrlContext: v.optional(v.boolean()),
    googleEnableGrounding: v.optional(v.boolean()),
    googleEnableReasoning: v.optional(v.boolean()),
    activeModelId: v.optional(v.string()),
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
        apiProvider: args.apiProvider,
        openRouterApiKey: args.openRouterApiKey,
        openRouterModelId: args.openRouterModelId,
        openRouterBaseUrl: args.openRouterBaseUrl,
        openRouterSpecificProvider: args.openRouterSpecificProvider,
        openRouterUseMiddleOutTransform: args.openRouterUseMiddleOutTransform,
        googleProjectId: args.googleProjectId,
        googleRegion: args.googleRegion,
        googleCredentials: args.googleCredentials,
        googleModelId: args.googleModelId,
        googleEnableUrlContext: args.googleEnableUrlContext,
        googleEnableGrounding: args.googleEnableGrounding,
        googleEnableReasoning: args.googleEnableReasoning,
        activeModelId: args.activeModelId || existing.activeModelId,
        updatedAt: now
      });
    } else {
      await ctx.db.insert("systemConfig", {
        tokenIdentifier,
        apiProvider: args.apiProvider,
        openRouterApiKey: args.openRouterApiKey,
        openRouterModelId: args.openRouterModelId,
        openRouterBaseUrl: args.openRouterBaseUrl,
        openRouterSpecificProvider: args.openRouterSpecificProvider,
        openRouterUseMiddleOutTransform: args.openRouterUseMiddleOutTransform,
        googleProjectId: args.googleProjectId,
        googleRegion: args.googleRegion,
        googleCredentials: args.googleCredentials,
        googleModelId: args.googleModelId,
        googleEnableUrlContext: args.googleEnableUrlContext,
        googleEnableGrounding: args.googleEnableGrounding,
        googleEnableReasoning: args.googleEnableReasoning,
        activeModelId: args.activeModelId,
        updatedAt: now,
        isAdmin: false // default
      });
    }

    // If caller is admin, also upsert global defaults so non-admin users inherit a working model
    try {
      const adminUserId = process.env.ADMIN_USER_ID;
      const adminEmail = process.env.ADMIN_EMAIL;
      const isUserIdMatch = identity.subject === adminUserId;
      const isEmailMatch = (identity as any).email === adminEmail;
      const isAdmin = !!(isUserIdMatch || isEmailMatch);

      if (isAdmin) {
        const globalToken = "__GLOBAL__";
        const existingGlobal = await ctx.db
          .query("systemConfig")
          .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", globalToken))
          .first();

        const payload = {
          tokenIdentifier: globalToken,
          apiProvider: args.apiProvider,
          openRouterApiKey: args.openRouterApiKey,
          openRouterModelId: args.openRouterModelId,
          openRouterBaseUrl: args.openRouterBaseUrl,
          openRouterSpecificProvider: args.openRouterSpecificProvider,
          openRouterUseMiddleOutTransform: args.openRouterUseMiddleOutTransform,
          googleProjectId: args.googleProjectId,
          googleRegion: args.googleRegion,
          googleCredentials: args.googleCredentials,
          googleModelId: args.googleModelId,
          googleEnableUrlContext: args.googleEnableUrlContext,
          googleEnableGrounding: args.googleEnableGrounding,
          googleEnableReasoning: args.googleEnableReasoning,
          activeModelId: args.activeModelId,
          updatedAt: now,
        } as any;

        if (existingGlobal) {
          await ctx.db.patch(existingGlobal._id, payload);
        } else {
          await ctx.db.insert("systemConfig", { ...payload, isAdmin: false });
        }
      }
    } catch (e) {
      console.warn("[ProviderConfig] Failed to upsert global defaults:", e);
    }
  }
});

// Action to fetch models from provider APIs
export const fetchProviderModels = action({
  args: {
    provider: v.union(v.literal("openrouter"), v.literal("google"), v.literal("vercel-ai-gateway"))
  },
  handler: async (ctx, { provider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;
    
    // Get user's provider configuration
    const userConfig = await ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier });
    
    let models: ModelInfo[] = [];
    
    if (provider === "openrouter") {
      const apiKey = userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) {
        throw new Error("OpenRouter API key is required");
      }

      console.log(`📥 [Provider] Fetching OpenRouter models for user: ${tokenIdentifier.slice(0, 20)}...`);

      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        console.error(`❌ [Provider] OpenRouter API failed: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      models = data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: { id: m.provider?.id || "unknown" },
        context_window: m.context_window || 128000,
        max_input_tokens: m.max_input_tokens || 128000,
        max_output_tokens: m.max_output_tokens || 4096,
        pricing: m.pricing,
        category: deriveCategory(m.name),
        release_date: m.release_date,
        attachment: m.attachment,
        reasoning: m.reasoning,
        tool_call: m.tool_call,
        cost: m.cost,
        limit: m.limit,
      }));

      console.log(`✅ [Provider] Successfully fetched ${models.length} models from OpenRouter API`);
    } else if (provider === "google") {
      // For Google Vertex AI, focus on Anthropic Claude models available on Vertex AI
      // Allow browsing models without credentials, but require credentials for actual use
      console.log(`📥 [Provider] Loading static list of Google Vertex AI (Anthropic Claude) models...`);
      
      // Focus specifically on Anthropic Claude models available on Google Vertex AI
      // Based on Google Cloud documentation, these are the main Claude models available:
      models = [
        {
          id: "claude-3-5-sonnet-v2@20241022",
          name: "Claude 3.5 Sonnet (New)",
          provider: { id: "anthropic" },
          context_window: 200000,
          max_input_tokens: 200000,
          max_output_tokens: 8192,
          category: "Anthropic",
          release_date: "2024-10-22",
          attachment: true,
          reasoning: true,
          tool_call: true,
          cost: {
            input: 0.003,
            output: 0.015,
            cache_read: 0.003,
            cache_write: 0.00375
          },
          limit: {
            context: 200000,
            output: 8192
          }
        },
        {
          id: "claude-3-5-sonnet@20240620",
          name: "Claude 3.5 Sonnet",
          provider: { id: "anthropic" },
          context_window: 200000,
          max_input_tokens: 200000,
          max_output_tokens: 8192,
          category: "Anthropic",
          release_date: "2024-06-20",
          attachment: true,
          reasoning: true,
          tool_call: true,
          cost: {
            input: 0.003,
            output: 0.015,
            cache_read: 0.003,
            cache_write: 0.00375
          },
          limit: {
            context: 200000,
            output: 8192
          }
        },
        {
          id: "claude-3-haiku@20240307",
          name: "Claude 3 Haiku",
          provider: { id: "anthropic" },
          context_window: 200000,
          max_input_tokens: 200000,
          max_output_tokens: 4096,
          category: "Anthropic",
          release_date: "2024-03-07",
          attachment: true,
          reasoning: false,
          tool_call: true,
          cost: {
            input: 0.00025,
            output: 0.00125,
            cache_read: 0.0003,
            cache_write: 0.0003
          },
          limit: {
            context: 200000,
            output: 4096
          }
        }
      ];
      
      console.log(`✅ [Provider] Successfully loaded ${models.length} Anthropic Claude models from Google Vertex AI`);
    } else if (provider === "vercel-ai-gateway") {
      try {
        console.log(`📥 [Provider] Fetching models from Vercel AI Gateway...`);
        
        const response = await fetch("https://ai-gateway.vercel.sh/v1/models");
        
        if (!response.ok) {
          console.error(`❌ [Provider] Vercel AI Gateway API failed: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = await response.json();
        models = data.data
          .filter((m: any) => m.type === "language") // Only language models, not embeddings
          .map((m: any) => ({
            id: m.id,
            name: m.name,
            provider: { id: m.owned_by || "unknown" },
            context_window: m.context_window || 128000,
            max_input_tokens: m.context_window || 128000,
            max_output_tokens: m.max_tokens || 4096,
            pricing: m.pricing,
            category: deriveCategory(m.name || m.id),
            release_date: undefined,
            attachment: undefined,
            reasoning: undefined,
            tool_call: undefined,
            cost: m.pricing ? {
              input: parseFloat(m.pricing.input) || 0,
              output: parseFloat(m.pricing.output) || 0,
              cache_read: m.pricing.input_cache_read ? parseFloat(m.pricing.input_cache_read) : undefined,
              cache_write: m.pricing.input_cache_write ? parseFloat(m.pricing.input_cache_write) : undefined,
            } : undefined,
            limit: {
              context: m.context_window || 128000,
              output: m.max_tokens || 4096,
            },
          }));

        console.log(`✅ [Provider] Successfully fetched ${models.length} models from Vercel AI Gateway`);
      } catch (error) {
        console.error(`❌ [Provider] Failed to fetch Vercel AI Gateway models:`, error);
        throw new Error(`Failed to fetch models from Vercel AI Gateway: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Cache the models
    const now = Date.now();
    await ctx.runMutation(api.providers.unified.cacheProviderModels, { 
      models, 
      lastFetched: now,
      provider 
    });
    
    console.log(`💾 [Provider] Successfully cached ${models.length} models at ${new Date(now).toISOString()}`);

    return models;
  }
});

// Helper to derive category from model name (following OpenCode approach)
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

// Internal mutation to cache provider models
export const cacheProviderModels = mutation({
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
      category: v.optional(v.string()),
      release_date: v.optional(v.string()),
      attachment: v.optional(v.boolean()),
      reasoning: v.optional(v.boolean()),
      tool_call: v.optional(v.boolean()),
      cost: v.optional(v.object({
        input: v.number(),
        output: v.number(),
        cache_read: v.optional(v.number()),
        cache_write: v.optional(v.number()),
      })),
      limit: v.optional(v.object({
        context: v.number(),
        output: v.number(),
      })),
    })),
    lastFetched: v.number(),
    provider: v.string(),
  },
  handler: async (ctx, { models, lastFetched, provider }) => {
    // Use provider-specific cache table with correct naming
    const cacheTableName = provider === "openrouter" ? "cachedOpenrouterModels" : 
                           provider === "google" ? "cachedGoogleModels" : 
                           "cachedVercelAiGatewayModels";
    
    const results = await ctx.db.query(cacheTableName).collect();
    const existing = results[0];
    if (existing) {
      await ctx.db.patch(existing._id, { lastFetched, models });
    } else {
      await ctx.db.insert(cacheTableName, { lastFetched, models });
    }
  }
});

// Query to get cached provider models
export const getCachedProviderModels = query({
  args: {
    provider: v.union(v.literal("openrouter"), v.literal("google"), v.literal("vercel-ai-gateway"))
  },
  handler: async (ctx, { provider }) => {
    // Use provider-specific cache table with correct naming
    const cacheTableName = provider === "openrouter" ? "cachedOpenrouterModels" : 
                           provider === "google" ? "cachedGoogleModels" : 
                           "cachedVercelAiGatewayModels";
    
    const results = await ctx.db.query(cacheTableName).collect();
    return results[0] || null;
  }
});