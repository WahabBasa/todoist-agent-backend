import { z } from "zod";

// Primary mode types - modes that preserve conversation context
export const PrimaryModeType = z.enum(["primary", "planning"]);
export type PrimaryModeType = z.infer<typeof PrimaryModeType>;

// Permission levels for different capabilities (following OpenCode's 3-level system)
export const Permission = z.enum(["allow", "deny", "ask"]);
export type Permission = z.infer<typeof Permission>;

// Mode permissions structure (simplified from OpenCode)
export const ModePermissions = z.object({
  // File editing capabilities
  edit: Permission,
  // Web fetching permissions
  webfetch: Permission,
  // Bash command execution (can be granular per command pattern)
  bash: z.record(z.string(), Permission),
});
export type ModePermissions = z.infer<typeof ModePermissions>;

// Primary mode configuration - for modes that preserve conversation context
export const PrimaryModeConfig = z.object({
  // Unique identifier for the mode
  name: z.string(),
  // Human-readable description
  description: z.string(),
  // Mode type (primary modes only)
  type: PrimaryModeType,
  // Whether this is a built-in system mode
  builtIn: z.boolean(),
  // What permissions this mode has
  permissions: ModePermissions,
  // Which tools this mode can access
  tools: z.record(z.string(), z.boolean()),
  // Mode-specific options/parameters
  options: z.record(z.string(), z.any()),
  // Custom system prompt injection for this mode - direct communication approach
  promptInjection: z.string().optional(),
  // Temperature override for this mode
  temperature: z.number().optional(),
  // Model configuration override
  model: z.object({
    providerId: z.string(),
    modelId: z.string(),
  }).optional(),
});
export type PrimaryModeConfig = z.infer<typeof PrimaryModeConfig>;

// Simplified permissions following OpenCode's approach
const PRIMARY_PERMISSIONS: ModePermissions = {
  edit: "allow",
  webfetch: "allow",
  bash: {
    "*": "allow",
  },
};

const SUBMODE_PERMISSIONS: ModePermissions = {
  edit: "deny",
  webfetch: "allow",
  bash: {
    "*": "ask",
  },
};

