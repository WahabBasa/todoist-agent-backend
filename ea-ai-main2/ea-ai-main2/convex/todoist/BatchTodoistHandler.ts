import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";

// Batch operation interfaces based on Todoist Sync API v1 structure
export interface BatchCommand {
  type: string;           // Command type (item_add, item_delete, etc.)
  uuid: string;          // Unique identifier for tracking
  temp_id?: string;      // Temporary ID for new resources
  args: Record<string, any>; // Command-specific arguments
}

export interface BatchTaskCreate {
  title: string;
  description?: string;
  projectId?: string;    // Real project ID
  projectTempId?: string; // Temp project ID for dependencies
  priority?: number;
  dueDate?: number;      // Timestamp
  labels?: string[];
}

export interface BatchTaskUpdate {
  taskId: string;
  title?: string;
  description?: string;
  projectId?: string;
  priority?: number;
  dueDate?: number;
  isCompleted?: boolean;
}

export interface BatchProjectCreate {
  name: string;
  color?: string;
  parentId?: string;
  description?: string;
}

export interface BatchResult {
  successful: Array<{
    tempId?: string;
    realId?: string;
    uuid: string;
    result: any;
  }>;
  failed: Array<{
    tempId?: string;
    uuid: string;
    error: string;
    details?: any;
  }>;
  tempIdMappings: Record<string, string>;
  syncToken?: string;
}

interface TodoistErrorResponse {
  error?: string;
  [key: string]: any;
}

export class BatchTodoistHandler {
  private uuidCounter = 0;
  private tempIdCounter = 0;

  constructor(private actionCtx: ActionCtx) {}

