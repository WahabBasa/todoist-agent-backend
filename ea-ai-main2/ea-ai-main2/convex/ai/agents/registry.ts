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
    systemPrompt: "You are Zen, an AI secretary and personal assistant created to help manage your user's Todoist tasks and Google Calendar. Your role is to interact with the user, gather their requests, and handle very simple tasks directly. For any task that requires planning or execution, you must delegate to the 'plan' and 'execute' sub-agents. First, delegate to the 'plan' agent to create a plan, confirm it with the user, and then delegate to the 'execute' agent to carry it out.",
    temperature: 0.5,
  },

  // Disabled existing sub-agents
  // General subagent - equivalent to OpenCode's "general" agent
  // general: {
  //   name: "general",
  //   description: "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
  //   mode: "subagent",
  //   builtIn: true,
  //   permissions: SUBAGENT_PERMISSIONS,
  //   tools: {
  //     // No TaskTool - subagents cannot delegate further (prevents infinite recursion)
  //     task: false,
  //     
  //     // Read-only tools for research and analysis
  //     read: true,
  //     glob: true,
  //     grep: true,
  //     webfetch: true,
  //     
  //     // No modification tools
  //     write: false,
  //     edit: false,
  //     bash: false,
  //     
  //     // Limited external access
  //     getTodoistTasks: true, // Read-only access for context
  //     getGoogleCalendarEvents: true, // Read-only access for context
  //     
  //     // No creation/modification of external resources
  //     addTodoistTask: false,
  //     updateTodoistTask: false,
  //     deleteTodoistTask: false,
  //     addGoogleCalendarEvent: false,
  //     updateGoogleCalendarEvent: false,
  //     deleteGoogleCalendarEvent: false,
  //     
  //     // Utility tools
  //     getCurrentTime: true,
  //     listTools: true,
  //     internalPlanningAssistant: false, // Subagents shouldn't create internal todos
  //   },
  //   options: {
  //     maxSearchDepth: 5,
  //     includeContext: true,
  //   },
  //   systemPrompt: "You are a general-purpose research and analysis specialist. Your role is to thoroughly investigate topics, find relevant information, analyze documentation, and provide comprehensive insights. You have read-only access to systems and excel at multi-step problem solving and information synthesis.",
  //   temperature: 0.3,
  // },

  // Research specialist subagent
  // research: {
  //   name: "research",
  //   description: "Specialized agent for research tasks, information gathering, web searches, and analysis. Excellent for exploring complex topics, finding documentation, and synthesizing information from multiple sources.",
  //   mode: "subagent",
  //   builtIn: true,
  //   permissions: SUBAGENT_PERMISSIONS,
  //   tools: {
  //     // Research-focused tools only
  //     task: false,
  //     read: true,
  //     glob: true,
  //     grep: true,
  //     webfetch: true,
  //     
  //     // No modification capabilities
  //     write: false,
  //     edit: false,
  //     bash: false,
  //     
  //     // Read-only external access
  //     getTodoistTasks: true,
  //     getGoogleCalendarEvents: true,
  //     
  //     // No external modifications
  //     addTodoistTask: false,
  //     updateTodoistTask: false,
  //     deleteTodoistTask: false,
  //     addGoogleCalendarEvent: false,
  //     updateGoogleCalendarEvent: false,
  //     deleteGoogleCalendarEvent: false,
  //     
  //     // Utility tools
  //     getCurrentTime: true,
  //     listTools: true,
  //     internalPlanningAssistant: false,
  //   },
  //   options: {
  //     maxSearchDepth: 10, // Deeper research capability
  //     includeContext: true,
  //     researchMode: "comprehensive"
  //   },
  //   systemPrompt: "You are a research specialist. Your role is to thoroughly investigate topics, find relevant information, analyze documentation, and provide comprehensive insights. You excel at web searches, documentation analysis, and information synthesis. You work in read-only mode to analyze and explain information.",
  //   temperature: 0.2, // More focused for research
  // },

  // Code analysis specialist subagent
  // codeAnalysis: {
  //   name: "codeAnalysis",
  //   description: "Specialized agent for code analysis, architecture review, debugging, and technical investigation. Expert at understanding codebases, finding patterns, and explaining technical concepts.",
  //   mode: "subagent",
  //   builtIn: true,
  //   permissions: SUBAGENT_PERMISSIONS,
  //   tools: {
  //     // Code analysis tools
  //     task: false,
  //     read: true,
  //     glob: true,
  //     grep: true,
  //     webfetch: true, // For documentation lookup
  //     
  //     // No modification capabilities
  //     write: false,
  //     edit: false,
  //     bash: false,
  //     
  //     // Minimal external access (code analysis usually doesn't need external systems)
  //     getTodoistTasks: false,
  //     getGoogleCalendarEvents: false,
  //     addTodoistTask: false,
  //     updateTodoistTask: false,
  //     deleteTodoistTask: false,
  //     addGoogleCalendarEvent: false,
  //     updateGoogleCalendarEvent: false,
  //     deleteGoogleCalendarEvent: false,
  //     
  //     // Utility tools
  //     getCurrentTime: true,
  //     listTools: true,
  //     internalPlanningAssistant: false,
  //   },
  //   options: {
  //     includeLineNumbers: true,
  //     showContext: true,
  //     maxFileSize: 50000, // Limit large file analysis
  //     analysisMode: "detailed"
  //   },
  //   systemPrompt: "You are a code analysis specialist. Your expertise is in understanding codebases, analyzing architecture, finding bugs, explaining technical patterns, and providing insights about code quality and structure. You work in read-only mode to analyze and explain code without making modifications.",
  //   temperature: 0.1, // Very focused for technical analysis
  // },

  // New plan sub-agent
  plan: {
    name: "plan",
    description: "Analyzes user requests, gathers context from Todoist and Google Calendar, and creates a prioritized plan based on the Eisenhower Matrix. Operates in read-only mode.",
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
      
      // Read-only external access for context gathering
      getTodoistTasks: true,
      getGoogleCalendarEvents: true,
      
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
      maxSearchDepth: 10,
      includeContext: true,
    },
    systemPrompt: "You are Zen, an AI planning specialist and personal assistant. Your role is to analyze user requests, gather context from their Todoist and calendar, and create a prioritized plan using the Eisenhower Matrix. You must operate in a read-only mode and pass the final plan to the primary agent for confirmation.",
    temperature: 0.3,
  },

  // New execute sub-agent
  execute: {
    name: "execute",
    description: "Executes an approved plan by creating, updating, or deleting tasks in Todoist and events in Google Calendar. Has full read and write tool access.",
    mode: "subagent",
    builtIn: true,
    permissions: PRIMARY_PERMISSIONS, // Full permissions for execution
    tools: {
      // No TaskTool - subagents cannot delegate further (prevents infinite recursion)
      task: false,
      
      // Full tool access for execution
      read: true,
      write: true,
      edit: true,
      bash: true,
      webfetch: true,
      glob: true,
      grep: true,
      
      // Full external integration access for execution
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
      internalPlanningAssistant: false, // Subagents shouldn't create internal todos
    },
    options: {
      maxSearchDepth: 5,
      includeContext: true,
    },
    systemPrompt: "You are Zen, an AI execution specialist and personal assistant. Your role is to take an approved plan and execute it precisely by creating, updating, or deleting tasks in Todoist and events in Google Calendar. You have full read and write access to all necessary tools.",
    temperature: 0.5,
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