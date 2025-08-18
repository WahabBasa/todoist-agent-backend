import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const getSubTodos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("subTodos")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

export const getSubTodosByParentId = query({
  args: {
    parentId: v.id("tasks"),
  },
  handler: async (ctx, { parentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("subTodos")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("parentId"), parentId))
      .collect();
  },
});

export const getCompletedSubTodos = query({
  args: {
    parentId: v.id("tasks"),
  },
  handler: async (ctx, { parentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("subTodos")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("parentId"), parentId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();
  },
});

export const getIncompleteSubTodos = query({
  args: {
    parentId: v.id("tasks"),
  },
  handler: async (ctx, { parentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("subTodos")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("parentId"), parentId))
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();
  },
});

export const createSubTodo = mutation({
  args: {
    parentId: v.id("tasks"),
    taskName: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueDate: v.number(),
    projectId: v.id("projects"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, {
    parentId,
    taskName,
    description,
    priority,
    dueDate,
    projectId,
    labelId,
  }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify parent task exists and belongs to user
    const parentTask = await ctx.db.get(parentId);
    if (!parentTask || parentTask.userId !== userId) {
      throw new Error("Parent task not found or unauthorized");
    }

    const newSubTodoId = await ctx.db.insert("subTodos", {
      userId,
      parentId,
      taskName,
      description,
      priority,
      dueDate,
      projectId,
      labelId,
      isCompleted: false,
    });

    return newSubTodoId;
  },
});

export const updateSubTodo = mutation({
  args: {
    subTodoId: v.id("subTodos"),
    taskName: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    labelId: v.optional(v.id("labels")),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { subTodoId, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const subTodo = await ctx.db.get(subTodoId);
    if (!subTodo || subTodo.userId !== userId) {
      throw new Error("SubTodo not found or unauthorized");
    }

    await ctx.db.patch(subTodoId, updates);
    return subTodoId;
  },
});

export const checkSubTodo = mutation({
  args: { subTodoId: v.id("subTodos") },
  handler: async (ctx, { subTodoId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const subTodo = await ctx.db.get(subTodoId);
    if (!subTodo || subTodo.userId !== userId) {
      throw new Error("SubTodo not found or unauthorized");
    }

    await ctx.db.patch(subTodoId, { isCompleted: true });
    return subTodoId;
  },
});

export const uncheckSubTodo = mutation({
  args: { subTodoId: v.id("subTodos") },
  handler: async (ctx, { subTodoId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const subTodo = await ctx.db.get(subTodoId);
    if (!subTodo || subTodo.userId !== userId) {
      throw new Error("SubTodo not found or unauthorized");
    }

    await ctx.db.patch(subTodoId, { isCompleted: false });
    return subTodoId;
  },
});

export const deleteSubTodo = mutation({
  args: {
    subTodoId: v.id("subTodos"),
  },
  handler: async (ctx, { subTodoId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const subTodo = await ctx.db.get(subTodoId);
    if (!subTodo || subTodo.userId !== userId) {
      throw new Error("SubTodo not found or unauthorized");
    }

    await ctx.db.delete(subTodoId);
    return subTodoId;
  },
});

