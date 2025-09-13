import { 
  getRulesSection,
  getCapabilitiesSection,
  getToolUseGuidelinesSection,
  getSystemInfoSection,
  getObjectiveSection,
  getModesSection,
  getCustomSystemPromptSection
} from "./sections";

export interface SystemPromptSettings {
  customPrompt?: string;
  dynamicInstructions?: string;
}

export function generateSystemPrompt(
  customPrompt?: string,
  dynamicInstructions?: string
): string {
  // Build the base prompt by combining all sections
  const basePrompt = [
    getObjectiveSection(),
    "",
    getToolUseGuidelinesSection(),
    "",
    getCapabilitiesSection(),
    "",
    getModesSection(),
    "",
    getRulesSection(),
    "",
    getSystemInfoSection()
  ].join("\n");

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