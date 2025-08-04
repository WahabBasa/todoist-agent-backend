import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getTasks = query({
  args: {
    completed: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId));

    if (args.completed !== undefined) {
      query = ctx.db.query("tasks").withIndex("by_user_and_completed", (q) => 
        q.eq("userId", userId).eq("isCompleted", args.completed!)
      );
    }

    const tasks = await query.collect();
    
    // Add project names to tasks
    const tasksWithProjects = await Promise.all(
      tasks.map(async (task) => {
        if (task.projectId) {
          const project = await ctx.db.get(task.projectId);
          return { ...task, projectName: project?.name };
        }
        return task;
      })
    );

    return tasksWithProjects;
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedTime: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      priority: args.priority ?? 3,
      dueDate: args.dueDate,
      estimatedTime: args.estimatedTime,
      isCompleted: false,
      tags: args.tags ?? [],
      isRecurring: false,
      recurringPattern: undefined,
    });
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedTime: v.optional(v.number()),
    isCompleted: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.projectId !== undefined) updates.projectId = args.projectId;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.estimatedTime !== undefined) updates.estimatedTime = args.estimatedTime;
    if (args.tags !== undefined) updates.tags = args.tags;
    
    if (args.isCompleted !== undefined) {
      updates.isCompleted = args.isCompleted;
      if (args.isCompleted) {
        updates.completedAt = Date.now();
      } else {
        updates.completedAt = undefined;
      }
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const deleteTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});