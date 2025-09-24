import { 
  getRulesSection,
  getCapabilitiesSection,
  getToolUseGuidelinesSection,
  getSystemInfoSection,
  getObjectiveSection,
  getModesSection,
  getCustomSystemPromptSection
} from "./sections";
import { PromptLoader } from "./promptLoader";

export interface SystemPromptSettings {
  customPrompt?: string;
  dynamicInstructions?: string;
}

export function generateSystemPrompt(
  customPrompt?: string,
  dynamicInstructions?: string,
  agentPromptName?: string
): string {
  // Use agent-specific prompt if provided, otherwise use zen_new as default
  if (agentPromptName) {
    return getAgentSpecificPromptContent(agentPromptName, customPrompt, dynamicInstructions);
  }
  
  // Use zen_new as default prompt loaded from file
  const basePrompt = PromptLoader.loadPrompt("zen_new");
  
  // Add custom prompt if provided
  const customSection = getCustomSystemPromptSection(customPrompt || "");
  
  // Combine all parts
  const fullPrompt = [
    basePrompt,
    customSection,
    dynamicInstructions || ""
  ].filter(Boolean).join("\n");

  return fullPrompt;
}

function getAgentSpecificPromptContent(
  agentPromptName: string, 
  customPrompt?: string, 
  dynamicInstructions?: string
): string {
  // Load agent-specific prompts from files
  let agentPrompt: string;
  
  try {
    agentPrompt = PromptLoader.loadPrompt(agentPromptName);
  } catch (error) {
    console.warn(`[SystemPrompt] Failed to load prompt '${agentPromptName}':`, error);
    // Fallback to zen_new prompt
    agentPrompt = PromptLoader.loadPrompt("zen_new");
  }
  
  // Combine with custom sections
  const customSection = getCustomSystemPromptSection(customPrompt || "");
  
  return [
    agentPrompt,
    customSection,
    dynamicInstructions || ""
  ].filter(Boolean).join("\n");
}

// All prompts now loaded from files via PromptLoader
// No more hardcoded prompt functions needed!