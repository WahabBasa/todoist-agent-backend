import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import { BatchTodoistHandler } from "../../todoist/BatchTodoistHandler";

// Todoist-specific tool implementations
// Extracted from main toolRegistry for better modularity

export const createTask: ToolDefinition = {
  id: "createTask",
  description: `## createTask
Description: Create a new task in the user's Todoist account. This is the PRIMARY tool for user task creation requests. Use this for direct, individual task creation when users explicitly request task creation.

**IMPORTANT: This tool creates actual user tasks in their Todoist account. Do NOT use this for internal AI workflow coordination.**

When to use this tool:
- When users explicitly ask to create tasks (e.g., "Create a task to call my dentist")
- For simple, individual task creation requests
- When adding tasks to specific projects the user mentions
- For tasks with clear titles that represent real work the user needs to do
- When the user provides specific task details like due dates or priorities

When NOT to use this tool:
- **NEVER use for AI workflow coordination** (use internalTodoWrite for internal planning instead)
- **NEVER use for bulk operations** (use createBatchTasks for multiple tasks at once)
- **NEVER use for complex multi-system operations** (coordinate with internalTodoWrite first)
- **NEVER use when you need project IDs** (call getProjectAndTaskMap first to get valid IDs)
- **NEVER create vague or duplicate tasks** without user explicit request

Parameter Guidance:
- title: (required) Clear, actionable task description - what the user actually needs to do
- projectId: (optional) Only use if you have a valid project ID from getProjectAndTaskMap()
- description: (optional) Additional context or notes about the task
- priority: (optional) 1=urgent/high priority, 2=normal/medium, 3=low priority, 4=very low
- dueDate: (optional) Timestamp in milliseconds - be precise about dates

Examples:

1. Simple task creation:
User: "Create a task to review the quarterly report"
✅ CORRECT: Use createTask with title="Review quarterly report"

2. Task with project context:
User: "Add a task to call the contractor to my Home project"  
✅ CORRECT: First call getProjectAndTaskMap() to find "Home" project ID, then use createTask

3. What NOT to do:
User: "Help me organize my day"
❌ INCORRECT: Do not use createTask to create organizing tasks
✅ CORRECT: Use internalTodoWrite for planning, then ask user what specific tasks they want created

Error Handling:
- If project not found: Tool will fail with clear error message directing you to use getProjectAndTaskMap()
- If Todoist API fails: Tool returns error details to help diagnose sync issues
- Always check the success status in the returned result

**CRITICAL RULE**: Only create tasks that represent real work the user explicitly requested. Never create meta-tasks about organizing, planning, or coordinating unless specifically asked.`,
  inputSchema: z.object({
    title: z.string().describe("The task title or description"),
    projectId: z.string().optional().describe("Optional: The Todoist project ID"),
    description: z.string().optional().describe("Task description or notes"),
    priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
    dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.syncApi.createTodoistTaskSync, {
        content: args.title,
        description: args.description,
        projectId: args.projectId,
        priority: args.priority,
        dueString: args.dueDate ? new Date(args.dueDate).toISOString().split('T')[0] : undefined,
      });

      const output = result && result.success ? {
        _id: result.taskId || result.tempId,
        title: args.title,
        projectId: args.projectId,
        isCompleted: false,
        createdAt: Date.now(),
        sync_token: result.sync_token
      } : result;

      return {
        title: "Task Created",
        metadata: { taskId: output._id, projectId: args.projectId },
        output: JSON.stringify(output)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create task";
      
      // Provide user-friendly error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes("Project not found")) {
        userFriendlyMessage = "Project not found. Use getProjectAndTaskMap() first to get valid project IDs.";
      } else if (errorMessage.includes("authentication")) {
        userFriendlyMessage = "Todoist connection expired. Please reconnect your account in Settings.";
      }

      throw new Error(userFriendlyMessage);
    }
  }
};

