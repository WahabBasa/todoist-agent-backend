import { action } from "../_generated/server";
import { v } from "convex/values";
// Import model layer for direct function calls (eliminates Action→Action chains)
import * as TodoistModel from "./model";

// =================================================================
// THIN API WRAPPERS
// These actions are now thin wrappers that call the model layer
// This maintains API compatibility while following Convex best practices
// =================================================================

// Sync API: Get all user data (initial sync)
export const syncTodoistData = action({
  args: {
    syncToken: v.optional(v.string()),
    resourceTypes: v.optional(v.any()), // Simplified to avoid deep type inference
  },
  handler: async (ctx, { syncToken = "*", resourceTypes = ["all"] }): Promise<any> => {
    return await TodoistModel.syncTodoistData(ctx, { syncToken, resourceTypes });
  },
});

// Sync API: Create a new project
export const createTodoistProjectSync = action({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.createProject(ctx, args);
  },
});

// Sync API: Create a new task (item)
export const createTodoistTaskSync = action({
  args: {
    content: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.string()),
    sectionId: v.optional(v.string()),
    parentId: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueString: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    dueDatetime: v.optional(v.string()),
    labels: v.optional(v.any()), // Simplified to avoid deep array validation
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.createTask(ctx, args);
  },
});

// Sync API: Update a task
export const updateTodoistTaskSync = action({
  args: {
    taskId: v.string(),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueString: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    dueDatetime: v.optional(v.string()),
    labels: v.optional(v.any()), // Simplified
  },
  handler: async (ctx, args) => {
    return await TodoistModel.updateTask(ctx, args);
  },
});

// Sync API: Complete a task
export const completeTodoistTaskSync = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.completeTask(ctx, args);
  },
});

// Sync API: Reopen a completed task
export const reopenTodoistTaskSync = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.reopenTask(ctx, args);
  },
});

// Sync API: Delete a task
export const deleteTodoistTaskSync = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.deleteTask(ctx, args);
  },
});

// Sync API: Create a label
export const createTodoistLabelSync = action({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.createLabel(ctx, args);
  },
});

// Sync API: Batch operations - create project with tasks in one request
export const createProjectWithTasksSync = action({
  args: {
    projectName: v.string(),
    projectColor: v.optional(v.string()),
    tasks: v.any(), // Simplified to avoid deep nested object validation
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.createProjectWithTasks(ctx, args);
  },
});

// GET Functions for compatibility with deleted api.ts

// Get all projects using Sync API
export const getTodoistProjectsSync = action({
  handler: async (ctx): Promise<any[]> => {
    return await TodoistModel.getTodoistProjects(ctx);
  },
});

// Get all tasks using Sync API  
export const getTodoistTasksSync = action({
  args: {
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    return await TodoistModel.getTodoistTasks(ctx, args);
  },
});

// Update project using Sync API
export const updateTodoistProjectSync = action({
  args: {
    projectId: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.updateProject(ctx, args);
  },
});

// Delete project using Sync API
export const deleteTodoistProjectSync = action({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await TodoistModel.deleteProject(ctx, args);
  },
});