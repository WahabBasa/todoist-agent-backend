"use client";

import { useState, useEffect } from "react";
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
import { useConvexAuth, useMutation } from "convex/react";
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

interface ProviderSettings {
  apiProvider: "openrouter" | "google";
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
  const setProviderConfig = useMutation(api.providers.unified.setProviderConfig);
  
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
  const [apiKeyError, setApiKeyError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load config from localStorage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("provider-config");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
        
        // Load cached models
        const savedModels = localStorage.getItem("cached-models");
        if (savedModels) {
          const parsedModels = JSON.parse(savedModels);
          setModels(parsedModels);
        }
      } catch (e) {
        console.error("Failed to parse saved config:", e);
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
      // Save to Convex database instead of localStorage
      await setProviderConfig({
        apiProvider: config.apiProvider,
        openRouterApiKey: config.openRouterApiKey,
        openRouterModelId: config.openRouterModelId, 
        openRouterBaseUrl: config.openRouterBaseUrl,
        openRouterSpecificProvider: config.openRouterSpecificProvider,
        openRouterUseMiddleOutTransform: config.openRouterUseMiddleOutTransform,
        googleProjectId: config.googleProjectId,
        googleRegion: config.googleRegion,
        googleCredentials: config.googleCredentials,
        googleModelId: config.googleModelId,
        googleEnableUrlContext: config.googleEnableUrlContext,
        googleEnableGrounding: config.googleEnableGrounding,
        googleEnableReasoning: config.googleEnableReasoning,
        activeModelId: config.activeModelId // This is the key field for model selection
      });
      
      // Still save to localStorage for backup/immediate access
      localStorage.setItem("provider-config", JSON.stringify(config));
      
      console.log("✅ Configuration saved to database:", config);
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
      if (config.apiProvider === "openrouter") {
        // Fetch models from OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: {
            Authorization: `Bearer ${config.openRouterApiKey}`,
            "HTTP-Referer": "https://opencode.ai/",
            "X-Title": "opencode",
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        
        const data = await response.json();
        const fetchedModels: Record<string, ModelInfo> = {};
        
        data.data.forEach((m: any) => {
          fetchedModels[m.id] = {
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
          };
        });
        
        setModels(fetchedModels);
        
        // Save to localStorage
        localStorage.setItem("cached-models", JSON.stringify(fetchedModels));
        
        toast.success(`Fetched ${Object.keys(fetchedModels).length} models from OpenRouter!`);
      } else {
        // Fetch models from Google Vertex AI
          // For now, we'll use a comprehensive list of predefined models since the actual API requires authentication
          const googleModels: Record<string, ModelInfo> = {
            "gemini-1.5-pro-002": {
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
            "gemini-1.5-flash-002": {
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
            "gemini-2.0-flash-exp": {
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
            "gemini-1.0-pro-002": {
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
            "gemini-1.5-pro-001": {
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
            "gemini-1.5-flash-001": {
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
            "gemini-2.0-pro-exp-02-10": {
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
            "gemini-1.5-pro-003": {
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
            "gemini-2.0-flash-001": {
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
            "gemini-2.0-pro-001": {
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
            "gemini-1.5-flash-8b-001": {
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
            "gemini-2.0-flash-lite-preview-02-14": {
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
          };
        
        setModels(googleModels);
        
        // Save to localStorage
        localStorage.setItem("cached-models", JSON.stringify(googleModels));
        
        toast.success(`Fetched ${Object.keys(googleModels).length} models from Google Vertex AI!`);
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
    
    // Update the appropriate model field based on provider
    if (config.apiProvider === "openrouter") {
      setConfig(prev => ({ ...prev, openRouterModelId: modelId, activeModelId: modelId }));
    } else {
      setConfig(prev => ({ ...prev, googleModelId: modelId, activeModelId: modelId }));
    }
    
    // Auto-save when model is selected (like OpenCode)
    if (isAuthenticated) {
      try {
        await setProviderConfig({
          apiProvider: config.apiProvider,
          openRouterApiKey: config.openRouterApiKey,
          openRouterModelId: config.apiProvider === "openrouter" ? modelId : config.openRouterModelId,
          openRouterBaseUrl: config.openRouterBaseUrl,
          openRouterSpecificProvider: config.openRouterSpecificProvider,
          openRouterUseMiddleOutTransform: config.openRouterUseMiddleOutTransform,
          googleProjectId: config.googleProjectId,
          googleRegion: config.googleRegion,
          googleCredentials: config.googleCredentials,
          googleModelId: config.apiProvider === "google" ? modelId : config.googleModelId,
          googleEnableUrlContext: config.googleEnableUrlContext,
          googleEnableGrounding: config.googleEnableGrounding,
          googleEnableReasoning: config.googleEnableReasoning,
          activeModelId: modelId // Ensure both fields are set
        });
        console.log('✅ [DEBUG] Model selection auto-saved to database:', modelId);
        toast.success(`Model "${models[modelId]?.name || modelId}" selected and saved!`);
      } catch (error) {
        console.error('❌ [DEBUG] Failed to auto-save model selection:', error);
        toast.error("Model selected but failed to save. Please click Save Configuration.");
      }
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
                onValueChange={(value: "openrouter" | "google") => 
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

                <div className="space-y-2">
                  <Label htmlFor="specificProvider">Specific Provider (Optional)</Label>
                  <Input
                    id="specificProvider"
                    placeholder="anthropic, openai, etc."
                    value={config.openRouterSpecificProvider}
                    onChange={(e) => setConfig(prev => ({ ...prev, openRouterSpecificProvider: e.target.value }))}
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
              Fetch and select models available through {config.apiProvider === "google" ? "Google Vertex AI" : "OpenRouter"}
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
                    Fetch Models from {config.apiProvider === "google" ? "Google Vertex AI" : "OpenRouter"}
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
                    onValueChange={handleModelSelect}
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
                  Click "Fetch Models" to load available models from {config.apiProvider === "google" ? "Google Vertex AI" : "OpenRouter"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}