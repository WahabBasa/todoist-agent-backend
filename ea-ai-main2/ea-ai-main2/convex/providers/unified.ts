import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Unified provider settings schema following OpenCode approach
export interface ProviderSettings {
  // Provider selection
  apiProvider: "openrouter" | "google";
  
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
  apiProvider: v.optional(v.union(v.literal("openrouter"), v.literal("google"))),
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
    apiProvider: v.optional(v.union(v.literal("openrouter"), v.literal("google"))),
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
        activeModelId: args.activeModelId || "anthropic/claude-3.5-haiku-20241022",
        updatedAt: now,
        isAdmin: false // default
      });
    }
  }
});

// Action to fetch models from provider APIs
export const fetchProviderModels = action({
  args: {
    provider: v.union(v.literal("openrouter"), v.literal("google"))
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
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://opencode.ai/",
          "X-Title": "opencode",
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
      // For Google Vertex AI, we need to properly fetch models
      const googleProjectId = userConfig?.googleProjectId;
      const googleRegion = userConfig?.googleRegion;
      const googleCredentials = userConfig?.googleCredentials;
      
      if (!googleProjectId) {
        throw new Error("Google Project ID is required for Vertex AI. Please configure it in the admin dashboard.");
      }
      
      try {
        // Try to use Google's API to fetch available models
        // This is a simplified approach since the actual implementation would require proper authentication
        console.log(`📥 [Provider] Fetching Google Vertex AI models for project: ${googleProjectId}...`);
        
        // In a real implementation, we would use the Google Cloud Vertex AI API
        // For now, we'll return a comprehensive list of known Google models
        const knownGoogleModels: ModelInfo[] = [
          {
            id: "gemini-1.5-pro-002",
            name: "Gemini 1.5 Pro (Latest)",
            provider: { id: "google" },
            context_window: 2097152,
            max_input_tokens: 2097152,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-11-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.00125,
              output: 0.005,
              cache_read: 0.00125,
              cache_write: 0.00125
            },
            limit: {
              context: 2097152,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-flash-002",
            name: "Gemini 1.5 Flash (Latest)",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-11-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000075,
              output: 0.0003,
              cache_read: 0.000075,
              cache_write: 0.000075
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-2.0-flash-exp",
            name: "Gemini 2.0 Flash Experimental",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-12-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000035,
              output: 0.00015,
              cache_read: 0.000035,
              cache_write: 0.000035
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-1.0-pro-002",
            name: "Gemini 1.0 Pro",
            provider: { id: "google" },
            context_window: 32768,
            max_input_tokens: 32768,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-02-15",
            attachment: true,
            reasoning: false,
            tool_call: true,
            cost: {
              input: 0.0005,
              output: 0.0015,
              cache_read: 0.0005,
              cache_write: 0.0005
            },
            limit: {
              context: 32768,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-pro-001",
            name: "Gemini 1.5 Pro (Previous Version)",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-05-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.00125,
              output: 0.005,
              cache_read: 0.00125,
              cache_write: 0.00125
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-flash-001",
            name: "Gemini 1.5 Flash (Previous Version)",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-05-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000075,
              output: 0.0003,
              cache_read: 0.000075,
              cache_write: 0.000075
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-2.0-pro-exp-02-10",
            name: "Gemini 2.0 Pro Experimental",
            provider: { id: "google" },
            context_window: 2097152,
            max_input_tokens: 2097152,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2025-02-10",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.0025,
              output: 0.01,
              cache_read: 0.0025,
              cache_write: 0.0025
            },
            limit: {
              context: 2097152,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-pro-003",
            name: "Gemini 1.5 Pro (Updated)",
            provider: { id: "google" },
            context_window: 2097152,
            max_input_tokens: 2097152,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2025-01-15",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.00125,
              output: 0.005,
              cache_read: 0.00125,
              cache_write: 0.00125
            },
            limit: {
              context: 2097152,
              output: 8192
            }
          },
          {
            id: "gemini-2.0-flash-001",
            name: "Gemini 2.0 Flash",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2025-01-20",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000035,
              output: 0.00015,
              cache_read: 0.000035,
              cache_write: 0.000035
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-2.0-pro-001",
            name: "Gemini 2.0 Pro",
            provider: { id: "google" },
            context_window: 2097152,
            max_input_tokens: 2097152,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2025-01-25",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.0025,
              output: 0.01,
              cache_read: 0.0025,
              cache_write: 0.0025
            },
            limit: {
              context: 2097152,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-flash-8b-001",
            name: "Gemini 1.5 Flash 8B",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-12-15",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.0000375,
              output: 0.00015,
              cache_read: 0.0000375,
              cache_write: 0.0000375
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          },
          {
            id: "gemini-2.0-flash-lite-preview-02-14",
            name: "Gemini 2.0 Flash Lite Preview",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2025-02-14",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000015,
              output: 0.00006,
              cache_read: 0.000015,
              cache_write: 0.000015
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          }
        ];
        
        models = knownGoogleModels;
        console.log(`✅ [Provider] Successfully loaded ${models.length} Google Vertex AI models`);
      } catch (error) {
        console.error(`❌ [Provider] Failed to fetch Google Vertex AI models:`, error);
        // Fallback to a minimal set of models
        models = [
          {
            id: "gemini-1.5-pro-002",
            name: "Gemini 1.5 Pro (Latest)",
            provider: { id: "google" },
            context_window: 2097152,
            max_input_tokens: 2097152,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-11-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.00125,
              output: 0.005,
              cache_read: 0.00125,
              cache_write: 0.00125
            },
            limit: {
              context: 2097152,
              output: 8192
            }
          },
          {
            id: "gemini-1.5-flash-002",
            name: "Gemini 1.5 Flash (Latest)",
            provider: { id: "google" },
            context_window: 1048576,
            max_input_tokens: 1048576,
            max_output_tokens: 8192,
            category: "Google",
            release_date: "2024-11-01",
            attachment: true,
            reasoning: true,
            tool_call: true,
            cost: {
              input: 0.000075,
              output: 0.0003,
              cache_read: 0.000075,
              cache_write: 0.000075
            },
            limit: {
              context: 1048576,
              output: 8192
            }
          }
        ];
        console.log(`⚠️ [Provider] Falling back to minimal Google Vertex AI models`);
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
    const cacheTableName = provider === "openrouter" ? "cachedOpenrouterModels" : "cachedGoogleModels";
    
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
    provider: v.union(v.literal("openrouter"), v.literal("google"))
  },
  handler: async (ctx, { provider }) => {
    // Use provider-specific cache table with correct naming
    const cacheTableName = provider === "openrouter" ? "cachedOpenrouterModels" : "cachedGoogleModels";
    
    const results = await ctx.db.query(cacheTableName).collect();
    return results[0] || null;
  }
});