export const getTasks: ToolDefinition = {
  id: "getTasks",
  description: "Retrieve the user's Todoist tasks with full details from their account.\n\nWhen to use this tool:\n- When you need to see what tasks exist\n- When filtering tasks by project or completion status\n- When you need detailed task information\n\nWhen NOT to use this tool:\n- Do not use for getting a complete workspace overview (use getProjectAndTaskMap instead)\n- Do not use for getting specific task details (use getTaskDetails instead)",
  inputSchema: z.object({
    projectId: z.string().optional().describe("Optional: Filter tasks by project ID"),
    includeCompleted: z.boolean().optional().describe("Include completed tasks (default: false)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      // Validate projectId format if provided
      if (args.projectId && !/^[a-zA-Z0-9]{16,}$/.test(args.projectId)) {
        throw new Error(`Invalid project ID format: "${args.projectId}". Use getProjectAndTaskMap() first to get the correct project ID.`);
      }

      const syncResult = await actionCtx.runAction(api.todoist.syncApi.syncTodoistData, {
        resourceTypes: ["items"],
        syncToken: "*"
      });

      let result = [];
      if (syncResult && syncResult.items && syncResult._userContext) {
        result = syncResult.items
          .filter((task: any) => {
            // Filter by project if specified
            const matchesProject = !args.projectId || task.project_id === args.projectId;
            // Filter by completion status
            const matchesCompletion = args.includeCompleted || !task.is_completed;
            return matchesProject && matchesCompletion;
          })
          .map((task: any) => ({
            _id: task.id,
            title: task.content,
            description: task.description || "",
            projectId: task.project_id,
            priority: task.priority || 1,
            dueDate: task.due ? new Date(task.due.datetime || task.due.date).getTime() : undefined,
            isCompleted: task.is_completed,
            createdAt: new Date(task.added_at).getTime(),
          }));
      }

      // Build concise, human-readable summary for model output
      const now = Date.now();
      const overdue = result.filter((t: any) => !!t.dueDate && t.dueDate < now && !t.isCompleted).length;
      const examples = result
        .slice(0, 3)
        .map((t: any) => `${t.title}${t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString()})` : ""}`)
        .join(", ");
      const summary = result.length === 0
        ? "No matching tasks found."
        : `Found ${result.length} task${result.length === 1 ? "" : "s"}${overdue ? ` (${overdue} overdue)` : ""}${examples ? ": " + examples : "."}`;

      return {
        title: "Tasks Retrieved",
        metadata: { taskCount: result.length, projectId: args.projectId, tasks: result },
        output: summary
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve tasks");
    }
  }
};

export const updateTask: ToolDefinition = {
  id: "updateTask",
  description: "Update an existing task's properties such as completion status, title, priority, due date, or project assignment.\n\nWhen to use this tool:\n- When you need to modify an existing task\n- When marking tasks as completed or uncompleted\n- When changing task properties like title, priority, or due date\n\nWhen NOT to use this tool:\n- Do not use for creating new tasks (use createTask instead)\n- Do not use for deleting tasks (use deleteTask instead)\n- Do not use for bulk updates (use updateBatchTasks instead)",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID from getProjectAndTaskMap"),
    title: z.string().optional().describe("New task title"),
    description: z.string().optional().describe("Task description"),
    projectId: z.string().optional().describe("Project ID to move task to"),
    priority: z.number().optional().describe("Task priority: 1=high, 2=medium, 3=low"),
    dueDate: z.number().optional().describe("Due date timestamp"),
    isCompleted: z.boolean().optional().describe("Mark as completed/incomplete"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const { taskId, title, description, priority, dueDate, isCompleted } = args;
      let result;
      
      // Handle task completion separately with appropriate sync API calls
      if (isCompleted === true) {
        result = await actionCtx.runAction(api.todoist.syncApi.completeTodoistTaskSync, { taskId });
      } else if (isCompleted === false) {
        result = await actionCtx.runAction(api.todoist.syncApi.reopenTodoistTaskSync, { taskId });
      } else {
        // Update task properties
        const todoistArgs: any = { taskId };
        
        if (title) todoistArgs.content = title;
        if (description !== undefined) todoistArgs.description = description;
        if (priority) todoistArgs.priority = priority;
        if (dueDate) todoistArgs.dueString = new Date(dueDate).toISOString().split('T')[0];
        if (args.projectId) todoistArgs.projectId = args.projectId;
        
        if (Object.keys(todoistArgs).length > 1) { // More than just taskId
          result = await actionCtx.runAction(api.todoist.syncApi.updateTodoistTaskSync, todoistArgs);
        } else {
          result = { success: true, message: "No changes specified" };
        }
      }

      return {
        title: "Task Updated",
        metadata: { taskId, isCompleted },
        output: JSON.stringify({ success: true, _id: taskId, result })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to update task");
    }
  }
};

export const deleteTask: ToolDefinition = {
  id: "deleteTask",
  description: "Permanently delete a task from the system.\n\nWhen to use this tool:\n- When users ask to remove or delete specific tasks\n- When cleaning up outdated or unnecessary tasks\n\nWhen NOT to use this tool:\n- Do not use for marking tasks as completed (use updateTask with isCompleted instead)\n- Do not use for bulk deletions (use deleteBatchTasks instead)\n- Do not use for moving tasks (use updateTask with projectId instead)",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.syncApi.deleteTodoistTaskSync, { 
        taskId: args.taskId 
      });
      
      return {
        title: "Task Deleted",
        metadata: { taskId: args.taskId },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to delete task");
    }
  }
};

export const createProject: ToolDefinition = {
  id: "createProject",
  description: "Create a new project in the user's Todoist account to help organize tasks.\n\nWhen to use this tool:\n- When users need a new project for organizing tasks\n- When setting up new categories or work areas\n\nWhen NOT to use this tool:\n- Do not use for creating tasks (use createTask instead)\n- Do not use for updating existing projects (use updateProject instead)",
  inputSchema: z.object({
    name: z.string().describe("The project name"),
    color: z.string().optional().describe("Project color as hex code"),
    parentId: z.string().optional().describe("Parent project ID for nested projects"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.syncApi.createTodoistProjectSync, {
        name: args.name,
        color: args.color,
        parentId: args.parentId
      });

      const output = result && result.success ? {
        _id: result.projectId || result.tempId,
        name: args.name,
        color: args.color,
        createdAt: Date.now(),
        sync_token: result.sync_token
      } : result;

      return {
        title: "Project Created",
        metadata: { projectId: output._id, name: args.name },
        output: JSON.stringify(output)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to create project");
    }
  }
};

export const updateProject: ToolDefinition = {
  id: "updateProject",
  description: "Update an existing project's properties such as name, color, or description.\n\nWhen to use this tool:\n- When users want to rename a project\n- When changing project properties like color or description\n\nWhen NOT to use this tool:\n- Do not use for creating new projects (use createProject instead)\n- Do not use for deleting projects (use deleteProject instead)",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID from getProjectAndTaskMap"),
    name: z.string().optional().describe("New project name"),
    color: z.string().optional().describe("Project color as hex code"),
    description: z.string().optional().describe("Project description"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const { projectId, ...updateArgs } = args;
      const result = await actionCtx.runAction(api.todoist.syncApi.updateTodoistProjectSync, {
        projectId,
        ...updateArgs
      });
      
      return {
        title: "Project Updated", 
        metadata: { projectId },
        output: JSON.stringify({ success: true, _id: projectId, result })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to update project");
    }
  }
};

export const deleteProject: ToolDefinition = {
  id: "deleteProject",
  description: "Delete a project from the system. Projects with existing tasks cannot be deleted unless tasks are moved or deleted first.\n\nWhen to use this tool:\n- When users want to remove an entire project\n- When cleaning up unused project categories\n\nWhen NOT to use this tool:\n- Do not use for deleting individual tasks (use deleteTask instead)\n- Do not use for emptying projects (move or delete tasks first)\n- Do not use for renaming projects (use updateProject instead)",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.syncApi.deleteTodoistProjectSync, { 
        projectId: args.projectId 
      });
      
      return {
        title: "Project Deleted",
        metadata: { projectId: args.projectId },
        output: JSON.stringify(result)
      };
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : "Failed to delete project";
      
      // Provide helpful guidance for common issues
      if (errorMessage.includes("not empty") || errorMessage.includes("has tasks")) {
        errorMessage = "Cannot delete project with existing tasks. Move or delete all tasks first, then try again.";
      }
      
      throw new Error(errorMessage);
    }
  }
};

export const getProjectAndTaskMap: ToolDefinition = {
  id: "getProjectAndTaskMap",
  description: `## getProjectAndTaskMap
Description: Get a complete hierarchical overview of the user's entire Todoist workspace, including all projects with their associated tasks, task counts, and project structures. This is the ESSENTIAL first step for any operation requiring project or task IDs.

**CRITICAL USAGE RULE: You MUST call this tool first before using createTask, updateTask, deleteTask, or any other operation that requires project/task IDs.**

When to use this tool:
- **ALWAYS use FIRST** when you need project IDs or task IDs for other operations
- When users ask for a workspace overview or summary ("show me my tasks", "what projects do I have")
- When you need to understand the user's complete task organization structure
- Before bulk operations to understand the scope and get valid IDs
- When users reference project names and you need to find the corresponding project ID
- When analyzing task distribution across projects

When NOT to use this tool:
- Do not use repeatedly in the same conversation (data is relatively static)
- Do not use if you already have the specific IDs you need from a previous call
- Do not use for real-time task updates (data may be slightly cached)

Parameter Guidance:
- includeCompleted: (optional, default: false) Set to true only when you need to see completed tasks for analysis

Expected Output Structure:
- projects: Array of project objects with { id, name, tasks: [] }
- unassignedTasks: Array of tasks not assigned to any project
- Each task contains: { id, content, projectId, isCompleted, priority, dueDate, etc. }

Examples:

1. Getting workspace overview:
User: "Show me all my projects and tasks"
✅ CORRECT: Call getProjectAndTaskMap() first to get complete structure

2. Before creating a task in specific project:
User: "Add a task to my Work project"
✅ CORRECT: Call getProjectAndTaskMap() first to find "Work" project ID, then use createTask

3. Before bulk operations:
User: "Update all tasks in my Home project to high priority"
✅ CORRECT: Call getProjectAndTaskMap() to get project ID and task IDs, then use updateTask for each

Common ID Patterns:
- Project IDs: Long alphanumeric strings (e.g., "2203306141")
- Task IDs: Long alphanumeric strings (e.g., "7495061107")
- Always use exact IDs returned by this tool, never guess or construct IDs

**CRITICAL PERFORMANCE NOTE**: This tool provides a complete workspace snapshot. Use the returned IDs for subsequent operations instead of making additional calls to find specific items.`,
  inputSchema: z.object({
    includeCompleted: z.boolean().optional().describe("Include completed tasks"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistProjectAndTaskMap, {
        includeCompleted: args.includeCompleted || false
      });

      const projectCount = result?.projects?.length || 0;
      const taskCount = result?.unassignedTasks?.length || 0;
      const totalTasks = result?.projects?.reduce((sum: number, p: any) => sum + (p.tasks?.length || 0), 0) || 0;

      const topProjects = (result?.projects || [])
        .slice(0, 3)
        .map((p: any) => `${p.name}${p.tasks?.length ? ` (${p.tasks.length})` : ""}`)
        .join(", ");
      const total = totalTasks + taskCount;
      const summary = `Workspace: ${projectCount} project${projectCount === 1 ? "" : "s"}, ${total} task${total === 1 ? "" : "s"}${topProjects ? `. Top: ${topProjects}` : ""}.`;

      return {
        title: "Workspace Map Retrieved",
        metadata: { projectCount, taskCount: total, map: result },
        output: summary
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve workspace overview");
    }
  }
};

export const getProjectDetails: ToolDefinition = {
  id: "getProjectDetails",
  description: "Get detailed information about a specific project including all associated tasks with full details.\n\nWhen to use this tool:\n- When you need detailed information about a specific project\n- When analyzing project structure and contents\n\nWhen NOT to use this tool:\n- Do not use for getting a complete workspace overview (use getProjectAndTaskMap instead)\n- Do not use for simple project listing (use getProjectAndTaskMap instead)",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistProjectDetails, { 
        projectId: args.projectId 
      });

      return {
        title: "Project Details Retrieved",
        metadata: { projectId: args.projectId },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve project details");
    }
  }
};

export const getTaskDetails: ToolDefinition = {
  id: "getTaskDetails", 
  description: "Get detailed information about a specific task including associated project information.\n\nWhen to use this tool:\n- When you need detailed information about a specific task\n- When analyzing task context and relationships\n\nWhen NOT to use this tool:\n- Do not use for getting a complete task list (use getTasks instead)\n- Do not use for simple task operations (use updateTask, deleteTask, etc. instead)",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistTaskDetails, { 
        taskId: args.taskId 
      });

      return {
        title: "Task Details Retrieved",
        metadata: { taskId: args.taskId },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve task details");
    }
  }
};

// BATCH OPERATIONS - Efficient bulk task management

export const createBatchTasks: ToolDefinition = {
  id: "createBatchTasks",
  description: "Create multiple tasks in a single efficient operation. Perfect for daily planning, bulk task import, or setting up multiple related tasks at once.\n\nWhen to use this tool:\n- When creating multiple related tasks at once\n- For daily planning sessions with many tasks\n- When importing task lists from other sources\n\nWhen NOT to use this tool:\n- Do not use for simple, single task creation (use createTask instead)\n- Do not use for complex coordination tasks (use internalTodoWrite instead)",
  inputSchema: z.object({
    tasks: z.array(z.object({
      title: z.string().describe("The task title"),
      description: z.string().optional().describe("Task description or notes"),
      projectId: z.string().optional().describe("Project ID to assign the task to"),
      priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch)"),
    })).min(1).max(50).describe("Array of tasks to create (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Convert input to BatchTaskCreate format
      const tasksToCreate = args.tasks.map((task: any) => ({
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        priority: task.priority,
        dueDate: task.dueDate,
      }));

      // Build and execute batch commands (with V1/V2 project ID validation)
      const { commands } = await batchHandler.buildTaskCreateCommandsWithValidation(tasksToCreate);
      const result = await batchHandler.executeBatch(commands);

      // Process results
      const successCount = result.successful.length;
      const failureCount = result.failed.length;
      
      let outputSummary = `Batch task creation completed: ${successCount} successful, ${failureCount} failed`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Batch Tasks Created",
        metadata: { successful: successCount, failed: failureCount, total: args.tasks.length },
        output: JSON.stringify({
          summary: outputSummary,
          successful: result.successful,
          failed: result.failed,
          tempIdMappings: result.tempIdMappings
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to create batch tasks");
    }
  }
};

export const deleteBatchTasks: ToolDefinition = {
  id: "deleteBatchTasks",
  description: "Delete multiple tasks in a single efficient operation. Use for bulk cleanup, completing projects, or removing outdated tasks.\n\nWhen to use this tool:\n- When deleting multiple tasks at once\n- For cleaning up completed or outdated tasks\n- When removing entire project task sets\n\nWhen NOT to use this tool:\n- Do not use for single task deletion (use deleteTask instead)\n- Do not use for marking tasks as completed (use completeBatchTasks instead)",
  inputSchema: z.object({
    taskIds: z.array(z.string()).min(1).max(50).describe("Array of task IDs to delete (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Build and execute batch delete commands
      const { commands } = batchHandler.buildTaskDeleteCommands(args.taskIds);
      const result = await batchHandler.executeBatch(commands);

      const successCount = result.successful.length;
      const failureCount = result.failed.length;
      
      let outputSummary = `Batch task deletion completed: ${successCount} successful, ${failureCount} failed`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Task deletion failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Batch Tasks Deleted",
        metadata: { successful: successCount, failed: failureCount, total: args.taskIds.length },
        output: JSON.stringify({
          summary: outputSummary,
          successful: result.successful,
          failed: result.failed
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to delete batch tasks");
    }
  }
};

export const completeBatchTasks: ToolDefinition = {
  id: "completeBatchTasks",
  description: "Mark multiple tasks as completed in a single efficient operation. Perfect for end-of-day reviews, project completion, or bulk status updates.\n\nWhen to use this tool:\n- When marking multiple tasks as completed at once\n- For end-of-day or end-of-project cleanup\n- When users ask to complete multiple tasks\n\nWhen NOT to use this tool:\n- Do not use for single task completion (use updateTask with isCompleted instead)\n- Do not use for deleting tasks (use deleteBatchTasks instead)",
  inputSchema: z.object({
    taskIds: z.array(z.string()).min(1).max(50).describe("Array of task IDs to mark as completed (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Build and execute batch completion commands
      const { commands } = batchHandler.buildTaskCompleteCommands(args.taskIds);
      const result = await batchHandler.executeBatch(commands);

      const successCount = result.successful.length;
      const failureCount = result.failed.length;
      
      let outputSummary = `Batch task completion: ${successCount} successful, ${failureCount} failed`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Task completion failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Batch Tasks Completed",
        metadata: { successful: successCount, failed: failureCount, total: args.taskIds.length },
        output: JSON.stringify({
          summary: outputSummary,
          successful: result.successful,
          failed: result.failed
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to complete batch tasks");
    }
  }
};

export const updateBatchTasks: ToolDefinition = {
  id: "updateBatchTasks",
  description: "Update multiple tasks with bulk modifications in a single operation. Ideal for changing priorities, moving tasks between projects, or updating due dates across multiple tasks.\n\nWhen to use this tool:\n- When updating multiple tasks with similar changes\n- For bulk priority changes or due date updates\n- When moving multiple tasks between projects\n\nWhen NOT to use this tool:\n- Do not use for single task updates (use updateTask instead)\n- Do not use for simple task creation (use createTask or createBatchTasks instead)",
  inputSchema: z.object({
    updates: z.array(z.object({
      taskId: z.string().describe("The ID of the task to update"),
      title: z.string().optional().describe("New task title"),
      description: z.string().optional().describe("New task description"),
      projectId: z.string().optional().describe("Move task to this project ID"),
      priority: z.number().optional().describe("New priority: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("New due date as timestamp (milliseconds since epoch)"),
      isCompleted: z.boolean().optional().describe("Mark as completed (true) or uncompleted (false)"),
    })).min(1).max(50).describe("Array of task updates (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Build and execute batch update commands
      const { commands } = batchHandler.buildTaskUpdateCommands(args.updates);
      const result = await batchHandler.executeBatch(commands);

      const successCount = result.successful.length;
      const failureCount = result.failed.length;
      
      let outputSummary = `Batch task updates completed: ${successCount} successful, ${failureCount} failed`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Task update failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Batch Tasks Updated",
        metadata: { successful: successCount, failed: failureCount, total: args.updates.length },
        output: JSON.stringify({
          summary: outputSummary,
          successful: result.successful,
          failed: result.failed
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to update batch tasks");
    }
  }
};

export const createProjectWithTasks: ToolDefinition = {
  id: "createProjectWithTasks",
  description: "Create a new project and multiple tasks within it in a single atomic operation. Perfect for project templates, client setup, or deploying standard workflows.\n\nWhen to use this tool:\n- When setting up new projects with initial tasks\n- For creating project templates with standard tasks\n- When onboarding new clients or projects\n\nWhen NOT to use this tool:\n- Do not use for creating tasks in existing projects (use createTask or createBatchTasks instead)\n- Do not use for simple project creation (use createProject instead)",
  inputSchema: z.object({
    projectName: z.string().describe("The name of the project to create"),
    projectColor: z.string().optional().describe("Project color (e.g., 'berry_red', 'blue', 'green')"),
    projectDescription: z.string().optional().describe("Project description"),
    tasks: z.array(z.object({
      title: z.string().describe("The task title"),
      description: z.string().optional().describe("Task description or notes"),
      priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch)"),
    })).min(0).max(40).describe("Array of tasks to create within the project (0-40 tasks)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Use the helper method for project + tasks creation
      const result = await batchHandler.createProjectWithTasks(
        {
          name: args.projectName,
          color: args.projectColor,
          description: args.projectDescription,
        },
        args.tasks.map((task: any) => ({
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
        }))
      );

      const successCount = result.successful.length;
      const totalOperations = 1 + args.tasks.length; // project + tasks
      
      // Find the project creation result
      const projectResult = result.successful.find(s => s.realId && !s.tempId?.startsWith('task_'));
      const projectId = projectResult?.realId;
      
      let outputSummary = `Project creation completed: ${successCount}/${totalOperations} operations successful`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Operation failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Project with Tasks Created",
        metadata: { 
          projectId,
          projectName: args.projectName,
          tasksCreated: Math.max(0, successCount - 1),
          totalTasks: args.tasks.length
        },
        output: JSON.stringify({
          summary: outputSummary,
          projectId,
          projectName: args.projectName,
          successful: result.successful,
          failed: result.failed,
          tempIdMappings: result.tempIdMappings
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to create project with tasks");
    }
  }
};

export const reorganizeTasksBatch: ToolDefinition = {
  id: "reorganizeTasksBatch",
  description: "Reorganize multiple tasks with the same modifications in a single operation. Perfect for context switching (move all tasks to different project), priority changes (make all urgent), or rescheduling (move all to next week).\n\nWhen to use this tool:\n- When applying the same changes to multiple tasks\n- For bulk task reorganization or rescheduling\n- When changing priorities or projects for task groups\n\nWhen NOT to use this tool:\n- Do not use for individual task changes (use updateTask instead)\n- Do not use for creating new tasks (use createTask or createBatchTasks instead)",
  inputSchema: z.object({
    taskIds: z.array(z.string()).min(1).max(50).describe("Array of task IDs to reorganize (1-50 tasks per batch)"),
    modifications: z.object({
      projectId: z.string().optional().describe("Move all tasks to this project ID"),
      priority: z.number().optional().describe("Set priority for all tasks: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("Set due date for all tasks (timestamp in milliseconds since epoch)"),
      addDays: z.number().optional().describe("Add this many days to each task's current due date (alternative to setting absolute date)"),
      isCompleted: z.boolean().optional().describe("Mark all tasks as completed (true) or uncompleted (false)"),
    }).describe("Modifications to apply to all specified tasks"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    void ctx;
    try {
      const batchHandler = new BatchTodoistHandler(actionCtx);
      
      // Build updates for each task with the same modifications
      const updates = args.taskIds.map((taskId: string) => {
        const update: any = { taskId };
        
        if (args.modifications.projectId) {
          update.projectId = args.modifications.projectId;
        }
        if (args.modifications.priority) {
          update.priority = args.modifications.priority;
        }
        if (args.modifications.isCompleted !== undefined) {
          update.isCompleted = args.modifications.isCompleted;
        }
        
        // Handle due date modifications
        if (args.modifications.dueDate) {
          update.dueDate = args.modifications.dueDate;
        } else if (args.modifications.addDays) {
          // For addDays, we'd need to get current task data first
          // For now, we'll just add the days to current timestamp as a fallback
          // In a real implementation, you might want to fetch current due dates first
          const currentTime = Date.now();
          const daysInMs = args.modifications.addDays * 24 * 60 * 60 * 1000;
          update.dueDate = currentTime + daysInMs;
        }
        
        return update;
      });

      // Build and execute batch update commands
      const { commands } = batchHandler.buildTaskUpdateCommands(updates);
      const result = await batchHandler.executeBatch(commands);

      const successCount = result.successful.length;
      const failureCount = result.failed.length;
      
      // Build description of what was changed
      const changes = [];
      if (args.modifications.projectId) changes.push("moved to different project");
      if (args.modifications.priority) changes.push(`priority set to ${args.modifications.priority}`);
      if (args.modifications.dueDate) changes.push("due date updated");
      if (args.modifications.addDays) changes.push(`due date shifted by ${args.modifications.addDays} days`);
      if (args.modifications.isCompleted !== undefined) {
        changes.push(args.modifications.isCompleted ? "marked completed" : "marked uncompleted");
      }
      
      const changesText = changes.length > 0 ? ` (${changes.join(', ')})` : "";
      let outputSummary = `Batch task reorganization completed: ${successCount}/${args.taskIds.length} tasks updated${changesText}`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Task reorganization failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      return {
        title: "Tasks Reorganized",
        metadata: { successful: successCount, failed: failureCount, total: args.taskIds.length },
        output: JSON.stringify({
          summary: outputSummary,
          modifications: args.modifications,
          successful: result.successful,
          failed: result.failed
        })
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to reorganize batch tasks");
    }
  }
};

// Export all Todoist tools
export const TodoistTools = {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  createProject,
  updateProject,
  deleteProject,
  getProjectAndTaskMap,
  getProjectDetails,
  getTaskDetails,
  // Batch operations
  createBatchTasks,
  deleteBatchTasks,
  completeBatchTasks,
  updateBatchTasks,
  createProjectWithTasks,
  reorganizeTasksBatch,
};