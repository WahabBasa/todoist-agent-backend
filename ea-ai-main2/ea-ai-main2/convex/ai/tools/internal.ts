import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";

// Internal AI workflow coordination tools
// These are for AI self-management, not user task creation

export const internalTodoWrite: ToolDefinition = {
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
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
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

      const result = await actionCtx.runMutation(api.aiInternalTodos.updateInternalTodos, {
        sessionId: ctx.sessionId as any,
        todos: args.todos,
      });
      
      const pendingCount = args.todos.filter((t: { status: string }) => t.status === "pending").length;
      const inProgressCount = args.todos.filter((t: { status: string }) => t.status === "in_progress").length;
      const completedCount = args.todos.filter((t: { status: string }) => t.status === "completed").length;
      
      const summary = {
        success: true,
        summary: `${args.todos.length} workflow todos managed (${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed)`,
        todos: args.todos,
      };

      // Metadata handled by tool registry bridge

      return {
        title: "Internal Workflow Updated",
        metadata: { todoCount: args.todos.length, pendingCount, inProgressCount, completedCount },
        output: JSON.stringify(summary)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to update internal workflow");
    }
  }
};

export const internalTodoRead: ToolDefinition = {
  id: "internalTodoRead",
  description: "Read your current internal todolist to check progress and understand what you're working on. Use this to stay organized and provide progress updates to users.",
  inputSchema: z.object({}),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const todoData = await actionCtx.runQuery(api.aiInternalTodos.getInternalTodos, {
        sessionId: ctx.sessionId as any,
      });
      
      const result = todoData ? {
        todos: todoData.todos,
        summary: todoData.summary,
        message: `Current internal workflow: ${todoData.summary.remaining} tasks remaining (${todoData.summary.pending} pending, ${todoData.summary.inProgress} in progress)`,
      } : {
        todos: [],
        summary: { total: 0, pending: 0, inProgress: 0, completed: 0, remaining: 0 },
        message: "No active internal workflow found",
      };

      // Metadata handled by tool registry bridge

      return {
        title: "Internal Workflow Status",
        metadata: todoData?.summary || { total: 0 },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to read internal workflow");
    }
  }
};



// Export all internal tools
export const InternalTools = {
  internalTodoWrite,
  internalTodoRead,
};