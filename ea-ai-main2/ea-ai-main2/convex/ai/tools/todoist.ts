import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import * as TodoistModel from "../../todoist/model";

// Todoist-specific tool implementations
// Extracted from main toolRegistry for better modularity

export const createTask: ToolDefinition = {
  id: "createTask",
  description: "Create a new task in the user's Todoist account. This is the PRIMARY tool for user task requests. Use this for simple task creation, not internalTodoWrite.",
  inputSchema: z.object({
    title: z.string().describe("The task title or description"),
    projectId: z.string().optional().describe("Optional: The Todoist project ID"),
    description: z.string().optional().describe("Task description or notes"),
    priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
    dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result: any = await TodoistModel.createTask(actionCtx, {
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

      ctx.metadata({
        title: "Task Created Successfully",
        metadata: { taskId: output._id, projectId: args.projectId }
      });

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
  description: "Retrieve the user's Todoist tasks with full details from their account.",
  inputSchema: z.object({
    projectId: z.string().optional().describe("Optional: Filter tasks by project ID"),
    includeCompleted: z.boolean().optional().describe("Include completed tasks (default: false)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      // Validate projectId format if provided
      if (args.projectId && !/^[a-zA-Z0-9]{16,}$/.test(args.projectId)) {
        throw new Error(`Invalid project ID format: "${args.projectId}". Use getProjectAndTaskMap() first to get the correct project ID.`);
      }

      const syncResult = await TodoistModel.syncTodoistData(actionCtx, {
        resourceTypes: ["items"],
        syncToken: "*"
      });

      let result = [];
      if (syncResult && syncResult.items && syncResult._userContext) {
        const currentUserId = syncResult._userContext.userId;
        
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

      ctx.metadata({
        title: `Retrieved ${result.length} Tasks`,
        metadata: { taskCount: result.length, projectId: args.projectId }
      });

      return {
        title: "Tasks Retrieved",
        metadata: { taskCount: result.length, projectId: args.projectId },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve tasks");
    }
  }
};

export const updateTask: ToolDefinition = {
  id: "updateTask",
  description: "Update an existing task's properties such as completion status, title, priority, due date, or project assignment.",
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
    try {
      const { taskId, title, description, priority, dueDate, isCompleted, ...updateArgs } = args;
      let result;
      
      // Handle task completion separately with appropriate sync API calls
      if (isCompleted === true) {
        result = await TodoistModel.completeTask(actionCtx, { taskId });
        ctx.metadata({
          title: "Task Completed",
          metadata: { taskId, action: "completed" }
        });
      } else if (isCompleted === false) {
        result = await TodoistModel.reopenTask(actionCtx, { taskId });
        ctx.metadata({
          title: "Task Reopened",
          metadata: { taskId, action: "reopened" }
        });
      } else {
        // Update task properties
        const todoistArgs: any = { taskId };
        
        if (title) todoistArgs.content = title;
        if (description !== undefined) todoistArgs.description = description;
        if (priority) todoistArgs.priority = priority;
        if (dueDate) todoistArgs.dueString = new Date(dueDate).toISOString().split('T')[0];
        if (args.projectId) todoistArgs.projectId = args.projectId;
        
        if (Object.keys(todoistArgs).length > 1) { // More than just taskId
          result = await TodoistModel.updateTask(actionCtx, todoistArgs);
          ctx.metadata({
            title: "Task Updated",
            metadata: { taskId, fieldsUpdated: Object.keys(todoistArgs).filter(k => k !== 'taskId') }
          });
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
  description: "Permanently delete a task from the system.",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.deleteTask(actionCtx, { 
        taskId: args.taskId 
      });
      
      ctx.metadata({
        title: "Task Deleted",
        metadata: { taskId: args.taskId }
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
  description: "Create a new project in the user's Todoist account to help organize tasks.",
  inputSchema: z.object({
    name: z.string().describe("The project name"),
    color: z.string().optional().describe("Project color as hex code"),
    parentId: z.string().optional().describe("Parent project ID for nested projects"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.createProject(actionCtx, {
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

      ctx.metadata({
        title: "Project Created Successfully",
        metadata: { projectId: output._id, name: args.name }
      });

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
  description: "Update an existing project's properties such as name, color, or description.",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID from getProjectAndTaskMap"),
    name: z.string().optional().describe("New project name"),
    color: z.string().optional().describe("Project color as hex code"),
    description: z.string().optional().describe("Project description"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { projectId, ...updateArgs } = args;
      const result = await TodoistModel.updateProject(actionCtx, {
        projectId,
        ...updateArgs
      });
      
      ctx.metadata({
        title: "Project Updated",
        metadata: { projectId, fieldsUpdated: Object.keys(updateArgs) }
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
  description: "Delete a project from the system. Projects with existing tasks cannot be deleted unless tasks are moved or deleted first.",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.deleteProject(actionCtx, { 
        projectId: args.projectId 
      });
      
      ctx.metadata({
        title: "Project Deleted",
        metadata: { projectId: args.projectId }
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
  description: "Get a complete hierarchical overview of the user's entire Todoist workspace - all projects with their associated tasks.",
  inputSchema: z.object({
    includeCompleted: z.boolean().optional().describe("Include completed tasks"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.getTodoistProjectAndTaskMap(actionCtx, {
        includeCompleted: args.includeCompleted || false
      });

      const projectCount = result?.projects?.length || 0;
      const taskCount = result?.unassignedTasks?.length || 0;
      const totalTasks = result?.projects?.reduce((sum: number, p: any) => sum + (p.tasks?.length || 0), 0) || 0;

      ctx.metadata({
        title: "Workspace Overview Retrieved",
        metadata: { 
          projectCount,
          unassignedTasks: taskCount,
          totalTasks: totalTasks + taskCount,
          includeCompleted: args.includeCompleted || false
        }
      });

      return {
        title: "Workspace Map Retrieved",
        metadata: { projectCount, taskCount: totalTasks + taskCount },
        output: JSON.stringify(result)
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve workspace overview");
    }
  }
};

export const getProjectDetails: ToolDefinition = {
  id: "getProjectDetails",
  description: "Get detailed information about a specific project including all associated tasks with full details.",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.getTodoistProjectDetails(actionCtx, { 
        projectId: args.projectId 
      });

      ctx.metadata({
        title: "Project Details Retrieved",
        metadata: { 
          projectId: args.projectId,
          taskCount: result?.tasks?.length || 0
        }
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
  description: "Get detailed information about a specific task including associated project information.",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const result = await TodoistModel.getTodoistTaskDetails(actionCtx, { 
        taskId: args.taskId 
      });

      ctx.metadata({
        title: "Task Details Retrieved",
        metadata: { taskId: args.taskId }
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
};