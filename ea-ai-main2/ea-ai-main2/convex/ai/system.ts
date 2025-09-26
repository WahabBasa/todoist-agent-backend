// OpenCode-inspired dynamic prompt system for Todoist Agent Backend
import { api } from "../_generated/api";
import { MessageCaching } from "./caching";
import { generateSystemPrompt } from "./prompts/system";
import { PromptLoader } from "./prompts/promptLoader";

export namespace SystemPrompt {
  
  // Provider-based prompt selection
  export function provider(modelID: string): string {
    // For now, all models use the same Zen prompt
    // Future: different prompts for different providers
    if (modelID.includes("claude") || modelID.includes("anthropic")) {
      return "zen_new";
    }
    return "zen_new"; // Default to zen_new prompt
  }

  // Environment context injection (similar to OpenCode)
  export function environment(): string {
    return `
<current_date_context>
**Today's Date**: ${new Date().toISOString().split('T')[0]} (${new Date().getFullYear()})
**Calendar Rule**: ALL events must be created in ${new Date().getFullYear()} or later years
**Relative Dates**: Calculate from current date using getCurrentTime() first
</current_date_context>`;
  }

  // Load prompt from file (now actually loads from files!)
  export function getPrompt(promptName: string): string {
    try {
      return PromptLoader.loadPrompt(promptName);
    } catch (error) {
      console.warn(`[SystemPrompt] Failed to load prompt '${promptName}':`, error);
      // Fallback to zen_new prompt
      return PromptLoader.loadPrompt("zen_new");
    }
  }

  // Detect if enhanced internal todo prompt should be used
  // Only for genuinely complex multi-system operations requiring coordination
  export function shouldUseEnhancedTodoPrompt(message: string): boolean {
    // True bulk operations with "all" keyword
    const hasBulkOperations = /(?:delete|update|move|complete|modify|change|remove)\s+(?:all|every|each)(?:\s+(?:my|the))?\s+(?:task|project|event|item)/i.test(message);
    
    // Large quantity operations (20+ items or words like "many")
    const hasQuantifiedTasks = /(?:delete|update|move|complete).*(?:\d{2,}|many|dozens|hundreds).*(?:task|project|event)/i.test(message);
    
    // Cross-system operations (Todoist + Calendar + other systems)
    const hasCrossSystemWork = /(?:todoist|calendar|google|sync|integrate).*(?:and|with|\+).*(?:todoist|calendar|google|sync|integrate)/i.test(message);
    
    // Complex analysis and reorganization
    const hasComplexAnalysis = /(?:analyze|reorganize|restructure|optimize).*(?:project|task|workflow|system)/i.test(message);
    
    // Multi-step workflow coordination (not simple task creation)
    const hasWorkflowCoordination = /(?:delete.*and.*create|update.*and.*organize|move.*and.*analyze)/i.test(message);
    
    // EXCLUDE simple task creation patterns
    const isSimpleTaskCreation = /^(?:create|add|make)(?:\s+(?:these|following|some))?\s+task/i.test(message.trim());
    const isSimpleOrganization = /^(?:help|arrange|organize)\s+(?:these|following)\s+task/i.test(message.trim());
    
    // Don't trigger enhanced prompt for simple operations
    if (isSimpleTaskCreation || isSimpleOrganization) {
      return false;
    }
    
    return hasBulkOperations || hasQuantifiedTasks || hasCrossSystemWork || hasComplexAnalysis || hasWorkflowCoordination;
  }

  // Load user's active custom system prompt from database
  export async function getCustomSystemPromptFromDB(ctx: any, userId: string): Promise<string> {
    try {
      const customPromptData = await ctx.runQuery(api.customSystemPrompts.getActiveCustomPrompt, {
        tokenIdentifier: userId,
      });

      if (customPromptData.exists && customPromptData.content) {
        return customPromptData.content;
      } else {
        return ""; // No custom prompt
      }
    } catch (error) {
      console.warn(`[SystemPrompt] Failed to load custom system prompt for user ${userId.substring(0, 20)}...:`, error);
      return ""; // Graceful degradation
    }
  }

  // Main prompt getter that combines provider selection with environment
  export async function getSystemPrompt(
    ctx: any, // ActionCtx for database access
    modelID: string, 
    dynamicInstructions: string = "", 
    userMessage: string = "", 
    userId?: string,
    modeName: string = "primary"
  ): Promise<string> {
    let promptName = getModeSpecificPrompt(modeName, userMessage);
    
    // Load user's custom system prompt if available
    let customPrompt = "";
    if (userId && ctx) {
      customPrompt = await getCustomSystemPromptFromDB(ctx, userId);
    }
    
    // Generate the modular system prompt
    const basePrompt = generateSystemPrompt(customPrompt, dynamicInstructions, promptName);
    
    const envContext = environment();
    
    // Add current mode context to the prompt
    const modeContext = `
<current_mode_context>
**Current Mode**: ${modeName}
**Mode Capabilities**: Available modes and switching instructions have been provided in the system prompt
**Mode Switching**: Use switchMode tool to autonomously change modes when appropriate
**Goal-Driven Switching**: Switch modes to reduce user overwhelm and operational overhead
</current_mode_context>`;
    
    // Integration point: Custom prompt gets injected after base prompt, before environment context
    return basePrompt + modeContext + envContext;
  }
  
  // Mode-specific prompt selection with intelligent fallback
  // For primary mode: always use zen_new so the primary agent can make intelligent decisions
  // For other modes: use their specific prompts, but allow enhanced todo if appropriate
  function getModeSpecificPrompt(modeName: string, userMessage: string): string {
    // For non-primary modes, we can still use enhanced todo prompt if needed
    if (modeName !== "primary" && shouldUseEnhancedTodoPrompt(userMessage)) {
      return "internalTodoEnhanced";
    }
    
    // Map modes to their specific prompts
    const modePromptMap: Record<string, string> = {
      "primary": "zen_new",
      "information-collector": "information_collector_new", 
      "planning": "planning_new",
      "execution": "execution_new"
    };
    
    return modePromptMap[modeName] || "zen_new";
  }

  // Synchronous version for backward compatibility (without custom prompts)
  export function getSystemPromptSync(
    modelID: string, 
    dynamicInstructions: string = "", 
    userMessage: string = "", 
    modeName: string = "primary"
  ): string {
    let promptName = provider(modelID);
    
    // Use enhanced internal todo prompt for complex operations in non-primary modes
    // For primary mode, keep zen_new prompt so primary agent can make intelligent decisions
    if (promptName !== "zen_new" && shouldUseEnhancedTodoPrompt(userMessage)) {
      promptName = "internalTodoEnhanced";
    }
    
    // Generate the modular system prompt
    const basePrompt = generateSystemPrompt("", dynamicInstructions);
    const envContext = environment();
    
    // Add current mode context to the prompt
    const modeContext = `
<current_mode_context>
**Current Mode**: ${modeName}
**Mode Capabilities**: Available modes and switching instructions have been provided in the system prompt
**Mode Switching**: Use switchMode tool to autonomously change modes when appropriate
**Goal-Driven Switching**: Switch modes to reduce user overwhelm and operational overhead
</current_mode_context>`;
    
    return basePrompt + modeContext + envContext;
  }


}