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

**Enhanced Structured Workflow Support (State Machine):**
The internal todo list acts as a state machine to track progress through these specific states:
1. **TASK_LIST_CREATED**: Initial task list created from user input
2. **INFO_COLLECTION**: Gathering information for each task (one at a time)
3. **CALENDAR_CONTEXT**: Collecting calendar context for better planning
4. **PRIORITY_ANALYSIS**: Updating Eisenhower Matrix categorization using all collected info
5. **PLAN_GENERATION**: Creating detailed recommendations using all collected info
6. **USER_APPROVAL**: Getting explicit confirmation before implementation
7. **PLAN_IMPLEMENTATION**: Executing the approved plan

Each todo item should represent a specific state transition or work item:
- id: Unique identifier following pattern "[state]-[task-name]" or "[work-item-id]"
- content: Specific, actionable description indicating state or work to be done
- status: "pending" | "in_progress" | "completed" | "cancelled"  
- priority: "high" (critical/blocking) | "medium" (important) | "low" (optional)

**Critical Principle: Information Collection Only**
During the planning phase, the agent MUST ONLY collect information and NEVER:
❌ Provide solutions or recommendations for individual tasks
❌ Give advice on how to handle specific items
❌ Dive deep into solving one item before collecting info for all items
❌ Suggest actions for individual tasks during info collection

All solutions and recommendations come ONLY in the final comprehensive plan after collecting information for ALL tasks.

When to use structured workflow:
- When users brain dump multiple tasks and need systematic information collection
- When you need to collect information for multiple tasks one at a time
- When you want to ensure all tasks are addressed systematically
- When you need to get user approval before implementation

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

3. Structured information collection with state machine:
User: "I have taxes, work deadlines, and apartment organization tasks"
✅ CORRECT: Use internalTodoWrite with state machine workflow:
[
  {"id": "state-task-list", "content": "STATE: Task list created from user input", "status": "in_progress", "priority": "high"},
  {"id": "taxes-deadline", "content": "COLLECT_INFO: taxes - When is this due?", "status": "pending", "priority": "high"},
  {"id": "work-deadline", "content": "COLLECT_INFO: work deadlines - When are these due?", "status": "pending", "priority": "high"},
  {"id": "apt-deadline", "content": "COLLECT_INFO: apartment organization - Any particular deadline?", "status": "pending", "priority": "medium"},
  {"id": "calendar-context", "content": "STATE: Collect calendar context for better planning", "status": "pending", "priority": "high"},
  {"id": "priority-analysis", "content": "STATE: Update Eisenhower Matrix priorities using all info", "status": "pending", "priority": "high"},
  {"id": "plan-generation", "content": "STATE: Create detailed plan using Eisenhower Matrix", "status": "pending", "priority": "high"},
  {"id": "user-approval", "content": "STATE: Confirm plan with user before implementation", "status": "pending", "priority": "high"}
]

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
1. Create internal todos with clear, specific steps (3-10 todos for structured workflow)
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

      await actionCtx.runMutation(api.aiInternalTodos.updateInternalTodos, {
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
};;

export const internalTodoRead: ToolDefinition = {
  id: "internalTodoRead",
  description: "Read your current internal todolist to check progress and understand what you're working on. Use this to stay organized and provide progress updates to users.",
  inputSchema: z.object({}),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void args;
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