  // Generate unique UUID for command tracking
  private generateUUID(): string {
    return `batch_uuid_${Date.now()}_${++this.uuidCounter}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Generate temporary ID for new resources
  private generateTempId(prefix: string = "temp"): string {
    return `${prefix}_${Date.now()}_${++this.tempIdCounter}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Convert batch task creation requests to Todoist sync commands
  buildTaskCreateCommands(tasks: BatchTaskCreate[]): { commands: BatchCommand[], tempIds: Record<string, string> } {
    const commands: BatchCommand[] = [];
    const tempIds: Record<string, string> = {};

    tasks.forEach(task => {
      const tempId = this.generateTempId("task");
      const uuid = this.generateUUID();
      tempIds[tempId] = uuid;

      const command: BatchCommand = {
        type: "item_add",
        uuid,
        temp_id: tempId,
        args: {
          content: task.title,
          ...(task.description && { description: task.description }),
          ...(task.projectId && { project_id: task.projectId }),
          ...(task.projectTempId && { project_id: task.projectTempId }),
          ...(task.priority && { priority: task.priority }),
          ...(task.dueDate && { due_string: new Date(task.dueDate).toISOString().split('T')[0] }),
          ...(task.labels && task.labels.length > 0 && { labels: task.labels })
        }
      };

      commands.push(command);
    });

    return { commands, tempIds };
  }

  // Convert batch task updates to Todoist sync commands
  buildTaskUpdateCommands(updates: BatchTaskUpdate[]): { commands: BatchCommand[], taskIds: Record<string, string> } {
    const commands: BatchCommand[] = [];
    const taskIds: Record<string, string> = {};

    updates.forEach(update => {
      const uuid = this.generateUUID();
      taskIds[update.taskId] = uuid;

      // Handle completion separately
      if (update.isCompleted === true) {
        commands.push({
          type: "item_complete",
          uuid,
          args: { id: update.taskId }
        });
      } else if (update.isCompleted === false) {
        commands.push({
          type: "item_uncomplete",
          uuid,
          args: { id: update.taskId }
        });
      } else {
        // Regular update
        const updateArgs: Record<string, any> = { id: update.taskId };
        
        if (update.title) updateArgs.content = update.title;
        if (update.description !== undefined) updateArgs.description = update.description;
        if (update.projectId) updateArgs.project_id = update.projectId;
        if (update.priority) updateArgs.priority = update.priority;
        if (update.dueDate) updateArgs.due_string = new Date(update.dueDate).toISOString().split('T')[0];

        // Only add command if there are actual updates
        if (Object.keys(updateArgs).length > 1) { // More than just 'id'
          commands.push({
            type: "item_update",
            uuid,
            args: updateArgs
          });
        }
      }
    });

    return { commands, taskIds };
  }

  // Convert batch task deletions to Todoist sync commands
  buildTaskDeleteCommands(taskIds: string[]): { commands: BatchCommand[], taskIds: Record<string, string> } {
    const commands: BatchCommand[] = [];
    const idMap: Record<string, string> = {};

    taskIds.forEach(taskId => {
      const uuid = this.generateUUID();
      idMap[taskId] = uuid;

      commands.push({
        type: "item_delete",
        uuid,
        args: { id: taskId }
      });
    });

    return { commands, taskIds: idMap };
  }

  // Convert batch task completion to Todoist sync commands
  buildTaskCompleteCommands(taskIds: string[]): { commands: BatchCommand[], taskIds: Record<string, string> } {
    const commands: BatchCommand[] = [];
    const idMap: Record<string, string> = {};

    taskIds.forEach(taskId => {
      const uuid = this.generateUUID();
      idMap[taskId] = uuid;

      commands.push({
        type: "item_complete",
        uuid,
        args: { id: taskId }
      });
    });

    return { commands, taskIds: idMap };
  }

  // Convert batch project creation to Todoist sync commands
  buildProjectCreateCommands(projects: BatchProjectCreate[]): { commands: BatchCommand[], tempIds: Record<string, string> } {
    const commands: BatchCommand[] = [];
    const tempIds: Record<string, string> = {};

    projects.forEach(project => {
      const tempId = this.generateTempId("project");
      const uuid = this.generateUUID();
      tempIds[tempId] = uuid;

      commands.push({
        type: "project_add",
        uuid,
        temp_id: tempId,
        args: {
          name: project.name,
          ...(project.color && { color: project.color }),
          ...(project.parentId && { parent_id: project.parentId }),
          ...(project.description && { description: project.description })
        }
      });
    });

    return { commands, tempIds };
  }

  // Execute batch commands via Todoist Sync API
  async executeBatch(commands: BatchCommand[]): Promise<BatchResult> {
    if (commands.length === 0) {
      return {
        successful: [],
        failed: [],
        tempIdMappings: {}
      };
    }

    // Validate command count (Todoist supports up to 100 commands per request)
    if (commands.length > 100) {
      throw new Error(`Batch size too large: ${commands.length} commands. Maximum is 100 commands per batch.`);
    }

    try {
      // Execute batch via existing sync API
      const response = await this.actionCtx.runAction(api.todoist.syncApi.executeBatchSync, {
        commands
      });

      return this.parseResponse(response, commands);
    } catch (error) {
      // If batch fails entirely, mark all commands as failed
      return {
        successful: [],
        failed: commands.map(cmd => ({
          tempId: cmd.temp_id,
          uuid: cmd.uuid,
          error: error instanceof Error ? error.message : "Batch execution failed",
          details: error
        })),
        tempIdMappings: {}
      };
    }
  }

  // Parse Todoist sync response into BatchResult
  private parseResponse(response: any, originalCommands: BatchCommand[]): BatchResult {
    const result: BatchResult = {
      successful: [],
      failed: [],
      tempIdMappings: response.temp_id_mapping || {},
      syncToken: response.sync_token
    };

    // Map commands by UUID for easy lookup
    const commandMap = new Map(originalCommands.map(cmd => [cmd.uuid, cmd]));

    // Process sync status for each command
    if (response.sync_status) {
      Object.entries(response.sync_status).forEach(([uuid, status]) => {
        const command = commandMap.get(uuid);
        if (!command) return;

        if (status === "ok") {
          // Get real ID from temp_id_mapping if available
          const realId = command.temp_id ? result.tempIdMappings[command.temp_id] : undefined;
          
          result.successful.push({
            tempId: command.temp_id,
            realId,
            uuid,
            result: status
          });
        } else {
          // Command failed - status contains error details
          const errorInfo: TodoistErrorResponse = 
            typeof status === 'object' && status !== null 
              ? status as TodoistErrorResponse
              : { error: String(status) };
          
          result.failed.push({
            tempId: command.temp_id,
            uuid,
            error: errorInfo.error || "Command failed",
            details: errorInfo
          });
        }
      });
    }

    return result;
  }

  // Helper method to create project with tasks in single batch
  async createProjectWithTasks(
    project: BatchProjectCreate, 
    tasks: Omit<BatchTaskCreate, 'projectId' | 'projectTempId'>[]
  ): Promise<BatchResult> {
    const projectTempId = this.generateTempId("project");
    
    // Build project creation command
    const projectCommand = {
      type: "project_add",
      uuid: this.generateUUID(),
      temp_id: projectTempId,
      args: {
        name: project.name,
        ...(project.color && { color: project.color }),
        ...(project.parentId && { parent_id: project.parentId }),
        ...(project.description && { description: project.description })
      }
    };

    // Build task creation commands that reference the project temp_id
    const tasksWithProject: BatchTaskCreate[] = tasks.map(task => ({
      ...task,
      projectTempId
    }));

    const { commands: taskCommands } = this.buildTaskCreateCommands(tasksWithProject);

    // Execute all commands together
    const allCommands = [projectCommand, ...taskCommands];
    return this.executeBatch(allCommands);
  }
}