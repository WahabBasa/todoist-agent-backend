"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction } from "../todoist/userAccess";

// (removed unused CACHE_TTL)

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

export const fetchModels = action({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUserAuthForAction(ctx);
    
    // Use new secure admin check (no tokenIdentifier needed)
    const isAdmin = await ctx.runQuery(api.auth.admin.isCurrentUserAdmin, {});
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    console.log(`📥 [Models] Starting OpenRouter API fetch for admin: ${userId.slice(0, 20)}...`);

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error(`❌ [Models] OpenRouter API failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      provider: { id: m.provider?.id || "unknown" },
      context_window: m.context_window || 128000, // default fallback
      max_input_tokens: m.max_input_tokens || 128000,
      max_output_tokens: m.max_output_tokens || 4096,
      pricing: m.pricing,
      category: deriveCategory(m.name)
    }));

    console.log(`✅ [Models] Successfully fetched ${models.length} models from OpenRouter API`);

    // Cache the models
    const now = Date.now();
    await ctx.runMutation(api.ai.models.internalCacheModels, { models, lastFetched: now });
    
    console.log(`💾 [Models] Successfully cached ${models.length} models at ${new Date(now).toISOString()}`);

    return models;
  }
});