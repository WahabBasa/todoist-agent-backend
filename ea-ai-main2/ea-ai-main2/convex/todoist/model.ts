import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { 
  requireUserAuthForAction, 
  logUserAccess,
  validateDataOwnership 
} from "./userAccess";

// Modern Todoist API v1 Sync endpoint
const TODOIST_SYNC_API_URL = "https://api.todoist.com/api/v1/sync";

// Generate unique UUID for commands
function generateUUID(): string {
  return crypto.randomUUID();
}

// Generate unique temporary ID for new resources
function generateTempId(prefix: string = "temp"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// =================================================================
// CORE TODOIST MODEL FUNCTIONS
// Plain TypeScript functions that can be called directly from actions
// Following Convex best practices - no runAction chains
// =================================================================

// Helper function to make authenticated Todoist Sync API requests with user validation
// Exported as plain function - can be called directly from actions and tools
export async function todoistSyncRequest(
  ctx: ActionCtx, 
  commands: any[] = [], 
  resourceTypes: string[] = ["all"],
  syncToken: string = "*"
): Promise<any> {
  // Actions must use internal queries for database access
  const userContext = await requireUserAuthForAction(ctx);
  const { userId } = userContext;
  
  // Check if user has active Todoist connection via internal query
  const hasConnection = await ctx.runQuery(internal.todoist.auth.hasActiveTodoistConnectionQuery, {
    userId
  });
  
  if (!hasConnection) {
    logUserAccess(userId, "TODOIST_CONNECTION_CHECK", "FAILED - No connection");
    throw new Error("Todoist not connected. Please connect your Todoist account to use task management features.");
  }
  
  // Get user's Todoist token via internal query
  const accessToken = await ctx.runQuery(internal.todoist.auth.getUserTodoistTokenQuery, {
    userId
  });
  
  if (!accessToken) {
    logUserAccess(userId, "TODOIST_API_REQUEST", "FAILED - No token");
    throw new Error("Todoist authentication expired. Please reconnect your account.");
  }
  
  // Log the API request for security monitoring
  logUserAccess(userId, "TODOIST_SYNC_REQUEST", `commands:${commands.length} resources:${resourceTypes.join(',')}`);

  // Prepare form data for sync request
  const formData = new URLSearchParams();
  formData.append('sync_token', syncToken);
  formData.append('resource_types', JSON.stringify(resourceTypes));
  
  if (commands.length > 0) {
    formData.append('commands', JSON.stringify(commands));
  }

  const response: Response = await fetch(TODOIST_SYNC_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Todoist authentication expired. Please reconnect your account.");
    }
    const errorText = await response.text();
    throw new Error(`Todoist Sync API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  // Check for command execution errors
  if (result.sync_status && commands.length > 0) {
    const errors = Object.entries(result.sync_status)
      .filter(([_, status]) => status !== "ok")
      .map(([uuid, status]) => `Command ${uuid}: ${JSON.stringify(status)}`);
    
    if (errors.length > 0) {
      logUserAccess(userId, "TODOIST_SYNC_COMMANDS", `FAILED - ${errors.length} errors`);
      throw new Error(`Todoist command errors: ${errors.join(', ')}`);
    }
  }

  // Log successful API response
  logUserAccess(userId, "TODOIST_SYNC_RESPONSE", `SUCCESS - ${resourceTypes.join(',')}`);
  
  // Add user context to response for validation downstream
  return {
    ...result,
    _userContext: { userId } // Internal field for validation
  };
}

// =================================================================
// TODOIST TASK OPERATIONS
// =================================================================

export async function createTask(
  ctx: ActionCtx,
  {
    content,
    description,
    projectId,
    sectionId,
    parentId,
    priority,
    dueString,
    dueDate,
    dueDatetime,
    labels
  }: {
    content: string;
    description?: string;
    projectId?: string;
    sectionId?: string;
    parentId?: string;
    priority?: number;
    dueString?: string;
    dueDate?: string;
    dueDatetime?: string;
    labels?: any[];
  }
): Promise<any> {
  const tempId = generateTempId("task");
  const uuid = generateUUID();
  
  const args: any = { content };
  
  if (description) args.description = description;
  if (projectId) args.project_id = projectId;
  if (sectionId) args.section_id = sectionId;
  if (parentId) args.parent_id = parentId;
  if (priority) args.priority = priority;
  if (labels && labels.length > 0) args.labels = labels;
  
  // Handle due date - prioritize datetime > date > string
  if (dueDatetime) {
    args.due = { datetime: dueDatetime };
  } else if (dueDate) {
    args.due = { date: dueDate };
  } else if (dueString) {
    args.due = { string: dueString };
  }

  const command = {
    type: "item_add",
    temp_id: tempId,
    uuid,
    args,
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  // Return the created task from temp_id_mapping
  const createdTaskId = result.temp_id_mapping?.[tempId];
  if (createdTaskId) {
    return {
      success: true,
      taskId: createdTaskId,
      tempId,
      sync_token: result.sync_token,
    };
  }
  
  return {
    success: true,
    tempId,
    sync_token: result.sync_token,
  };
}

export async function updateTask(
  ctx: ActionCtx,
  {
    taskId,
    content,
    description,
    priority,
    dueString,
    dueDate,
    dueDatetime,
    labels
  }: {
    taskId: string;
    content?: string;
    description?: string;
    priority?: number;
    dueString?: string;
    dueDate?: string;
    dueDatetime?: string;
    labels?: any[];
  }
): Promise<any> {
  const uuid = generateUUID();
  
  const args: any = { id: taskId };
  
  if (content) args.content = content;
  if (description !== undefined) args.description = description;
  if (priority) args.priority = priority;
  if (labels !== undefined) args.labels = labels;
  
  // Handle due date updates
  if (dueDatetime) {
    args.due = { datetime: dueDatetime };
  } else if (dueDate) {
    args.due = { date: dueDate };
  } else if (dueString) {
    args.due = { string: dueString };
  }

  const command = {
    type: "item_update",
    uuid,
    args,
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  return {
    success: true,
    sync_token: result.sync_token,
  };
}

export async function completeTask(ctx: ActionCtx, { taskId }: { taskId: string }): Promise<any> {
  const uuid = generateUUID();
  
  const command = {
    type: "item_complete",
    uuid,
    args: {
      id: taskId,
    },
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  return {
    success: true,
    sync_token: result.sync_token,
  };
}

export async function reopenTask(ctx: ActionCtx, { taskId }: { taskId: string }): Promise<any> {
  const uuid = generateUUID();
  
  const command = {
    type: "item_uncomplete",
    uuid,
    args: {
      id: taskId,
    },
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  return {
    success: true,
    sync_token: result.sync_token,
  };
}

export async function deleteTask(ctx: ActionCtx, { taskId }: { taskId: string }): Promise<any> {
  const uuid = generateUUID();
  
  const command = {
    type: "item_delete",
    uuid,
    args: {
      id: taskId,
    },
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  return {
    success: true,
    sync_token: result.sync_token,
  };
}

// =================================================================
// TODOIST PROJECT OPERATIONS  
// =================================================================

export async function createProject(
  ctx: ActionCtx,
  {
    name,
    color,
    parentId
  }: {
    name: string;
    color?: string;
    parentId?: string;
  }
): Promise<any> {
  const tempId = generateTempId("project");
  const uuid = generateUUID();
  
  const command = {
    type: "project_add",
    temp_id: tempId,
    uuid,
    args: {
      name,
      ...(color && { color }),
      ...(parentId && { parent_id: parentId }),
    },
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  // Return the created project from temp_id_mapping
  const createdProjectId = result.temp_id_mapping?.[tempId];
  if (createdProjectId) {
    return {
      success: true,
      projectId: createdProjectId,
      tempId,
      sync_token: result.sync_token,
    };
  }
  
  return {
    success: true,
    tempId,
    sync_token: result.sync_token,
  };
}

export async function updateProject(
  ctx: ActionCtx,
  {
    projectId,
    name,
    color
  }: {
    projectId: string;
    name?: string;
    color?: string;
  }
): Promise<any> {
  const args: any = { id: projectId };
  if (name) args.name = name;
  if (color) args.color = color;
  
  const commands = [{
    type: "project_update",
    uuid: generateUUID(),
    args,
  }];

  const result = await todoistSyncRequest(ctx, commands);
  return {
    success: true,
    projectId,
    sync_token: result.sync_token,
  };
}

export async function deleteProject(ctx: ActionCtx, { projectId }: { projectId: string }): Promise<any> {
  const commands = [{
    type: "project_delete",
    uuid: generateUUID(),
    args: { id: projectId },
  }];

  const result = await todoistSyncRequest(ctx, commands);
  return {
    success: true,
    projectId,
    sync_token: result.sync_token,
  };
}

// =================================================================
// TODOIST DATA RETRIEVAL OPERATIONS
// =================================================================

export async function syncTodoistData(
  ctx: ActionCtx,
  {
    syncToken = "*",
    resourceTypes = ["all"]
  }: {
    syncToken?: string;
    resourceTypes?: string[];
  } = {}
): Promise<any> {
  return await todoistSyncRequest(ctx, [], resourceTypes, syncToken);
}

export async function getTodoistProjects(ctx: ActionCtx): Promise<any[]> {
  const result = await todoistSyncRequest(ctx, [], ["projects"]);
  return result.projects || [];
}

export async function getTodoistTasks(
  ctx: ActionCtx, 
  { projectId }: { projectId?: string } = {}
): Promise<any[]> {
  const result = await todoistSyncRequest(ctx, [], ["items"]);
  const tasks: any[] = result.items || [];
  
  // Filter by project if specified
  if (projectId) {
    return tasks.filter((task: any) => task.project_id === projectId);
  }
  
  return tasks;
}

// =================================================================
// TODOIST LABEL OPERATIONS
// =================================================================

export async function createLabel(
  ctx: ActionCtx,
  {
    name,
    color
  }: {
    name: string;
    color?: string;
  }
): Promise<any> {
  const tempId = generateTempId("label");
  const uuid = generateUUID();
  
  const command = {
    type: "label_add",
    temp_id: tempId,
    uuid,
    args: {
      name,
      ...(color && { color }),
    },
  };

  const result = await todoistSyncRequest(ctx, [command]);
  
  // Return the created label from temp_id_mapping
  const createdLabelId = result.temp_id_mapping?.[tempId];
  if (createdLabelId) {
    return {
      success: true,
      labelId: createdLabelId,
      tempId,
      sync_token: result.sync_token,
    };
  }
  
  return {
    success: true,
    tempId,
    sync_token: result.sync_token,
  };
}

// =================================================================
// BATCH OPERATIONS
// =================================================================

export async function createProjectWithTasks(
  ctx: ActionCtx,
  {
    projectName,
    projectColor,
    tasks
  }: {
    projectName: string;
    projectColor?: string;
    tasks: any[];
  }
): Promise<any> {
  const projectTempId = generateTempId("project");
  const commands: any[] = [];
  
  // First command: Create the project
  commands.push({
    type: "project_add",
    temp_id: projectTempId,
    uuid: generateUUID(),
    args: {
      name: projectName,
      ...(projectColor && { color: projectColor }),
    },
  });
  
  // Subsequent commands: Create tasks in the project using temp_id
  tasks.forEach((task: any) => {
    const taskTempId = generateTempId("task");
    const args: any = {
      content: task.content,
      project_id: projectTempId, // Reference the temporary project ID
    };
    
    if (task.description) args.description = task.description;
    if (task.priority) args.priority = task.priority;
    if (task.dueString) args.due = { string: task.dueString };
    if (task.labels && task.labels.length > 0) args.labels = task.labels;
    
    commands.push({
      type: "item_add",
      temp_id: taskTempId,
      uuid: generateUUID(),
      args,
    });
  });

  const result = await todoistSyncRequest(ctx, commands);
  
  return {
    success: true,
    projectId: result.temp_id_mapping?.[projectTempId],
    projectTempId,
    taskMappings: result.temp_id_mapping,
    sync_token: result.sync_token,
    commandCount: commands.length,
  };
}