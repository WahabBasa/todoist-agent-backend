import { z } from "zod";

// =================================================================
// PURE TOOL DEFINITIONS - OpenCode Inspired
// Tools return data, orchestrator handles all state changes
// Eliminates circular dependencies by removing direct mutations
// =================================================================

/**
 * Pure tool context - no ActionCtx, no direct database access
 * Tools receive only what they need to compute results
 */
export interface PureToolContext {
  sessionID: string;
  messageID: string;
  callID: string;
  userId: string;
  abort: AbortSignal;
  // Removed: database access, mutations, queries
  // Tools are now pure functions
}

/**
 * Tool execution result - structured data returned to orchestrator
 * The orchestrator will handle all database operations based on this result
 */
export interface ToolResult {
  success: boolean;
  data: any; // The core data produced by the tool
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  sideEffects?: SideEffect[]; // Actions for orchestrator to perform
  error?: string;
}

/**
 * Side effects that tools want the orchestrator to perform
 * This replaces direct mutation calls
 */
export interface SideEffect {
  type: 'mutation' | 'query' | 'external_api';
  operation: string; // e.g., "aiInternalTodos.updateInternalTodos"
  args: any;
  priority?: 'high' | 'normal' | 'low';
  dependsOn?: string[]; // IDs of other side effects this depends on
}

/**
 * Pure tool definition interface
 * Tools are now pure functions that return structured results
 */
export interface PureToolDefinition {
  id: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: any, ctx: PureToolContext) => Promise<ToolResult>;
}

/**
 * PURE INTERNAL TOOLS
 * Refactored to return data instead of calling mutations
 */

