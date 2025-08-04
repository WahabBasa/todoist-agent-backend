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

    let query = ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    if (args.completed !== undefined) {
      query = ctx.db
        .query("tasks")
        .withIndex("by_user_and_completed", (q) => 
          q.eq("userId", userId).eq("isCompleted", args.completed!)
        );
    }

    if (args.projectId) {
      query = ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId));
    }

    const tasks = await query.collect();
    
    // Get project names for tasks
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
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      priority: args.priority ?? 3,
      dueDate: args.dueDate,
      estimatedTime: args.estimatedTime,
      isCompleted: false,
      tags: args.tags ?? [],
      isRecurring: args.isRecurring ?? false,
      recurringPattern: args.recurringPattern,
    });

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
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

    const task = await ctx.db.get(args.taskId);
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

    await ctx.db.patch(args.taskId, updates);
    return args.taskId;
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.delete(args.taskId);
    return args.taskId;
  },
});

export const getUpcomingTasks = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const days = args.days ?? 7;
    const now = Date.now();
    const futureTime = now + (days * 24 * 60 * 60 * 1000);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_and_completed", (q) => 
        q.eq("userId", userId).eq("isCompleted", false)
      )
      .collect();

    const upcomingTasks = tasks.filter(task => 
      task.dueDate && task.dueDate >= now && task.dueDate <= futureTime
    );

    return upcomingTasks.sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
  },
});
