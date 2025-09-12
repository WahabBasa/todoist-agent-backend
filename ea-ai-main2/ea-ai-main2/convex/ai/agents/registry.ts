import { AgentConfig, AgentRegistry as AgentRegistryType, AgentMode, Permission } from "./types";

// Default permissions for different agent types
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

// Built-in agent registry - following OpenCode patterns
export const BUILT_IN_AGENTS: AgentRegistryType = {
  // Primary agent - handles main user conversation and delegates tasks
  primary: {
    name: "primary",
    description: "Main conversation agent that handles user interactions and delegates complex tasks to specialized subagents",
    mode: "primary",
    builtIn: true,
    permissions: PRIMARY_PERMISSIONS,
    tools: {
      // Primary agent gets access to TaskTool for delegation
      task: true,
      // All standard tools
      read: true,
      write: true,
      edit: true,
      bash: true,
      webfetch: true,
      glob: true,
      grep: true,
      // Internal tools
      readUserMentalModel: false, // Removed as per recent architecture changes
      editUserMentalModel: false, // Removed as per recent architecture changes
      // Todoist integration
      addTodoistTask: true,
      getTodoistTasks: true,
      updateTodoistTask: true,
      deleteTodoistTask: true,
      // Google Calendar
      addGoogleCalendarEvent: true,
      getGoogleCalendarEvents: true,
      updateGoogleCalendarEvent: true,
      deleteGoogleCalendarEvent: true,
    },
    options: {},
    systemPrompt: "You are a primary AI assistant that can handle complex tasks by delegating to specialized subagents when appropriate. Use the TaskTool to delegate research, code analysis, or other specialized tasks to subagents.",
  },

  // Research subagent - specialized for information gathering and analysis
  research: {
    name: "research",
    description: "Specialized agent for research tasks, information gathering, web searches, and analysis. Excellent for exploring complex topics, finding documentation, and synthesizing information from multiple sources.",
    mode: "subagent",
    builtIn: true,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // Research-focused tools
      read: true,
      glob: true,
      grep: true,
      webfetch: true,
      // No editing capabilities
      write: false,
      edit: false,
      bash: false,
      task: false, // Subagents cannot delegate further
      // Limited access to external tools
      addTodoistTask: false,
      getTodoistTasks: true, // Can read existing tasks for context
      updateTodoistTask: false,
      deleteTodoistTask: false,
      // Calendar read-only access
      getGoogleCalendarEvents: true,
      addGoogleCalendarEvent: false,
      updateGoogleCalendarEvent: false,
      deleteGoogleCalendarEvent: false,
    },
    options: {
      // Research agent optimized for thorough analysis
      maxSearchDepth: 5,
      includeContext: true,
    },
    systemPrompt: "You are a research specialist. Your role is to thoroughly investigate topics, find relevant information, analyze documentation, and provide comprehensive insights. You have read-only access to systems and excel at information synthesis.",
    temperature: 0.3, // Lower temperature for more focused research
  },

  // Code analysis subagent - specialized for codebase understanding and technical analysis  
  codeAnalysis: {
    name: "codeAnalysis",
    description: "Specialized agent for code analysis, architecture review, debugging, and technical investigation. Expert at understanding codebases, finding patterns, and explaining technical concepts.",
    mode: "subagent", 
    builtIn: true,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // Code analysis tools
      read: true,
      glob: true,
      grep: true,
      webfetch: true, // For documentation lookup
      // No modification capabilities
      write: false,
      edit: false,
      bash: false,
      task: false,
      // No external integrations needed
      addTodoistTask: false,
      getTodoistTasks: false,
      updateTodoistTask: false,
      deleteTodoistTask: false,
      getGoogleCalendarEvents: false,
      addGoogleCalendarEvent: false,
      updateGoogleCalendarEvent: false,
      deleteGoogleCalendarEvent: false,
    },
    options: {
      // Code analysis specific settings
      includeLineNumbers: true,
      showContext: true,
      maxFileSize: 50000, // Limit large file analysis
    },
    systemPrompt: "You are a code analysis specialist. Your expertise is in understanding codebases, analyzing architecture, finding bugs, explaining technical patterns, and providing insights about code quality and structure. You work in read-only mode to analyze and explain code.",
    temperature: 0.2, // Very focused for technical analysis
  },
};

// Agent registry management functions
export class AgentRegistry {
  private static agents: AgentRegistryType = { ...BUILT_IN_AGENTS };

  /**
   * Get agent configuration by name
   */
  static getAgent(name: string): AgentConfig | null {
    return this.agents[name] || null;
  }

  /**
   * Get all available agents
   */
  static getAllAgents(): AgentRegistryType {
    return { ...this.agents };
  }

  /**
   * Get agents by mode (primary, subagent, or all)
   */
  static getAgentsByMode(mode: AgentMode): AgentConfig[] {
    return Object.values(this.agents).filter(
      agent => agent.mode === mode || agent.mode === "all"
    );
  }

  /**
   * Get available subagents for delegation
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
   * Check if agent exists and is valid
   */
  static isValidAgent(name: string): boolean {
    return name in this.agents;
  }

  /**
   * Check if agent can be used as subagent
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
   */
  static registerAgent(name: string, config: AgentConfig): void {
    if (config.builtIn && name in BUILT_IN_AGENTS) {
      throw new Error(`Cannot override built-in agent: ${name}`);
    }
    this.agents[name] = config;
  }

  /**
   * Get tool permissions for an agent
   */
  static getAgentTools(name: string): Record<string, boolean> {
    const agent = this.getAgent(name);
    return agent ? agent.tools : {};
  }

  /**
   * Check if agent has permission for a specific tool
   */
  static hasToolPermission(agentName: string, toolName: string): boolean {
    const tools = this.getAgentTools(agentName);
    return tools[toolName] === true;
  }
}