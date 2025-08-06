import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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

// --- NEW FUNCTION ---
// Added to support the read-before-write pattern, allowing for efficient
// verification that a task exists before updating or deleting it.
export const getTaskById = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return null;
        }
        const task = await ctx.db.get(args.taskId);
        if (!task || task.userId !== userId) {
            return null;
        }
        return task;
    },
});


export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Calculate total estimated time in minutes
    const totalEstimatedTime = (args.estimatedHours || 0) * 60 + (args.estimatedMinutes || 0);

    return await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      priority: args.priority ?? 3,
      dueDate: args.dueDate,
      estimatedTime: totalEstimatedTime > 0 ? totalEstimatedTime : undefined,
      isCompleted: false,
      tags: args.tags ?? [],
      isRecurring: false, // Simplified for now
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
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { id, ...rest } = args;
    const task = await ctx.db.get(id);

    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.patch(id, rest);
    return id;
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

export const getUpcomingTasks = query({
    args: {
      days: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Not authenticated");
      }
  
      const daysAhead = args.days ?? 7;
      const now = Date.now();
      const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);
  
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_and_completed", (q) =>
          q.eq("userId", userId).eq("isCompleted", false)
        )
        .collect();
  
      const upcomingTasks = tasks.filter(task =>
        task.dueDate &&
        task.dueDate >= now &&
        task.dueDate <= futureDate
      );
  
      upcomingTasks.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
  
      const tasksWithProjects = await Promise.all(
        upcomingTasks.map(async (task) => {
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

  export const getTasksByFilter = query({
    args: {
      completed: v.optional(v.boolean()),
      projectId: v.optional(v.id("projects")),
      priority: v.optional(v.number()),
      sortBy: v.optional(v.string()), // "priority", "dueDate", "createdAt"
      sortOrder: v.optional(v.string()), // "asc", "desc"
    },
    handler: async (ctx, args) => {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Not authenticated");
      }
  
      let tasks = await ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  
      if (args.completed !== undefined) {
        tasks = tasks.filter(task => task.isCompleted === args.completed);
      }
      if (args.projectId) {
        tasks = tasks.filter(task => task.projectId === args.projectId);
      }
      if (args.priority) {
        tasks = tasks.filter(task => task.priority === args.priority);
      }
  
      if (args.sortBy) {
        const isDescending = args.sortOrder === "desc";
        tasks.sort((a, b) => {
          let comparison = 0;
          switch (args.sortBy) {
            case "priority":
              comparison = (a.priority ?? 3) - (b.priority ?? 3);
              break;
            case "dueDate":
              comparison = (a.dueDate || Infinity) - (b.dueDate || Infinity);
              break;
            case "createdAt":
              comparison = a._creationTime - b._creationTime;
              break;
          }
          return isDescending ? -comparison : comparison;
        });
      }
  
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
  
  export const getTaskStats = query({
    args: {},
    handler: async (ctx) => {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Not authenticated");
      }
  
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
  
      const activeTasks = allTasks.filter(task => !task.isCompleted);
      const now = Date.now();
  
      return {
        total: allTasks.length,
        active: activeTasks.length,
        completed: allTasks.length - activeTasks.length,
        overdue: activeTasks.filter(task => task.dueDate && task.dueDate < now).length,
        recurring: allTasks.filter(task => task.isRecurring).length,
      };
    },
  });