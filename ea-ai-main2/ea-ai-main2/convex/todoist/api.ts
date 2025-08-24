import { action, mutation } from "../_generated/server";
// Clerk authentication handled via ctx.auth.getUserIdentity()
import { v } from "convex/values";
import { internal } from "../_generated/api";

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";

// Helper function to make authenticated Todoist API requests (for action contexts)
async function todoistRequest(ctx: any, endpoint: string, options: RequestInit = {}): Promise<any> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User not authenticated");
  }
  const userId = identity.tokenIdentifier;

  // Get user's Todoist token via internal query
  const tokenData: { accessToken: string } | null = await ctx.runQuery(internal.todoist.auth.getTodoistTokenForUser, {
    userId,
  });

  if (!tokenData) {
    throw new Error("Todoist not connected. Please connect your Todoist account first.");
  }

  const response: Response = await fetch(`${TODOIST_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenData.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Todoist authentication expired. Please reconnect your account.");
    }
    throw new Error(`Todoist API error: ${response.statusText}`);
  }

  // Handle empty responses (like for DELETE requests)
  const contentLength = response.headers.get("content-length");
  if (contentLength === "0" || response.status === 204) {
    return null;
  }

  return await response.json();
}

// Get all Todoist projects
export const getTodoistProjects = action({
  handler: async (ctx) => {
    return await todoistRequest(ctx, "/projects");
  },
});

// Create a new Todoist project
export const createTodoistProject = action({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, { name, color, parentId }) => {
    const body: any = { name };
    if (color) body.color = color;
    if (parentId) body.parent_id = parentId;

    return await todoistRequest(ctx, "/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});

// Update a Todoist project
export const updateTodoistProject = action({
  args: {
    projectId: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, name, color }) => {
    const body: any = {};
    if (name) body.name = name;
    if (color) body.color = color;

    return await todoistRequest(ctx, `/projects/${projectId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});

// Delete a Todoist project
export const deleteTodoistProject = action({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, { projectId }) => {
    await todoistRequest(ctx, `/projects/${projectId}`, {
      method: "DELETE",
    });
    return { success: true };
  },
});

// Get all Todoist tasks
export const getTodoistTasks = action({
  args: {
    projectId: v.optional(v.string()),
    filter: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, filter }) => {
    let endpoint = "/tasks";
    const params = new URLSearchParams();
    
    if (projectId) params.append("project_id", projectId);
    if (filter) params.append("filter", filter);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return await todoistRequest(ctx, endpoint);
  },
});

// Create a new Todoist task
export const createTodoistTask = action({
  args: {
    content: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.string()),
    priority: v.optional(v.number()), // 1-4, where 4 is highest priority
    dueString: v.optional(v.string()), // Natural language like "tomorrow", "next week"
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { content, description, projectId, priority, dueString, labels }) => {
    const body: any = { content };
    
    if (description) body.description = description;
    if (projectId) body.project_id = projectId;
    if (priority) body.priority = priority;
    if (dueString) body.due_string = dueString;
    if (labels && labels.length > 0) body.labels = labels;

    return await todoistRequest(ctx, "/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});

// Update a Todoist task
export const updateTodoistTask = action({
  args: {
    taskId: v.string(),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueString: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { taskId, content, description, priority, dueString, labels }) => {
    const body: any = {};
    
    if (content) body.content = content;
    if (description) body.description = description;
    if (priority) body.priority = priority;
    if (dueString) body.due_string = dueString;
    if (labels) body.labels = labels;

    return await todoistRequest(ctx, `/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});

// Complete a Todoist task
export const completeTodoistTask = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, { taskId }) => {
    await todoistRequest(ctx, `/tasks/${taskId}/close`, {
      method: "POST",
    });
    return { success: true };
  },
});

// Reopen a Todoist task
export const reopenTodoistTask = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, { taskId }) => {
    await todoistRequest(ctx, `/tasks/${taskId}/reopen`, {
      method: "POST",
    });
    return { success: true };
  },
});

// Delete a Todoist task
export const deleteTodoistTask = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, { taskId }) => {
    await todoistRequest(ctx, `/tasks/${taskId}`, {
      method: "DELETE",
    });
    return { success: true };
  },
});

// Get Todoist labels
export const getTodoistLabels = action({
  handler: async (ctx) => {
    return await todoistRequest(ctx, "/labels");
  },
});

// Create a Todoist label
export const createTodoistLabel = action({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { name, color }) => {
    const body: any = { name };
    if (color) body.color = color;

    return await todoistRequest(ctx, "/labels", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});