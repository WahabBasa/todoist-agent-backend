import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { DetailedModelInfo, deriveCategory } from "./openrouter";

// Action to fetch detailed model information for a specific model
export const fetchDetailedModelInfo = action({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;
    
    // Get user's OpenRouter API key
    const userConfig = await ctx.runQuery(api.providers.openrouter.getUserOpenRouterConfig, { tokenIdentifier });
    const apiKey = userConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    console.log(`🔍 [OpenRouter] Fetching detailed info for model: ${modelId}`);

    // Extract author and slug from model ID (format: "author/slug")
    const [author, slug] = modelId.split('/');
    if (!author || !slug) {
      console.error(`❌ [OpenRouter] Invalid model ID format: ${modelId}`);
      throw new Error(`Invalid model ID format: ${modelId}. Expected "author/slug"`);
    }

    // Fetch detailed model information from the endpoints API
    const endpointsUrl = `https://openrouter.ai/api/v1/models/${author}/${slug}/endpoints`;
    
    try {
      const response = await fetch(endpointsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://opencode.ai",
          "X-Title": "OpenCode AI"
        }
      });

      if (!response.ok) {
        console.error(`❌ [OpenRouter] Endpoints API failed: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch model endpoints: ${response.statusText}`);
      }

      const endpointsData = await response.json();
      console.log(`✅ [OpenRouter] Successfully fetched endpoints for ${modelId}`);

      // Extract provider slugs from the endpoints data
      const providerSlugs = new Set<string>();
      const endpoints: Array<{ provider: string; url: string; status: string }> = [];
      
      if (endpointsData.data && Array.isArray(endpointsData.data)) {
        endpointsData.data.forEach((endpoint: any) => {
          if (endpoint.provider && endpoint.url) {
            providerSlugs.add(endpoint.provider);
            endpoints.push({
              provider: endpoint.provider,
              url: endpoint.url,
              status: endpoint.status || "unknown"
            });
          }
        });
      }

      // Also try to extract provider information from pricing if available
      // This would require fetching the basic model info again to get pricing data
      const basicModelsResponse = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      let modelInfo: any = null;
      if (basicModelsResponse.ok) {
        const basicData = await basicModelsResponse.json();
        modelInfo = basicData.data.find((m: any) => m.id === modelId);
        
        if (modelInfo?.pricing && typeof modelInfo.pricing === "object") {
          Object.keys(modelInfo.pricing).forEach((providerKey) => {
            if (![
              "prompt",
              "completion",
              "request",
              "image"
            ].includes(providerKey)) {
              providerSlugs.add(providerKey);
            }
          });
        }
      }

      const pricingByProvider: Record<string, any> = {};
      if (modelInfo?.pricing && typeof modelInfo.pricing === "object") {
        Object.entries(modelInfo.pricing).forEach(([key, value]) => {
          if (![
            "prompt",
            "completion",
            "request",
            "image"
          ].includes(key) && value && typeof value === "object") {
            pricingByProvider[key] = value;
          }
        });
      }

      const detailedInfo: DetailedModelInfo = {
        id: modelId,
        name: modelInfo?.name || modelId,
        provider: { id: modelInfo?.provider?.id || author },
        context_window: modelInfo?.context_window || 0,
        max_input_tokens: modelInfo?.max_input_tokens || 0,
        max_output_tokens: modelInfo?.max_output_tokens || 0,
        pricing: modelInfo?.pricing,
        category: deriveCategory(modelInfo?.name || modelId),
        release_date: modelInfo?.release_date,
        attachment: modelInfo?.attachment,
        reasoning: modelInfo?.reasoning,
        tool_call: modelInfo?.tool_call,
        cost: modelInfo?.cost,
        limit: modelInfo?.limit,
        providerSlugs: Array.from(providerSlugs).sort(),
        endpoints,
        pricingByProvider: Object.keys(pricingByProvider).length > 0 ? pricingByProvider : undefined,
        architecture: modelInfo?.architecture,
        top_provider: modelInfo?.top_provider
      };

      // Cache the detailed information
      const now = Date.now();
      await ctx.runMutation(api.providers.openrouterDetailed.cacheDetailedModelInfo, { 
        modelId, 
        detailedInfo, 
        lastFetched: now 
      });
      
      console.log(`💾 [OpenRouter] Cached detailed info for ${modelId} with ${providerSlugs.size} providers`);
      
      return detailedInfo;
    } catch (error) {
      console.error(`❌ [OpenRouter] Failed to fetch detailed info for ${modelId}:`, error);
      throw error;
    }
  }
});

// Internal mutation to cache detailed model information
export const cacheDetailedModelInfo = mutation({
  args: {
    modelId: v.string(),
    detailedInfo: v.object({
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
        cache_write: v.optional(v.number())
      })),
      limit: v.optional(v.object({
        context: v.number(),
        output: v.number()
      })),
      providerSlugs: v.optional(v.array(v.string())),
      pricingByProvider: v.optional(v.record(v.string(), v.any())),
      endpoints: v.optional(v.array(v.object({
        provider: v.string(),
        url: v.string(),
        status: v.string()
      }))),
      architecture: v.optional(v.object({
        modality: v.string(),
        tokenizer: v.string(),
        instruct_type: v.optional(v.string())
      })),
      top_provider: v.optional(v.object({
        context_length: v.number(),
        max_completion_tokens: v.number(),
        is_moderated: v.boolean()
      }))
    }),
    lastFetched: v.number()
  },
  handler: async (ctx, { modelId, detailedInfo, lastFetched }) => {
    // Check if we already have detailed models cached
    const results = await ctx.db.query("cachedDetailedOpenrouterModels").collect();
    const existing = results[0];
    
    if (existing) {
      // Update existing entry - add or replace the model info
      const updatedModels = existing.models.filter((m: any) => m.id !== modelId);
      updatedModels.push(detailedInfo);
      await ctx.db.patch(existing._id, { lastFetched, models: updatedModels });
    } else {
      // Create new entry
      await ctx.db.insert("cachedDetailedOpenrouterModels", { 
        lastFetched, 
        models: [detailedInfo] 
      });
    }
    
    console.log(`💾 [OpenRouter] Cached detailed info for ${modelId}`);
  }
});

// Query to get cached detailed model information
export const getCachedDetailedModelInfo = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const results = await ctx.db.query("cachedDetailedOpenrouterModels").collect();
    const cached = results[0];
    
    if (cached?.models) {
      return cached.models.find((m: any) => m.id === modelId) || null;
    }
    
    return null;
  }
});

// Query to get all cached detailed models
export const getAllCachedDetailedModels = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db.query("cachedDetailedOpenrouterModels").collect();
    return results[0] || null;
  }
});
