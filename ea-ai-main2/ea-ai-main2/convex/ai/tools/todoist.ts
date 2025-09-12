import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import { BatchTodoistHandler } from "../../todoist/BatchTodoistHandler";

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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Task Created Successfully",
      //   metadata: { taskId: output._id, projectId: args.projectId }
      // });

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

      const syncResult = await actionCtx.runAction(api.todoist.syncApi.syncTodoistData, {
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `Retrieved ${result.length} Tasks`,
      //   metadata: { taskCount: result.length, projectId: args.projectId }
      // });

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
        result = await actionCtx.runAction(api.todoist.syncApi.completeTodoistTaskSync, { taskId });
        // Metadata handled by tool registry bridge - ctx.metadata({
        //   title: "Task Completed",
        //   metadata: { taskId, action: "completed" }
        // });
      } else if (isCompleted === false) {
        result = await actionCtx.runAction(api.todoist.syncApi.reopenTodoistTaskSync, { taskId });
        // Metadata handled by tool registry bridge - ctx.metadata({
        //   title: "Task Reopened",
        //   metadata: { taskId, action: "reopened" }
        // });
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
          // Metadata handled by tool registry bridge - ctx.metadata({
          //   title: "Task Updated",
          //   metadata: { taskId, fieldsUpdated: Object.keys(todoistArgs).filter(k => k !== 'taskId') }
          // });
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
      const result = await actionCtx.runAction(api.todoist.syncApi.deleteTodoistTaskSync, { 
        taskId: args.taskId 
      });
      
      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Task Deleted",
      //   metadata: { taskId: args.taskId }
      // });

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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Project Created Successfully",
      //   metadata: { projectId: output._id, name: args.name }
      // });

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
      const result = await actionCtx.runAction(api.todoist.syncApi.updateTodoistProjectSync, {
        projectId,
        ...updateArgs
      });
      
      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Project Updated",
      //   metadata: { projectId, fieldsUpdated: Object.keys(updateArgs) }
      // });

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
      const result = await actionCtx.runAction(api.todoist.syncApi.deleteTodoistProjectSync, { 
        projectId: args.projectId 
      });
      
      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Project Deleted",
      //   metadata: { projectId: args.projectId }
      // });

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
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistProjectAndTaskMap, {
        includeCompleted: args.includeCompleted || false
      });

      const projectCount = result?.projects?.length || 0;
      const taskCount = result?.unassignedTasks?.length || 0;
      const totalTasks = result?.projects?.reduce((sum: number, p: any) => sum + (p.tasks?.length || 0), 0) || 0;

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Workspace Overview Retrieved",
      //   metadata: { 
      //     projectCount,
      //     unassignedTasks: taskCount,
      //     totalTasks: totalTasks + taskCount,
      //     includeCompleted: args.includeCompleted || false
      //   }
      // });

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
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistProjectDetails, { 
        projectId: args.projectId 
      });

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Project Details Retrieved",
      //   metadata: { 
      //     projectId: args.projectId,
      //     taskCount: result?.tasks?.length || 0
      //   }
      // });

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
      const result = await actionCtx.runAction(api.todoist.integration.getTodoistTaskDetails, { 
        taskId: args.taskId 
      });

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: "Task Details Retrieved",
      //   metadata: { taskId: args.taskId }
      // });

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
  description: "Create multiple tasks in a single efficient operation. Perfect for daily planning, bulk task import, or setting up multiple related tasks at once.",
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `${successCount}/${args.tasks.length} Tasks Created`,
      //   metadata: { 
      //     successful: successCount, 
      //     failed: failureCount, 
      //     total: args.tasks.length 
      //   }
      // });

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
  description: "Delete multiple tasks in a single efficient operation. Use for bulk cleanup, completing projects, or removing outdated tasks.",
  inputSchema: z.object({
    taskIds: z.array(z.string()).min(1).max(50).describe("Array of task IDs to delete (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `${successCount}/${args.taskIds.length} Tasks Deleted`,
      //   metadata: { 
      //     successful: successCount, 
      //     failed: failureCount, 
      //     total: args.taskIds.length 
      //   }
      // });

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
  description: "Mark multiple tasks as completed in a single efficient operation. Perfect for end-of-day reviews, project completion, or bulk status updates.",
  inputSchema: z.object({
    taskIds: z.array(z.string()).min(1).max(50).describe("Array of task IDs to mark as completed (1-50 tasks per batch)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `${successCount}/${args.taskIds.length} Tasks Completed`,
      //   metadata: { 
      //     successful: successCount, 
      //     failed: failureCount, 
      //     total: args.taskIds.length 
      //   }
      // });

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
  description: "Update multiple tasks with bulk modifications in a single operation. Ideal for changing priorities, moving tasks between projects, or updating due dates across multiple tasks.",
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `${successCount}/${args.updates.length} Tasks Updated`,
      //   metadata: { 
      //     successful: successCount, 
      //     failed: failureCount, 
      //     total: args.updates.length 
      //   }
      // });

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
  description: "Create a new project and multiple tasks within it in a single atomic operation. Perfect for project templates, client setup, or deploying standard workflows.",
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
      const failureCount = result.failed.length;
      const totalOperations = 1 + args.tasks.length; // project + tasks
      
      // Find the project creation result
      const projectResult = result.successful.find(s => s.realId && !s.tempId?.startsWith('task_'));
      const projectId = projectResult?.realId;
      
      let outputSummary = `Project creation completed: ${successCount}/${totalOperations} operations successful`;
      
      if (result.failed.length > 0) {
        const failureDetails = result.failed.map(f => `• Operation failed: ${f.error}`).join('\n');
        outputSummary += `\n\nFailures:\n${failureDetails}`;
      }

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `Project "${args.projectName}" Created`,
      //   metadata: { 
      //     projectId,
      //     projectName: args.projectName,
      //     tasksCreated: Math.max(0, successCount - 1), // Subtract project creation
      //     totalTasks: args.tasks.length,
      //     successful: successCount,
      //     failed: failureCount
      //   }
      // });

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
  description: "Reorganize multiple tasks with the same modifications in a single operation. Perfect for context switching (move all tasks to different project), priority changes (make all urgent), or rescheduling (move all to next week).",
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

      // Metadata handled by tool registry bridge - ctx.metadata({
      //   title: `${successCount}/${args.taskIds.length} Tasks Reorganized`,
      //   metadata: { 
      //     successful: successCount, 
      //     failed: failureCount, 
      //     total: args.taskIds.length,
      //     modifications: args.modifications
      //   }
      // });

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