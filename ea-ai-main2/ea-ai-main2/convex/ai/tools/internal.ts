import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";

// Internal AI workflow coordination tools
// These are for AI self-management, not user task creation

export const internalTodoWrite: ToolDefinition = {
  id: "internalTodoWrite",
  description: `## internalTodoWrite
Description: AI WORKFLOW COORDINATION ONLY. Use this tool exclusively for managing complex multi-system operations that require systematic coordination and progress tracking. This is NOT for creating user tasks in Todoist.

**CRITICAL DISTINCTION: This tool is for AI internal planning and coordination, NOT for creating actual user tasks. User tasks go to createTask.**

When to use this tool:
- Complex multi-system operations (Todoist + Calendar + Analysis coordination)
- Bulk operations requiring systematic approach (deleting/updating many items with dependencies)
- Workflow orchestration with multiple interdependent steps
- Operations requiring error recovery and rollback capabilities
- When you need to track progress across 3+ distinct phases
- Cross-system synchronization tasks requiring careful sequencing

When NOT to use this tool:
- **NEVER use for simple user task creation** (use createTask instead)
- **NEVER use for straightforward operations** that can be done directly with single tool calls
- **NEVER use as a substitute for actual user task creation**
- **NEVER use for organizing existing tasks** without complex coordination needs
- **NEVER use when user asks to create specific tasks** (they want real Todoist tasks, not internal planning)

Required Todo Format:
Each todo must have:
- id: Unique identifier (use descriptive names like "sync-calendar-events" or "bulk-delete-completed")
- content: Specific, actionable description of coordination step
- status: "pending" | "in_progress" | "completed" | "cancelled"  
- priority: "high" (critical/blocking) | "medium" (important) | "low" (optional)

Priority Guidelines:
- HIGH: Operations that could cause data loss, API failures, or user-visible errors
- MEDIUM: Core functionality steps that must complete for workflow success
- LOW: Optional verification, logging, or cleanup tasks

Examples of CORRECT usage:

1. Complex cross-system operation:
User: "Delete all my completed tasks and create calendar events for all high-priority remaining tasks"
✅ CORRECT: Use internalTodoWrite for coordination:
[
  {"id": "get-workspace-map", "content": "Get complete task and project structure", "status": "pending", "priority": "high"},
  {"id": "identify-completed", "content": "Filter completed tasks for deletion", "status": "pending", "priority": "high"},
  {"id": "delete-completed-batch", "content": "Delete completed tasks in batches to avoid API limits", "status": "pending", "priority": "medium"},
  {"id": "identify-high-priority", "content": "Filter high-priority tasks for calendar events", "status": "pending", "priority": "medium"},
  {"id": "create-calendar-events", "content": "Create calendar events for high-priority tasks", "status": "pending", "priority": "medium"},
  {"id": "verify-sync", "content": "Verify all operations completed successfully", "status": "pending", "priority": "low"}
]

2. Bulk operation with error handling:
User: "Update all tasks in my Work project to have due dates next week"
✅ CORRECT: Use internalTodoWrite for systematic approach

Examples of INCORRECT usage:

1. Simple task creation:
User: "Create tasks for: buy groceries, call dentist, finish report"
❌ INCORRECT: Do NOT use internalTodoWrite 
✅ CORRECT: Use createTask three times directly

2. Basic task management:
User: "Show me my tasks and organize them by priority"
❌ INCORRECT: Do NOT use internalTodoWrite for simple display
✅ CORRECT: Use getProjectAndTaskMap directly

**WORKFLOW RULES**:
1. Create internal todos with clear, specific steps (3-6 todos max)
2. Mark only ONE todo as "in_progress" at a time
3. Complete each step fully before moving to next
4. Use internalTodoUpdate to mark progress
5. Use internalTodoClear when ALL coordination is complete

**CRITICAL REMINDER**: Internal todos are for AI coordination. They are NOT visible to users and do NOT create actual Todoist tasks. Always use createTask for user-requested task creation.`,
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