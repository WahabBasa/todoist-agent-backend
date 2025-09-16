import { AgentConfig, AgentRegistry as AgentRegistryType, AgentMode, Permission } from "./types";

// Simplified permissions following OpenCode's 3-level system
const PRIMARY_PERMISSIONS = {
  edit: "allow" as Permission,
  webfetch: "allow" as Permission,
  bash: {
    "*": "allow" as Permission,
  },
};

const SUBAGENT_PERMISSIONS = {
  edit: "deny" as Permission,
  webfetch: "allow" as Permission,
  bash: {
    "*": "ask" as Permission,
  },
};

// Mode-based system following the Roo pattern
export const MODES = {
  'primary': {
    name: 'Primary',
    systemPromptFile: 'zen_new',
    description: 'Executive assistant for task and calendar management.'
  },
  'planning': {
    name: 'Planning',
    systemPromptFile: 'planning_new',
    description: 'Strategic planning specialist using Eisenhower Matrix.'
  },
  'execution': {
    name: 'Execution',
    systemPromptFile: 'execution_new',
    description: 'Execution specialist for direct task operations.'
  }
};

// Built-in agent configurations with proper tool filtering
const BUILT_IN_AGENTS: AgentRegistryType = {
  primary: {
    name: "primary",
    description: "Executive assistant orchestrator - coordinates with planning and execution subagents as internal tools",
    mode: "primary",
    builtIn: true,
    temperature: 0.3,
    permissions: PRIMARY_PERMISSIONS,
    tools: {
      // READ-ONLY coordination tools
      task: true,
      internalTodoWrite: true,
      internalTodoRead: true,
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      listTools: true,
      
      // Plan file reading
      Read: true,
      
      // READ-ONLY data access
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // EXECUTION TOOLS - Primary agent can also execute directly for simple operations
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
      
      // DISABLED: Direct delegation tools (use task tool instead)
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  planning: {
    name: "planning",
    description: "Strategic planning specialist using Eisenhower Matrix for task prioritization",
    mode: "subagent",
    builtIn: true,
    temperature: 0.4,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // Planning and analysis tools
      getCurrentTime: true,
      getSystemStatus: true,
      validateInput: true,
      
      // Plan file writing
      Write: true,
      
      // READ-ONLY data access for planning
      getProjectAndTaskMap: true,
      getProjectDetails: true,
      getTaskDetails: true,
      getTasks: true,
      listCalendarEvents: true,
      searchCalendarEvents: true,
      
      // Internal workflow coordination
      internalTodoWrite: true,
      internalTodoRead: true,
      
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
      
      // DISABLED: No recursive delegation
      task: false,
      researchTask: false,
      analyzeCode: false,
      planTask: false,
    },
    options: {},
  },
  
  execution: {
    name: "execution",
    description: "Execution specialist for direct task and calendar operations",
    mode: "subagent", 
    builtIn: true,
    temperature: 0.2, // Lower temperature for precise execution
    permissions: SUBAGENT_PERMISSIONS,
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
      
      // EXECUTION TOOLS - The only agent that can modify data
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

// Agent registry management - following OpenCode's Agent namespace pattern
export class AgentRegistry {
  private static agents: AgentRegistryType = { ...BUILT_IN_AGENTS };

  /**
   * Get agent configuration by name (like OpenCode's Agent.get())
   */
  static getAgent(name: string): AgentConfig | null {
    const agent = this.agents[name] || null;
    console.log(`[AgentRegistry] Getting agent ${name}:`, agent ? 'found' : 'not found');
    return agent;
  }

  /**
   * List all agents (like OpenCode's Agent.list())
   */
  static getAllAgents(): AgentRegistryType {
    return { ...this.agents };
  }

  /**
   * Get agents by mode (like OpenCode's mode filtering)
   */
  static getAgentsByMode(mode: AgentMode): AgentConfig[] {
    return Object.values(this.agents).filter(
      agent => agent.mode === mode || agent.mode === "all"
    );
  }

  /**
   * Get available subagents for delegation (like OpenCode's subagent filtering)
   */
  static getAvailableSubagents(): AgentConfig[] {
    return this.getAgentsByMode("subagent");
  }

  /**
   * Get primary agents
   */
  static getPrimaryAgents(): AgentConfig[] {
    return this.getAgentsByMode("primary");
  }

  /**
   * Check if agent exists and is valid (like OpenCode's validation)
   */
  static isValidAgent(name: string): boolean {
    return name in this.agents;
  }

  /**
   * Check if agent can be used as subagent (like OpenCode's agent mode checking)
   */
  static canUseAsSubagent(name: string): boolean {
    const agent = this.getAgent(name);
    return agent ? (agent.mode === "subagent" || agent.mode === "all") : false;
  }

  /**
   * Check if agent can be used as primary
   */
  static canUseAsPrimary(name: string): boolean {
    const agent = this.getAgent(name);
    return agent ? (agent.mode === "primary" || agent.mode === "all") : false;
  }

  /**
   * Register a new custom agent (for future extensibility)
   * Following OpenCode's pattern but adapted for our system
   */
  static registerAgent(name: string, config: AgentConfig): void {
    if (config.builtIn && name in BUILT_IN_AGENTS) {
      throw new Error(`Cannot override built-in agent: ${name}`);
    }
    this.agents[name] = config;
  }

  /**
   * Get tool permissions for an agent (like OpenCode's tool filtering)
   */
  static getAgentTools(name: string): Record<string, boolean> {
    const agent = this.getAgent(name);
    return agent ? agent.tools : {};
  }

  /**
   * Check if agent has permission for a specific tool (like OpenCode's tool validation)
   */
  static hasToolPermission(agentName: string, toolName: string): boolean {
    const tools = this.getAgentTools(agentName);
    return tools[toolName] === true;
  }

  /**
   * Get agents filtered by mode (following OpenCode's agent filtering patterns)
   * Returns agents that are NOT "primary" (i.e., can be used as subagents)
   */
  static getSubagentCandidates(): AgentConfig[] {
    return Object.values(this.agents).filter(agent => agent.mode === "subagent");
  }
}