// Built-in primary mode configurations - only modes that preserve conversation context
const BUILT_IN_PRIMARY_MODES: Record<string, PrimaryModeConfig> = {
  primary: {
    name: "primary",
    description: "Primary mode - orchestrates workflow and delegates to specialized modes and subagents",
    type: "primary",
    builtIn: true,
    temperature: 0.3,
    permissions: PRIMARY_PERMISSIONS,
    tools: {
      // ORCHESTRATION TOOLS ONLY
      task: true,
      switchMode: true,
      evaluateUserResponse: true, // NEW: LLM decision-making tool
      internalTodoWrite: true,
      internalTodoRead: true,

      // READING TOOLS - Full read access for informed decision-making
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      listTools: true,

      // READ-ONLY data access for decision making
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // DISABLED: All direct execution tools (must delegate)
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
      
      // Read-only tools permitted in primary for context gathering
      Write: false,
      Read: true,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  planning: {
    name: "planning",
    description: "Planning mode - organizes user brain dumps by priority and urgency, asks very few questions per reply to avoid overwhelming users, confirms plans before execution",
    type: "planning",
    builtIn: true,
    temperature: 0.6,
    permissions: SUBMODE_PERMISSIONS,
    tools: {
      // PLANNING COORDINATION TOOLS
      evaluateUserResponse: true, // NEW: LLM decision-making tool for plan approval
      internalTodoWrite: true,
      internalTodoRead: true,
      internalTodoUpdate: true,
      internalTodoClear: true,
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,

      // READ access for planning context
      Read: true,
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,

      // ENABLE delegation to execution agent only
      task: true, // Allow delegation to execution subagent after plan confirmation

      // DISABLED: No direct execution tools (planning only)
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

      // DISABLED: No other delegations or writing tools
      Write: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
};

// Primary mode registry management - following OpenCode's Agent namespace pattern
export class PrimaryModeRegistryClass {
  private static primaryModes: Record<string, PrimaryModeConfig> = { ...BUILT_IN_PRIMARY_MODES };

  /**
   * Get primary mode configuration by name (like OpenCode's Agent.get())
   */
  static getPrimaryMode(name: string): PrimaryModeConfig | null {
    const mode = this.primaryModes[name] || null;
    // Only log when mode is not found
    if (!mode) {
      console.log(`[PRIMARY_MODE_NOT_FOUND] Primary mode ${name} not found`);
    }
    return mode;
  }

  /**
   * List all primary modes (like OpenCode's Agent.list())
   */
  static getAllPrimaryModes(): Record<string, PrimaryModeConfig> {
    return { ...this.primaryModes };
  }

  /**
   * Get primary modes by type
   */
  static getPrimaryModesByType(type: PrimaryModeType): PrimaryModeConfig[] {
    return Object.values(this.primaryModes).filter(
      mode => mode.type === type
    );
  }

  /**
   * Get all primary type modes
   */
  static getPrimaryTypeModes(): PrimaryModeConfig[] {
    return this.getPrimaryModesByType("primary");
  }

  /**
   * Get planning modes
   */
  static getPlanningModes(): PrimaryModeConfig[] {
    return this.getPrimaryModesByType("planning");
  }

  /**
   * Check if primary mode exists and is valid (like OpenCode's validation)
   */
  static isValidPrimaryMode(name: string): boolean {
    return name in this.primaryModes;
  }

  /**
   * Register a new custom primary mode (for future extensibility)
   * Following OpenCode's pattern but adapted for our system
   */
  static registerPrimaryMode(name: string, config: PrimaryModeConfig): void {
    if (config.builtIn && name in BUILT_IN_PRIMARY_MODES) {
      throw new Error(`Cannot override built-in primary mode: ${name}`);
    }
    this.primaryModes[name] = config;
  }

  /**
   * Get tool permissions for a primary mode (like OpenCode's tool filtering)
   */
  static getPrimaryModeTools(name: string): Record<string, boolean> {
    const mode = this.getPrimaryMode(name);
    return mode ? mode.tools : {};
  }

  /**
   * Check if primary mode has permission for a specific tool (like OpenCode's tool validation)
   */
  static hasPrimaryModeToolPermission(modeName: string, toolName: string): boolean {
    const tools = this.getPrimaryModeTools(modeName);
    return tools[toolName] === true;
  }

  /**
   * Check if name refers to a planning mode
   */
  static canUseAsPlanning(name: string): boolean {
    const mode = this.getPrimaryMode(name);
    return mode ? mode.type === "planning" : false;
  }

  /**
   * Check if name refers to the primary mode
   */
  static canUseAsPrimary(name: string): boolean {
    const mode = this.getPrimaryMode(name);
    return mode ? mode.type === "primary" : false;
  }

  // COMPATIBILITY METHODS for legacy code (maintain backward compatibility)
  
  /**
   * Legacy compatibility: Check if mode exists (delegates to primary mode check)
   */
  static isValidMode(name: string): boolean {
    return this.isValidPrimaryMode(name);
  }

  /**
   * Legacy compatibility: Get mode (delegates to primary mode)
   */
  static getMode(name: string): PrimaryModeConfig | null {
    return this.getPrimaryMode(name);
  }

  /** 
   * Legacy compatibility: Get mode tools (delegates to primary mode tools)
   */
  static getModeTools(name: string): Record<string, boolean> {
    const tools = this.getPrimaryModeTools(name);
    
    // Add delegation permissions based on mode type
    // Primary mode: Full subagent delegation and mode switching
    // Planning mode: Access to execution subagent only
    // Other modes: No delegation capabilities
    if (name === "primary") {
      // Allow delegation to any subagent and mode switching
      tools["task"] = true;
      tools["switchMode"] = true;
    } else if (name === "planning") {
      // Allow delegation to execution subagent only
      tools["task"] = true;
      tools["switchMode"] = false;
    } else {
      // Other modes have no delegation permissions
      tools["task"] = false;
      tools["switchMode"] = false;
    }
    
    return tools;
  }

  /**
   * Legacy compatibility: Check tool permission (delegates to primary mode)
   */
  static hasToolPermission(modeName: string, toolName: string): boolean {
    return this.hasPrimaryModeToolPermission(modeName, toolName);
  }

  /**
   * Legacy compatibility: Get next mode (simplified for primary modes only)
   */
  static getNextMode(currentMode: string): string {
    // Mode sequence for transitions: primary <-> planning
    if (currentMode === "primary") {
      return "planning";
    } else if (currentMode === "planning") {
      return "primary";
    }
    return "primary"; // Default fallback
  }

  /**
   * Legacy compatibility: Get mode for task (simplified mapping)
   */
  static getModeForTask(taskType: string): string {
    switch (taskType) {
      case "gather-information":
      case "information-gathering":
      case "planning":
      case "strategic-planning":
      case "prioritization":
        return "planning";
      default:
        return "primary";
    }
  }

  /**
   * Legacy compatibility: Get workflow sequence (simplified for primary modes)
   */
  static getWorkflowSequence(taskType: string): string[] {
    switch (taskType) {
      case "information-gathering":
      case "complex-planning":
      case "strategic-planning":
      case "prioritization":
        return ["primary", "planning", "execution"]; // Planning mode can delegate to execution
      default:
        return ["primary"];
    }
  }
}

// Export singleton instances
export const PrimaryModeRegistry = PrimaryModeRegistryClass;

// Legacy compatibility - will be removed after migration
export const ModeRegistry = PrimaryModeRegistryClass;