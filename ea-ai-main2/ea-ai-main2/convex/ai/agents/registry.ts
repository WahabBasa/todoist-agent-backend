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

// Built-in agent registry - following OpenCode's BUILTIN agents pattern
export const BUILT_IN_AGENTS: AgentRegistryType = {
  // Primary agent - equivalent to OpenCode's "build" agent
  primary: {
    name: "primary",
    description: "Main conversation agent that handles user interactions and delegates complex tasks to specialized subagents. Has full tool access including TaskTool for delegation.",
    mode: "primary",
    builtIn: true,
    permissions: PRIMARY_PERMISSIONS,
    tools: {
      // TaskTool for delegation - key difference from subagents
      task: true,
      
      // Full tool access
      read: true,
      write: true,
      edit: true,
      bash: true,
      webfetch: true,
      glob: true,
      grep: true,
      
      // External integrations
      addTodoistTask: true,
      getTodoistTasks: true,
      updateTodoistTask: true,
      deleteTodoistTask: true,
      addGoogleCalendarEvent: true,
      getGoogleCalendarEvents: true,
      updateGoogleCalendarEvent: true,
      deleteGoogleCalendarEvent: true,
      
      // Utility tools
      getCurrentTime: true,
      listTools: true,
      internalPlanningAssistant: true,
    },
    options: {},
    systemPrompt: "You are a primary AI assistant that manages complex tasks by delegating to specialized subagents when appropriate. Use the TaskTool to delegate research, code analysis, or other specialized tasks to subagents while handling direct user interaction and tool execution yourself.",
    temperature: 0.5,
  },

  // General subagent - equivalent to OpenCode's "general" agent
  general: {
    name: "general",
    description: "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
    mode: "subagent",
    builtIn: true,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // No TaskTool - subagents cannot delegate further (prevents infinite recursion)
      task: false,
      
      // Read-only tools for research and analysis
      read: true,
      glob: true,
      grep: true,
      webfetch: true,
      
      // No modification tools
      write: false,
      edit: false,
      bash: false,
      
      // Limited external access
      getTodoistTasks: true, // Read-only access for context
      getGoogleCalendarEvents: true, // Read-only access for context
      
      // No creation/modification of external resources
      addTodoistTask: false,
      updateTodoistTask: false,
      deleteTodoistTask: false,
      addGoogleCalendarEvent: false,
      updateGoogleCalendarEvent: false,
      deleteGoogleCalendarEvent: false,
      
      // Utility tools
      getCurrentTime: true,
      listTools: true,
      internalPlanningAssistant: false, // Subagents shouldn't create internal todos
    },
    options: {
      maxSearchDepth: 5,
      includeContext: true,
    },
    systemPrompt: "You are a general-purpose research and analysis specialist. Your role is to thoroughly investigate topics, find relevant information, analyze documentation, and provide comprehensive insights. You have read-only access to systems and excel at multi-step problem solving and information synthesis.",
    temperature: 0.3,
  },

  // Research specialist subagent
  research: {
    name: "research",
    description: "Specialized agent for research tasks, information gathering, web searches, and analysis. Excellent for exploring complex topics, finding documentation, and synthesizing information from multiple sources.",
    mode: "subagent",
    builtIn: true,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // Research-focused tools only
      task: false,
      read: true,
      glob: true,
      grep: true,
      webfetch: true,
      
      // No modification capabilities
      write: false,
      edit: false,
      bash: false,
      
      // Read-only external access
      getTodoistTasks: true,
      getGoogleCalendarEvents: true,
      
      // No external modifications
      addTodoistTask: false,
      updateTodoistTask: false,
      deleteTodoistTask: false,
      addGoogleCalendarEvent: false,
      updateGoogleCalendarEvent: false,
      deleteGoogleCalendarEvent: false,
      
      // Utility tools
      getCurrentTime: true,
      listTools: true,
      internalPlanningAssistant: false,
    },
    options: {
      maxSearchDepth: 10, // Deeper research capability
      includeContext: true,
      researchMode: "comprehensive"
    },
    systemPrompt: "You are a research specialist. Your role is to thoroughly investigate topics, find relevant information, analyze documentation, and provide comprehensive insights. You excel at web searches, documentation analysis, and information synthesis. You work in read-only mode to analyze and explain information.",
    temperature: 0.2, // More focused for research
  },

  // Code analysis specialist subagent
  codeAnalysis: {
    name: "codeAnalysis",
    description: "Specialized agent for code analysis, architecture review, debugging, and technical investigation. Expert at understanding codebases, finding patterns, and explaining technical concepts.",
    mode: "subagent", 
    builtIn: true,
    permissions: SUBAGENT_PERMISSIONS,
    tools: {
      // Code analysis tools
      task: false,
      read: true,
      glob: true,
      grep: true,
      webfetch: true, // For documentation lookup
      
      // No modification capabilities
      write: false,
      edit: false,
      bash: false,
      
      // Minimal external access (code analysis usually doesn't need external systems)
      getTodoistTasks: false,
      getGoogleCalendarEvents: false,
      addTodoistTask: false,
      updateTodoistTask: false,
      deleteTodoistTask: false,
      addGoogleCalendarEvent: false,
      updateGoogleCalendarEvent: false,
      deleteGoogleCalendarEvent: false,
      
      // Utility tools
      getCurrentTime: true,
      listTools: true,
      internalPlanningAssistant: false,
    },
    options: {
      includeLineNumbers: true,
      showContext: true,
      maxFileSize: 50000, // Limit large file analysis
      analysisMode: "detailed"
    },
    systemPrompt: "You are a code analysis specialist. Your expertise is in understanding codebases, analyzing architecture, finding bugs, explaining technical patterns, and providing insights about code quality and structure. You work in read-only mode to analyze and explain code without making modifications.",
    temperature: 0.1, // Very focused for technical analysis
  },
};

// Agent registry management - following OpenCode's Agent namespace pattern
export class AgentRegistry {
  private static agents: AgentRegistryType = { ...BUILT_IN_AGENTS };

  /**
   * Get agent configuration by name (like OpenCode's Agent.get())
   */
  static getAgent(name: string): AgentConfig | null {
    return this.agents[name] || null;
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
    return Object.values(this.agents).filter(agent => agent.mode !== "primary");
  }
}