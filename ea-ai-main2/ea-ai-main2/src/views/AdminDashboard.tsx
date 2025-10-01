"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Cpu, Key, RefreshCw, CheckCircle, AlertCircle, 
  Loader2, Database, Settings, Globe, Server, Search, ChevronDown, Check, X,
  ExternalLink, Info
} from "lucide-react";
import { toast } from "sonner";
import { useConvexAuth, useMutation, useAction, useQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ModelInfo {
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

// Enhanced model interface with detailed provider information
interface EnhancedModelInfo extends ModelInfo {
  providerSlugs?: string[];        // All providers offering this model
  pricingByProvider?: Record<string, {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  }>; // Provider-specific pricing
  endpoints?: Array<{              // Available endpoints by provider
    provider: string;
    url: string;
    status: string;
  }>;
}

interface ProviderSettings {
  apiProvider: "openrouter" | "google" | "vercel-ai-gateway";
  openRouterApiKey?: string;
  openRouterModelId?: string;
  openRouterBaseUrl?: string;
  openRouterSpecificProvider?: string;
  openRouterUseMiddleOutTransform?: boolean;
  googleProjectId?: string;
  googleRegion?: string;
  googleCredentials?: string;
  googleModelId?: string;
  googleEnableUrlContext?: boolean;
  googleEnableGrounding?: boolean;
  googleEnableReasoning?: boolean;
  activeModelId?: string;
}

export function AdminDashboard() {
  console.log('🔄 [DEBUG] AdminDashboard component rendered');
  
  // Convex authentication and mutations
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const setProviderConfig = useMutation(api.providers.unified.setProviderConfig);
  const fetchProviderModels = useAction(api.providers.unified.fetchProviderModels);
  const fetchDetailedModelInfo = useAction(api.providers.openrouterDetailed.fetchDetailedModelInfo);
  
  const [config, setConfig] = useState<ProviderSettings>({
    apiProvider: "openrouter",
    openRouterApiKey: "",
    openRouterModelId: "",
    openRouterBaseUrl: "",
    openRouterSpecificProvider: "",
    openRouterUseMiddleOutTransform: true,
    googleProjectId: "",
    googleRegion: "",
    googleCredentials: "",
    googleModelId: "",
    googleEnableUrlContext: false,
    googleEnableGrounding: false,
    googleEnableReasoning: false,
    activeModelId: "",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [modelList, setModelList] = useState<ModelInfo[]>([]);
  const [enhancedModels, setEnhancedModels] = useState<Record<string, EnhancedModelInfo>>({});
  const [apiKeyError, setApiKeyError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFetchingDetailedModel, setIsFetchingDetailedModel] = useState<string | null>(null);

  // Load config from localStorage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("provider-config");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig((prev) => ({
          ...prev,
          ...parsedConfig,
          openRouterSpecificProvider: parsedConfig?.openRouterSpecificProvider || "",
        }));
      } catch (e) {
        console.error("Failed to parse saved config:", e);
      }
    }

    const savedModels = localStorage.getItem("cached-models");
    if (savedModels) {
      try {
        const parsedModels = JSON.parse(savedModels);
        const modelsArray: ModelInfo[] = Array.isArray(parsedModels)
          ? parsedModels
          : Object.values(parsedModels || {});

        const modelMap: Record<string, ModelInfo> = {};
        modelsArray.forEach((model) => {
          if (model?.id) {
            modelMap[model.id] = model;
          }
        });

        setModelList(modelsArray);
        setModels(modelMap);
      } catch (e) {
        console.error("Failed to parse cached models:", e);
      }
    }
  }, []);

  const handleSaveConfig = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to save configuration");
      return;
    }
    
    setIsSaving(true);
    try {
      const sanitizedSpecificProvider = (config.openRouterSpecificProvider || "").trim();
      const updatedConfig = {
        ...config,
        openRouterSpecificProvider: sanitizedSpecificProvider,
      };

      // Save to Convex database instead of localStorage
      await setProviderConfig({
        apiProvider: updatedConfig.apiProvider,
        openRouterApiKey: updatedConfig.openRouterApiKey,
        openRouterModelId: updatedConfig.openRouterModelId, 
        openRouterBaseUrl: updatedConfig.openRouterBaseUrl,
        openRouterSpecificProvider: sanitizedSpecificProvider ? sanitizedSpecificProvider : undefined,
        openRouterUseMiddleOutTransform: updatedConfig.openRouterUseMiddleOutTransform,
        googleProjectId: updatedConfig.googleProjectId,
        googleRegion: updatedConfig.googleRegion,
        googleCredentials: updatedConfig.googleCredentials,
        googleModelId: updatedConfig.googleModelId,
        googleEnableUrlContext: updatedConfig.googleEnableUrlContext,
        googleEnableGrounding: updatedConfig.googleEnableGrounding,
        googleEnableReasoning: updatedConfig.googleEnableReasoning,
        activeModelId: updatedConfig.activeModelId // This is the key field for model selection
      });
      
      // Still save to localStorage for backup/immediate access
      localStorage.setItem("provider-config", JSON.stringify(updatedConfig));

      setConfig(updatedConfig);
      
      console.log("✅ Configuration saved to database:", updatedConfig);
      toast.success("Configuration saved successfully!");
    } catch (error) {
      console.error("❌ Failed to save config:", error);
      toast.error(`Failed to save configuration: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchModels = async () => {
    if (config.apiProvider === "openrouter" && !config.openRouterApiKey) {
      setApiKeyError("API key is required to fetch models");
      toast.error("API key is required to fetch models");
      return;
    }
    
    setApiKeyError("");
    setIsFetchingModels(true);
    
    try {
      // Call the Convex action to fetch models
      await fetchProviderModels({ provider: config.apiProvider });
      
      // After fetching, get the cached models
      const cachedModels = await convex.query(api.providers.unified.getCachedProviderModels, { provider: config.apiProvider });
      if (cachedModels?.models) {
        const modelMap: Record<string, ModelInfo> = {};
        cachedModels.models.forEach(model => {
          modelMap[model.id] = model;
        });
        setModels(modelMap);
        setModelList(cachedModels.models);
        const providerName = config.apiProvider === "google" ? "Google Vertex AI" : 
                          config.apiProvider === "vercel-ai-gateway" ? "Vercel AI Gateway" : 
                          "OpenRouter";
        localStorage.setItem("cached-models", JSON.stringify(cachedModels.models));
        toast.success(`Fetched ${cachedModels.models.length} models from ${providerName}!`);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      toast.error(`Failed to fetch models: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    console.log('🎯 [DEBUG] Model selected:', modelId);
    const sanitizedCurrentProvider = (config.openRouterSpecificProvider || "").trim();
    const providerOptions = config.apiProvider === "openrouter" ? getProviderSlugsForModel(modelId) : [];
    const providerStillValid = sanitizedCurrentProvider && providerOptions.includes(sanitizedCurrentProvider);

    const updatedConfig: ProviderSettings = {
      ...config,
      activeModelId: modelId,
      openRouterModelId: config.apiProvider === "openrouter" ? modelId : config.openRouterModelId,
      googleModelId: config.apiProvider === "google" ? modelId : config.googleModelId,
      openRouterSpecificProvider: config.apiProvider === "openrouter" && providerStillValid
        ? sanitizedCurrentProvider
        : config.apiProvider === "openrouter"
          ? ""
          : config.openRouterSpecificProvider,
    };

    setConfig(updatedConfig);
    localStorage.setItem("provider-config", JSON.stringify(updatedConfig));

    if (isAuthenticated) {
      try {
        await setProviderConfig({
          apiProvider: updatedConfig.apiProvider,
          openRouterApiKey: updatedConfig.openRouterApiKey,
          openRouterModelId: updatedConfig.openRouterModelId,
          openRouterBaseUrl: updatedConfig.openRouterBaseUrl,
          openRouterSpecificProvider: updatedConfig.openRouterSpecificProvider
            ? updatedConfig.openRouterSpecificProvider
            : undefined,
          openRouterUseMiddleOutTransform: updatedConfig.openRouterUseMiddleOutTransform,
          googleProjectId: updatedConfig.googleProjectId,
          googleRegion: updatedConfig.googleRegion,
          googleCredentials: updatedConfig.googleCredentials,
          googleModelId: updatedConfig.googleModelId,
          googleEnableUrlContext: updatedConfig.googleEnableUrlContext,
          googleEnableGrounding: updatedConfig.googleEnableGrounding,
          googleEnableReasoning: updatedConfig.googleEnableReasoning,
          activeModelId: updatedConfig.activeModelId,
        });
        console.log('✅ [DEBUG] Model selection auto-saved to database:', modelId);
        const selectedName = models[modelId]?.name || modelId;
        if (providerOptions.length > 0 && !providerStillValid && sanitizedCurrentProvider) {
          toast.success(`Model "${selectedName}" selected. Provider reset to auto.`);
        } else {
          toast.success(`Model "${selectedName}" selected and saved!`);
        }
      } catch (error) {
        console.error('❌ [DEBUG] Failed to auto-save model selection:', error);
        toast.error("Model selected but failed to save. Please click Save Configuration.");
      }
    }
  };

  const handleProviderSelect = async (providerSlug: string) => {
    if (config.apiProvider !== "openrouter") {
      return;
    }

    const sanitized = providerSlug === "auto" ? "" : providerSlug;
    const updatedConfig: ProviderSettings = {
      ...config,
      openRouterSpecificProvider: sanitized,
    };

    setConfig(updatedConfig);
    localStorage.setItem("provider-config", JSON.stringify(updatedConfig));

    if (!isAuthenticated) {
      return;
    }

    try {
      await setProviderConfig({
        apiProvider: updatedConfig.apiProvider,
        openRouterApiKey: updatedConfig.openRouterApiKey,
        openRouterModelId: updatedConfig.openRouterModelId,
        openRouterBaseUrl: updatedConfig.openRouterBaseUrl,
        openRouterSpecificProvider: sanitized || undefined,
        openRouterUseMiddleOutTransform: updatedConfig.openRouterUseMiddleOutTransform,
        googleProjectId: updatedConfig.googleProjectId,
        googleRegion: updatedConfig.googleRegion,
        googleCredentials: updatedConfig.googleCredentials,
        googleModelId: updatedConfig.googleModelId,
        googleEnableUrlContext: updatedConfig.googleEnableUrlContext,
        googleEnableGrounding: updatedConfig.googleEnableGrounding,
        googleEnableReasoning: updatedConfig.googleEnableReasoning,
        activeModelId: updatedConfig.activeModelId,
      });

      if (sanitized) {
        toast.success(`Provider "${sanitized}" locked for model routing.`);
      } else {
        toast.success("Provider routing reset to automatic (highest availability).");
      }
    } catch (error) {
      console.error('❌ [DEBUG] Failed to save provider selection:', error);
      toast.error("Failed to update provider selection. Please try again.");
    }
  };

  const deriveCategory = (name: string): string => {
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
  };

  const filteredModels = Object.values(models).filter(model => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return model.name.toLowerCase().includes(query) || 
           model.id.toLowerCase().includes(query) ||
           (model.category || "").toLowerCase().includes(query);
  });

  const getProviderSlugsForModel = useCallback(
    (modelId?: string | null) => {
      if (!modelId) {
        return [] as string[];
      }

      const selectedModel = models[modelId];
      if (!selectedModel) {
        return [] as string[];
      }

      const slugSet = new Set<string>();
      modelList.forEach((modelEntry) => {
        if (
          modelEntry.id === modelId ||
          (!!selectedModel.name && modelEntry.name === selectedModel.name)
        ) {
          const slug = modelEntry.provider?.id;
          if (slug) {
            slugSet.add(slug);
          }
        }
      });

      if (slugSet.size === 0 && selectedModel.provider?.id) {
        slugSet.add(selectedModel.provider.id);
      }

      return Array.from(slugSet).sort();
    },
    [modelList, models]
  );

  // Function to fetch detailed model information for a specific model
  const fetchDetailedModelInfoForModel = useCallback(async (modelId: string) => {
    if (!modelId || config.apiProvider !== "openrouter") {
      return;
    }

    // Check if we already have enhanced information cached
    if (enhancedModels[modelId]?.providerSlugs && enhancedModels[modelId].providerSlugs.length > 0) {
      return;
    }

    try {
      setIsFetchingDetailedModel(modelId);
      console.log(`🔍 [AdminDashboard] Fetching detailed model info for: ${modelId}`);
      
      const detailedInfo = await fetchDetailedModelInfo({ modelId });
      
      if (detailedInfo) {
        setEnhancedModels(prev => ({
          ...prev,
          [modelId]: detailedInfo
        }));
        console.log(`✅ [AdminDashboard] Successfully fetched detailed info for ${modelId} with ${detailedInfo.providerSlugs?.length || 0} providers`);
      }
    } catch (error) {
      console.error(`❌ [AdminDashboard] Failed to fetch detailed model info for ${modelId}:`, error);
      toast.error(`Failed to fetch provider information for ${models[modelId]?.name || modelId}`);
    } finally {
      setIsFetchingDetailedModel(null);
    }
  }, [config.apiProvider, enhancedModels, fetchDetailedModelInfo, models]);

  // Enhanced function to get provider slugs for a model
  const getProviderSlugsForModelEnhanced = useCallback((modelId?: string | null) => {
    if (!modelId) {
      return [] as string[];
    }

    // First check if we have enhanced information
    const enhancedModel = enhancedModels[modelId];
    if (enhancedModel?.providerSlugs && enhancedModel.providerSlugs.length > 0) {
      return enhancedModel.providerSlugs;
    }

    // Fall back to the original logic
    return getProviderSlugsForModel(modelId);
  }, [enhancedModels, getProviderSlugsForModel]);

  const availableProviderSlugs = useMemo(() => {
    if (config.apiProvider !== "openrouter") {
      return [] as string[];
    }
    return getProviderSlugsForModelEnhanced(config.activeModelId);
  }, [config.apiProvider, config.activeModelId, getProviderSlugsForModelEnhanced]);

  const providerSelectValue = (() => {
    const sanitized = (config.openRouterSpecificProvider || "").trim();
    if (!sanitized) {
      return "auto";
    }
    return availableProviderSlugs.includes(sanitized) ? sanitized : "auto";
  })();

  useEffect(() => {
    if (config.apiProvider !== "openrouter" || !config.activeModelId) {
      return;
    }
    
    // Auto-fetch detailed model info when model is selected
    fetchDetailedModelInfoForModel(config.activeModelId);
  }, [config.apiProvider, config.activeModelId, fetchDetailedModelInfoForModel]);

  useEffect(() => {
    if (config.apiProvider !== "openrouter") {
      return;
    }

    const sanitized = (config.openRouterSpecificProvider || "").trim();
    if (!sanitized) {
      return;
    }

    if (availableProviderSlugs.includes(sanitized)) {
      return;
    }

    const updatedConfig: ProviderSettings = {
      ...config,
      openRouterSpecificProvider: "",
    };

    setConfig(updatedConfig);
    localStorage.setItem("provider-config", JSON.stringify(updatedConfig));

    if (!isAuthenticated) {
      return;
    }

    (async () => {
      try {
        await setProviderConfig({
          apiProvider: updatedConfig.apiProvider,
          openRouterApiKey: updatedConfig.openRouterApiKey,
          openRouterModelId: updatedConfig.openRouterModelId,
          openRouterBaseUrl: updatedConfig.openRouterBaseUrl,
          openRouterSpecificProvider: undefined,
          openRouterUseMiddleOutTransform: updatedConfig.openRouterUseMiddleOutTransform,
          googleProjectId: updatedConfig.googleProjectId,
          googleRegion: updatedConfig.googleRegion,
          googleCredentials: updatedConfig.googleCredentials,
          googleModelId: updatedConfig.googleModelId,
          googleEnableUrlContext: updatedConfig.googleEnableUrlContext,
          googleEnableGrounding: updatedConfig.googleEnableGrounding,
          googleEnableReasoning: updatedConfig.googleEnableReasoning,
          activeModelId: updatedConfig.activeModelId,
        });
        toast.success("Provider routing reset to automatic (highest availability).");
      } catch (error) {
        console.error('❌ [DEBUG] Failed to reset provider selection:', error);
        toast.error("Failed to reset provider selection. Please try again.");
      }
    })();
  }, [config, availableProviderSlugs, isAuthenticated, setProviderConfig]);

  // Effect to fetch detailed model information when a model is selected
  useEffect(() => {
    if (config.activeModelId && config.apiProvider === "openrouter") {
      // Only fetch if we don't already have enhanced information
      if (!enhancedModels[config.activeModelId]?.providerSlugs || enhancedModels[config.activeModelId].providerSlugs.length === 0) {
        fetchDetailedModelInfoForModel(config.activeModelId);
      }
    }
  }, [config.activeModelId, config.apiProvider, enhancedModels, fetchDetailedModelInfoForModel]);

  return (
    <div className="space-y-6 p-6 h-[calc(100vh-2rem)] overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Configure OpenRouter provider and select AI models</p>
      </div>

      <div className="space-y-6">
        {/* Unified Provider Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Provider Configuration
            </CardTitle>
            <CardDescription>
              Configure your AI provider settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="apiProvider">AI Provider</Label>
              <Select 
                value={config.apiProvider} 
                onValueChange={(value: "openrouter" | "google" | "vercel-ai-gateway") => 
                  setConfig(prev => ({ ...prev, apiProvider: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      OpenRouter
                    </div>
                  </SelectItem>
                  <SelectItem value="google">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Google Vertex AI
                    </div>
                  </SelectItem>
                  <SelectItem value="vercel-ai-gateway">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Vercel AI Gateway
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* OpenRouter Configuration */}
            {config.apiProvider === "openrouter" && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  OpenRouter Settings
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key *</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk-or-..."
                      value={config.openRouterApiKey}
                      onChange={(e) => {
                        setConfig(prev => ({ ...prev, openRouterApiKey: e.target.value }));
                        if (e.target.value) setApiKeyError("");
                      }}
                    />
                    {config.openRouterApiKey && (
                      <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {apiKeyError && (
                    <p className="text-sm text-destructive">{apiKeyError}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1">
                        OpenRouter <ExternalLink className="h-3 w-3" />
                      </a>
                    </span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      HTTP-Referer: opencode.ai
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://openrouter.ai/api/v1"
                    value={config.openRouterBaseUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, openRouterBaseUrl: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Use Middle-Out Transform</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable compression optimization for better performance
                    </p>
                  </div>
                  <Switch
                    checked={config.openRouterUseMiddleOutTransform}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, openRouterUseMiddleOutTransform: checked }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Google Vertex AI Configuration */}
            {config.apiProvider === "google" && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Google Vertex AI Settings
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="googleProjectId">Project ID *</Label>
                  <Input
                    id="googleProjectId"
                    placeholder="your-google-project-id"
                    value={config.googleProjectId}
                    onChange={(e) => setConfig(prev => ({ ...prev, googleProjectId: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Google Cloud Project ID
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleRegion">Region</Label>
                  <Input
                    id="googleRegion"
                    placeholder="us-central1"
                    value={config.googleRegion}
                    onChange={(e) => setConfig(prev => ({ ...prev, googleRegion: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Google Cloud region (default: us-central1)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleCredentials">Credentials (JSON)</Label>
                  <textarea
                    id="googleCredentials"
                    placeholder='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"..."}'
                    value={config.googleCredentials}
                    onChange={(e) => setConfig(prev => ({ ...prev, googleCredentials: e.target.value }))}
                    className="w-full min-h-[120px] p-2 border rounded-md bg-background text-foreground text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your Google Cloud service account JSON credentials
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Enable URL Context</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow the model to understand URLs in context
                      </p>
                    </div>
                    <Switch
                      checked={config.googleEnableUrlContext}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, googleEnableUrlContext: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Enable Grounding</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable grounding with web search results
                      </p>
                    </div>
                    <Switch
                      checked={config.googleEnableGrounding}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, googleEnableGrounding: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Enable Reasoning</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable advanced reasoning capabilities
                      </p>
                    </div>
                    <Switch
                      checked={config.googleEnableReasoning}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, googleEnableReasoning: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleSaveConfig} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Configuration...
                </>
              ) : (
                "Save Provider Configuration"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Model Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Model Management
            </CardTitle>
            <CardDescription>
              Fetch and select models available through {config.apiProvider === "google" ? "Google Vertex AI" : 
                                                       config.apiProvider === "vercel-ai-gateway" ? "Vercel AI Gateway" : 
                                                       "OpenRouter"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Button 
                onClick={handleFetchModels} 
                disabled={isFetchingModels}
                className="flex-1"
              >
                {isFetchingModels ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Models...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Fetch Models from {config.apiProvider === "google" ? "Google Vertex AI" : 
                                       config.apiProvider === "vercel-ai-gateway" ? "Vercel AI Gateway" : 
                                       "OpenRouter"}
                  </>
                )}
              </Button>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{Object.keys(models).length} models cached</span>
              </div>
            </div>

            {Object.keys(models).length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Model</Label>
                  <Select 
                    value={config.activeModelId} 
                    onValueChange={(value) => {
                      void handleModelSelect(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate">{model.name}</span>
                            {model.category && (
                              <Badge variant="secondary" className="text-xs ml-2">
                                {model.category}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {config.activeModelId && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {models[config.activeModelId]?.name || config.activeModelId}
                    </p>
                  )}
                </div>

                {config.apiProvider === "openrouter" && config.activeModelId && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Provider Routing</Label>
                      {isFetchingDetailedModel === config.activeModelId && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Fetching providers...</span>
                        </div>
                      )}
                    </div>
                    {availableProviderSlugs.length > 0 ? (
                      <Select
                        value={providerSelectValue}
                        onValueChange={(value) => {
                          void handleProviderSelect(value);
                        }}
                        disabled={isFetchingDetailedModel === config.activeModelId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select provider routing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>Auto (highest availability)</span>
                                <Badge variant="outline" className="text-xs">Recommended</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">OpenRouter selects the best provider for this model</span>
                            </div>
                          </SelectItem>
                          {availableProviderSlugs.map((provider) => {
                            const enhancedModel = enhancedModels[config.activeModelId!];
                            const endpointInfo = enhancedModel?.endpoints?.find(e => e.provider === provider);
                            
                            return (
                              <SelectItem key={provider} value={provider}>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs sm:text-sm">{provider}</span>
                                    {endpointInfo && (
                                      <Badge 
                                        variant={endpointInfo.status === 'online' ? 'default' : 
                                                endpointInfo.status === 'degraded' ? 'secondary' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {endpointInfo.status || 'unknown'}
                                      </Badge>
                                    )}
                                  </div>
                                  {endpointInfo && (
                                    <span className="text-xs text-muted-foreground">
                                      Status: {endpointInfo.status || 'Unknown'} • Direct routing
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          {isFetchingDetailedModel === config.activeModelId 
                            ? "Detecting available providers..."
                            : "No alternative providers detected for this model. Using automatic routing."
                          }
                        </p>
                        {!isFetchingDetailedModel && enhancedModels[config.activeModelId] && (
                          <p className="flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            OpenRouter will automatically select the best provider based on availability and performance.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {filteredModels.map((model) => (
                      <div
                        key={model.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          config.activeModelId === model.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => handleModelSelect(model.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{model.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs">{model.id}</span>
                              {model.category && (
                                <Badge variant="secondary">{model.category}</Badge>
                              )}
                            </div>
                          </div>
                          {config.activeModelId === model.id && (
                            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <Badge variant="outline">
                            Context: {model.context_window?.toLocaleString() || "N/A"}
                          </Badge>
                          <Badge variant="outline">
                            Input: {model.max_input_tokens?.toLocaleString() || "N/A"}
                          </Badge>
                          <Badge variant="outline">
                            Output: {model.max_output_tokens?.toLocaleString() || "N/A"}
                          </Badge>
                          {model.reasoning && <Badge variant="default">Reasoning</Badge>}
                          {model.attachment && <Badge variant="default">Attachments</Badge>}
                          {model.tool_call && <Badge variant="default">Tools</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {Object.keys(models).length === 0 && !isFetchingModels && (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No models cached yet</p>
                <p className="text-sm mt-1">
                  Click "Fetch Models" to load available models from {config.apiProvider === "google" ? "Google Vertex AI" : 
                                                                       config.apiProvider === "vercel-ai-gateway" ? "Vercel AI Gateway" : 
                                                                       "OpenRouter"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}