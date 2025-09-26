import { z } from "zod";
import { PromptLoader } from "../prompts/promptLoader";

// Subagent configuration (similar to OpenCode's Agent.Info but for isolated execution)
export const SubagentConfigSchema = z.object({
  // Unique identifier for the subagent
  name: z.string(),
  // Human-readable description of what this subagent does
  description: z.string(),
  // System prompt reference - either inline string or file name
  systemPrompt: z.string().optional(),
  // Prompt file name (preferred method)
  promptFile: z.string().optional(),
  // Which tools this subagent can access
  tools: z.record(z.string(), z.boolean()),
  // Whether this is a built-in system subagent
  builtIn: z.boolean(),
  // Temperature override for this subagent
  temperature: z.number().optional(),
  // Model configuration override
  model: z.object({
    providerId: z.string(),
    modelId: z.string(),
  }).optional(),
  // Subagent-specific options/parameters
  options: z.record(z.string(), z.any()).optional(),
});
export type SubagentConfig = z.infer<typeof SubagentConfigSchema>;

// Built-in subagent configurations - converted from former modes
const BUILT_IN_SUBAGENTS: Record<string, SubagentConfig> = {
  execution: {
    name: "execution",
    description: "Direct task and calendar operations with data validation",
    promptFile: "execution_new",
    tools: {
      // Data validation tools
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // READ access for validation and context
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // EXECUTION TOOLS - The primary tools for this subagent
      createTask: true,
      updateTask: true,
      deleteTask: true,
      createProject: true,
      updateProject: true,
      deleteProject: true,
      createBatchTasks: true,
      deleteBatchTasks: true,
      completeBatchTasks: true,
      updateBatchTasks: true,
      createProjectWithTasks: true,
      reorganizeTasksBatch: true,
      createCalendarEvent: true,
      updateCalendarEvent: true,
      deleteCalendarEvent: true,
      
      // Internal workflow for execution tracking
      internalTodoWrite: true,
      internalTodoRead: true,
      
      // DISABLED: No delegation (prevents recursion)
      task: false,
    },
    builtIn: true,
    temperature: 0.2, // Lower temperature for precise execution
    options: {},
  },

  general: {
    name: "general",
    description: "General-purpose research and multi-step task analysis",
    promptFile: "general",
    tools: {
      // Research and analysis tools
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // Internal workflow for complex analysis
      internalTodoWrite: true,
      internalTodoRead: true,
      
      // DISABLED: No execution tools (analysis only)
      createTask: false,
      updateTask: false,
      deleteTask: false,
      createProject: false,
      updateProject: false,
      deleteProject: false,
      createBatchTasks: false,
      deleteBatchTasks: false,
      completeBatchTasks: false,
      updateBatchTasks: false,
      createProjectWithTasks: false,
      reorganizeTasksBatch: false,
      createCalendarEvent: false,
      updateCalendarEvent: false,
      deleteCalendarEvent: false,
      
      // DISABLED: No delegation (prevents recursion)
      task: false,
    },
    builtIn: true,
    temperature: 0.3,
    options: {},
  },
};

// Subagent registry management - following OpenCode's Agent namespace pattern
export class SubagentRegistryClass {
  private static subagents: Record<string, SubagentConfig> = { ...BUILT_IN_SUBAGENTS };

  /**
   * Get subagent configuration by name (like OpenCode's Agent.get())
   */
  static getSubagent(name: string): SubagentConfig | null {
    const subagent = this.subagents[name] || null;
    if (!subagent) {
      console.log(`[SUBAGENT_NOT_FOUND] Subagent ${name} not found`);
    }
    return subagent;
  }

  /**
   * Get system prompt for a subagent (loads from file if promptFile specified)
   */
  static getSystemPrompt(name: string): string {
    const subagent = this.getSubagent(name);
    if (!subagent) {
      throw new Error(`Subagent '${name}' not found`);
    }

    // Use promptFile if specified (preferred method)
    if (subagent.promptFile) {
      try {
        return PromptLoader.loadPrompt(subagent.promptFile);
      } catch (error) {
        console.warn(`[SUBAGENT] Failed to load prompt file '${subagent.promptFile}' for subagent '${name}':`, error);
        // Fallback to inline systemPrompt if available
        if (subagent.systemPrompt) {
          return subagent.systemPrompt;
        }
        throw new Error(`No valid prompt found for subagent '${name}'`);
      }
    }

    // Fallback to inline systemPrompt
    if (subagent.systemPrompt) {
      return subagent.systemPrompt;
    }

    throw new Error(`No prompt configured for subagent '${name}'`);
  }

