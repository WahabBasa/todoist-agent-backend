import { z } from "zod";

// Mode types - each agent becomes a mode
export const ModeType = z.enum(["primary", "information-collector", "planning", "execution"]);
export type ModeType = z.infer<typeof ModeType>;

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

// Core mode configuration (similar to OpenCode's Agent.Info)
export const ModeConfig = z.object({
  // Unique identifier for the mode
  name: z.string(),
  // Human-readable description
  description: z.string(),
  // Mode type (based on the original agent names)
  type: ModeType,
  // Whether this is a built-in system mode
  builtIn: z.boolean(),
  // What permissions this mode has
  permissions: ModePermissions,
  // Which tools this mode can access
  tools: z.record(z.string(), z.boolean()),
  // Mode-specific options/parameters
  options: z.record(z.string(), z.any()),
  // Custom system prompt for this mode (optional)
  systemPrompt: z.string().optional(),
  // Temperature override for this mode
  temperature: z.number().optional(),
  // Model configuration override
  model: z.object({
    providerId: z.string(),
    modelId: z.string(),
  }).optional(),
});
export type ModeConfig = z.infer<typeof ModeConfig>;

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

// Built-in mode configurations - each agent becomes a mode
const BUILT_IN_MODES: Record<string, ModeConfig> = {
  primary: {
    name: "primary",
    description: "Primary mode - orchestrates workflow and delegates to specialized modes when needed",
    type: "primary",
    builtIn: true,
    temperature: 0.3,
    permissions: PRIMARY_PERMISSIONS,
    tools: {
      // ORCHESTRATION TOOLS ONLY
      task: true,
      internalTodoWrite: true,
      internalTodoRead: true,
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
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
      
      // DISABLED: No direct planning or information gathering
      Write: false,
      Read: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  "information-collector": {
    name: "information-collector",
    description: "Information Collector mode - systematic information gathering and user questioning specialist",
    type: "information-collector",
    builtIn: true,
    temperature: 0.4,
    permissions: SUBMODE_PERMISSIONS,
    tools: {
      // INFORMATION GATHERING TOOLS
      internalTodoWrite: true,
      internalTodoRead: true,
      internalTodoUpdate: true,
      internalTodoClear: true,
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // READ access for information gathering
      Read: true,
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // DISABLED: No execution tools
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
      
      // DISABLED: No delegation
      task: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  planning: {
    name: "planning",
    description: "Planning mode - pure strategic planning specialist that creates plans from complete information packages",
    type: "planning",
    builtIn: true,
    temperature: 0.4,
    permissions: SUBMODE_PERMISSIONS,
    tools: {
      // PURE PLANNING TOOLS
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // Plan file writing
      Write: true,
      
      // READ access for planning (information already collected)
      Read: true,
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // DISABLED: No information gathering workflow (done by information-collector)
      internalTodoWrite: false,
      internalTodoRead: false,
      
      // DISABLED: No execution tools
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
      
      // DISABLED: No delegation
      task: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  execution: {
    name: "execution",
    description: "Execution mode - specialist for direct task and calendar operations",
    type: "execution",
    builtIn: true,
    temperature: 0.2, // Lower temperature for precise execution
    permissions: SUBMODE_PERMISSIONS,
    tools: {
      // Data validation tools
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // READ access for validation
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // EXECUTION TOOLS - The only mode that can modify data
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
      
      // DISABLED: No delegation
      task: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
};

// Mode registry management - following OpenCode's Agent namespace pattern
export class ModeRegistryClass {
  private static modes: Record<string, ModeConfig> = { ...BUILT_IN_MODES };

  /**
   * Get mode configuration by name (like OpenCode's Agent.get())
   */
  static getMode(name: string): ModeConfig | null {
    const mode = this.modes[name] || null;
    // Only log when mode is not found
    if (!mode) {
      console.log(`[MODE_NOT_FOUND] Mode ${name} not found`);
    }
    return mode;
  }

  /**
   * List all modes (like OpenCode's Agent.list())
   */
  static getAllModes(): Record<string, ModeConfig> {
    return { ...this.modes };
  }

  /**
   * Get modes by type
   */
  static getModesByType(type: ModeType): ModeConfig[] {
    return Object.values(this.modes).filter(
      mode => mode.type === type
    );
  }

  /**
   * Get primary modes
   */
  static getPrimaryModes(): ModeConfig[] {
    return this.getModesByType("primary");
  }

  /**
   * Get information-collector modes
   */
  static getInformationCollectorModes(): ModeConfig[] {
    return this.getModesByType("information-collector");
  }

  /**
   * Get planning modes
   */
  static getPlanningModes(): ModeConfig[] {
    return this.getModesByType("planning");
  }

  /**
   * Get execution modes
   */
  static getExecutionModes(): ModeConfig[] {
    return this.getModesByType("execution");
  }

  /**
   * Check if mode exists and is valid (like OpenCode's validation)
   */
  static isValidMode(name: string): boolean {
    return name in this.modes;
  }

  /**
   * Register a new custom mode (for future extensibility)
   * Following OpenCode's pattern but adapted for our system
   */
  static registerMode(name: string, config: ModeConfig): void {
    if (config.builtIn && name in BUILT_IN_MODES) {
      throw new Error(`Cannot override built-in mode: ${name}`);
    }
    this.modes[name] = config;
  }

  /**
   * Get tool permissions for a mode (like OpenCode's tool filtering)
   */
  static getModeTools(name: string): Record<string, boolean> {
    const mode = this.getMode(name);
    return mode ? mode.tools : {};
  }

  /**
   * Check if mode has permission for a specific tool (like OpenCode's tool validation)
   */
  static hasToolPermission(modeName: string, toolName: string): boolean {
    const tools = this.getModeTools(modeName);
    return tools[toolName] === true;
  }

  /**
   * Get the next mode in a logical workflow sequence
   */
  static getNextMode(currentMode: string): string {
    // Define a logical flow: primary -> information-collector -> planning -> execution -> primary
    const modeSequence = ["primary", "information-collector", "planning", "execution"];
    const currentIndex = modeSequence.indexOf(currentMode);
    
    if (currentIndex === -1) {
      return "primary"; // Default to primary if current mode not found
    }
    
    const nextIndex = (currentIndex + 1) % modeSequence.length;
    return modeSequence[nextIndex];
  }

  /**
   * Get workflow sequence for a specific task type
   */
  static getWorkflowSequence(taskType: string): string[] {
    // Define different workflow sequences based on task type
    switch (taskType) {
      case "complex-planning":
        return ["primary", "information-collector", "planning", "execution"];
      case "simple-execution":
        return ["primary", "execution"];
      case "information-gathering":
        return ["primary", "information-collector"];
      case "strategic-planning":
        return ["primary", "information-collector", "planning"];
      default:
        return ["primary"]; // Default to primary only
    }
  }

  /**
   * Get the appropriate mode for a given task
   */
  static getModeForTask(taskType: string): string {
    // Map task types to appropriate modes
    switch (taskType) {
      case "gather-information":
        return "information-collector";
      case "create-plan":
        return "planning";
      case "execute-task":
        return "execution";
      default:
        return "primary";
    }
  }

  /**
   * Check if mode can be used as information collector
   */
  static canUseAsInformationCollector(name: string): boolean {
    const mode = this.getMode(name);
    return mode ? mode.type === "information-collector" : false;
  }

  /**
   * Check if mode can be used as planning
   */
  static canUseAsPlanning(name: string): boolean {
    const mode = this.getMode(name);
    return mode ? mode.type === "planning" : false;
  }

  /**
   * Check if mode can be used as execution
   */
  static canUseAsExecution(name: string): boolean {
    const mode = this.getMode(name);
    return mode ? mode.type === "execution" : false;
  }
}

// Export a singleton instance
export const ModeRegistry = ModeRegistryClass;