export const pureInternalTodoWrite: PureToolDefinition = {
  id: "internalTodoWrite",
  description: "AI WORKFLOW COORDINATION ONLY. Use ONLY for complex multi-system operations requiring systematic coordination. NEVER use for simple user task creation. Examples: 'Delete all completed tasks AND reorganize by priority' (coordination needed). NOT for: 'Create these 5 tasks' (use createTask instead).",
  inputSchema: z.object({
    todos: z.array(z.object({
      id: z.string().describe("Unique identifier for the todo item"),
      content: z.string().describe("Brief description of the AI coordination task"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status"),
      priority: z.enum(["high", "medium", "low"]).describe("Priority level"),
    })).describe("The updated todo list for internal workflow coordination"),
  }),
  async execute(args: any, ctx: PureToolContext): Promise<ToolResult> {
    try {
      // Validate that this is appropriate usage
      const hasCoordinationTasks = args.todos.some((todo: any) => 
        todo.content.toLowerCase().includes('coordinate') ||
        todo.content.toLowerCase().includes('analyze') ||
        todo.content.toLowerCase().includes('organize') ||
        todo.content.toLowerCase().includes('bulk') ||
        todo.content.toLowerCase().includes('multiple')
      );

      if (!hasCoordinationTasks && args.todos.length > 0) {
        console.warn('[InternalTodo] Warning: internalTodoWrite used without clear coordination need');
      }

      const pendingCount = args.todos.filter((t: { status: string }) => t.status === "pending").length;
      const inProgressCount = args.todos.filter((t: { status: string }) => t.status === "in_progress").length;
      const completedCount = args.todos.filter((t: { status: string }) => t.status === "completed").length;
      
      const todoData = {
        todos: args.todos,
        summary: {
          total: args.todos.length,
          pending: pendingCount,
          inProgress: inProgressCount,
          completed: completedCount,
          remaining: pendingCount + inProgressCount,
        },
      };

      // Return structured data + side effect for orchestrator to execute
      return {
        success: true,
        data: todoData,
        metadata: {
          title: "Workflow Coordination Updated",
          description: `${args.todos.length} workflow todos managed (${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed)`,
          todoCount: args.todos.length,
          pendingCount,
          inProgressCount,
          completedCount,
          workflowType: "internal_coordination"
        },
        sideEffects: [
          {
            type: 'mutation',
            operation: 'aiInternalTodos.updateInternalTodos',
            args: {
              sessionId: ctx.sessionID,
              todos: args.todos,
            },
            priority: 'high',
          }
        ],
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to process internal workflow",
      };
    }
  }
};

export const pureInternalTodoRead: PureToolDefinition = {
  id: "internalTodoRead",
  description: "Read your current internal todolist to check progress and understand what you're working on. Use this to stay organized and provide progress updates to users.",
  inputSchema: z.object({}),
  async execute(args: any, ctx: PureToolContext): Promise<ToolResult> {
    try {
      // Pure function - returns side effect for orchestrator to fetch data
      return {
        success: true,
        data: null, // Data will be populated by orchestrator after query
        metadata: {
          title: "Requesting Workflow Status",
          description: "Fetching current internal todolist",
        },
        sideEffects: [
          {
            type: 'query',
            operation: 'aiInternalTodos.getInternalTodos',
            args: {
              sessionId: ctx.sessionID,
            },
            priority: 'normal',
          }
        ],
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to request workflow status",
      };
    }
  }
};

export const pureMentalModelRead: PureToolDefinition = {
  id: "mentalModelRead",
  description: "Read the user's behavioral patterns and mental model to understand their preferences and working style. Use this to tailor your responses appropriately.",
  inputSchema: z.object({}),
  async execute(args: any, ctx: PureToolContext): Promise<ToolResult> {
    try {
      return {
        success: true,
        data: null, // Will be populated by orchestrator
        metadata: {
          title: "Reading User Mental Model",
          description: "Fetching user behavioral patterns and preferences",
        },
        sideEffects: [
          {
            type: 'query',
            operation: 'mentalModels.getUserMentalModel',
            args: {
              tokenIdentifier: ctx.userId,
            },
            priority: 'normal',
          }
        ],
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to request mental model",
      };
    }
  }
};

export const pureMentalModelEdit: PureToolDefinition = {
  id: "mentalModelEdit",
  description: "Update the user's mental model based on observed patterns and behaviors. Use this to improve future interactions by learning from user feedback and preferences.",
  inputSchema: z.object({
    observation: z.string().describe("The behavioral pattern or preference you observed"),
    replacement: z.string().describe("How to update the mental model with this new understanding"),
  }),
  async execute(args: any, ctx: PureToolContext): Promise<ToolResult> {
    try {
      const oldString = args.observation;
      const newString = args.replacement;

      if (!oldString || !newString) {
        throw new Error("Both observation and replacement are required for mental model updates");
      }

      const updateData = {
        observation: oldString,
        replacement: newString,
        timestamp: Date.now(),
        context: {
          sessionId: ctx.sessionID,
          messageId: ctx.messageID,
        },
      };

      return {
        success: true,
        data: updateData,
        metadata: {
          title: "Mental Model Updated",
          description: `Updated user understanding: ${oldString} → ${newString}`,
          observationType: "behavioral_pattern",
        },
        sideEffects: [
          {
            type: 'mutation',
            operation: 'mentalModels.editMentalModel',
            args: {
              tokenIdentifier: ctx.userId,
              oldString,
              newString,
            },
            priority: 'normal',
          }
        ],
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to update mental model",
      };
    }
  }
};

/**
 * Pure tool registry
 * Maps tool IDs to pure tool definitions
 */
export const PureToolRegistry: Record<string, PureToolDefinition> = {
  internalTodoWrite: pureInternalTodoWrite,
  internalTodoRead: pureInternalTodoRead,
  mentalModelRead: pureMentalModelRead,
  mentalModelEdit: pureMentalModelEdit,
};

/**
 * Helper function to check if a tool is available in pure form
 */
export function isPureToolAvailable(toolId: string): boolean {
  return toolId in PureToolRegistry;
}

/**
 * Execute a pure tool and return the result
 * This is called by the orchestrator, not directly by AI SDK
 */
export async function executePureTool(
  toolId: string,
  args: any,
  ctx: PureToolContext
): Promise<ToolResult> {
  const tool = PureToolRegistry[toolId];
  if (!tool) {
    return {
      success: false,
      data: null,
      error: `Pure tool not found: ${toolId}`,
    };
  }

  try {
    // Validate input args against schema
    const validatedArgs = tool.inputSchema.parse(args);
    return await tool.execute(validatedArgs, ctx);
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : `Failed to execute pure tool: ${toolId}`,
    };
  }
}