  /**
   * List all subagents (like OpenCode's Agent.list())
   */
  static getAllSubagents(): Record<string, SubagentConfig> {
    return { ...this.subagents };
  }

  /**
   * List subagents as array for easy iteration
   */
  static listSubagents(): SubagentConfig[] {
    return Object.values(this.subagents);
  }

  /**
   * Check if subagent exists and is valid (like OpenCode's validation)
   */
  static isValidSubagent(name: string): boolean {
    return name in this.subagents;
  }

  /**
   * Register a new custom subagent (like OpenCode's user-defined agents)
   * This makes it easy to add new subagents without code changes
   */
  static registerSubagent(config: SubagentConfig): void {
    // Validate required fields
    if (!config.name || !config.description || !config.systemPrompt) {
      throw new Error("Invalid subagent configuration: name, description, and systemPrompt are required");
    }

    // Prevent overriding built-in subagents
    if (config.builtIn && config.name in BUILT_IN_SUBAGENTS) {
      throw new Error(`Cannot override built-in subagent: ${config.name}`);
    }

    // Prevent recursive task tool access
    if (config.tools.task === true) {
      console.warn(`[SUBAGENT_REGISTER] Removing task tool from subagent ${config.name} to prevent recursion`);
      config.tools.task = false;
    }

    this.subagents[config.name] = config;
    console.log(`[SUBAGENT_REGISTERED] Successfully registered subagent: ${config.name}`);
  }

  /**
   * Get tool permissions for a subagent (like OpenCode's tool filtering)
   */
  static getSubagentTools(name: string): Record<string, boolean> {
    const subagent = this.getSubagent(name);
    return subagent ? subagent.tools : {};
  }

  /**
   * Check if subagent has permission for a specific tool (like OpenCode's tool validation)
   */
  static hasSubagentToolPermission(subagentName: string, toolName: string): boolean {
    const tools = this.getSubagentTools(subagentName);
    return tools[toolName] === true;
  }

  /**
   * Get subagents by built-in status
   */
  static getBuiltInSubagents(): SubagentConfig[] {
    return Object.values(this.subagents).filter(subagent => subagent.builtIn);
  }

  /**
   * Get custom (non-built-in) subagents
   */
  static getCustomSubagents(): SubagentConfig[] {
    return Object.values(this.subagents).filter(subagent => !subagent.builtIn);
  }

  /**
   * Remove a custom subagent (built-in subagents cannot be removed)
   */
  static removeSubagent(name: string): boolean {
    const subagent = this.getSubagent(name);
    if (!subagent) {
      return false;
    }

    if (subagent.builtIn) {
      throw new Error(`Cannot remove built-in subagent: ${name}`);
    }

    delete this.subagents[name];
    console.log(`[SUBAGENT_REMOVED] Successfully removed subagent: ${name}`);
    return true;
  }

  /**
   * Generate subagent list for task tool description (dynamic discovery)
   */
  static generateSubagentListDescription(): string {
    const subagents = this.listSubagents();
    return subagents
      .map(s => `- ${s.name}: ${s.description}`)
      .join("\n");
  }

  /**
   * Easy subagent creation helper (like OpenCode's simple configuration)
   */
  static createSubagent({
    name,
    description,
    systemPrompt,
    tools = {},
    temperature = 0.3,
    options = {}
  }: {
    name: string;
    description: string;
    systemPrompt: string;
    tools?: Record<string, boolean>;
    temperature?: number;
    options?: Record<string, any>;
  }): void {
    const config: SubagentConfig = {
      name,
      description,
      systemPrompt,
      tools: {
        // Default safe tools for all subagents
        getCurrentTime: true,
        getSystemStatus: true,
        validateInput: true,
        // Prevent task tool by default to avoid recursion
        task: false,
        // Merge with provided tools
        ...tools
      },
      builtIn: false,
      temperature,
      options,
    };

    this.registerSubagent(config);
  }
}

// Export singleton instance
export const SubagentRegistry = SubagentRegistryClass;

// Helper function for easy subagent creation (like OpenCode's simple interface)
export function createSubagent(config: {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: Record<string, boolean>;
  temperature?: number;
  options?: Record<string, any>;
}): void {
  SubagentRegistry.createSubagent(config);
}

// Export types for external use (SubagentConfig already exported above)