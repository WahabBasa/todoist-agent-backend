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
    estimatedHours: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate recurring pattern if task is recurring
    if (args.isRecurring && args.recurringPattern) {
      const validPatterns = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!validPatterns.includes(args.recurringPattern)) {
        throw new Error(`Invalid recurring pattern. Must be one of: ${validPatterns.join(', ')}`);
      }
    }

    // Calculate total estimated time in minutes
    let totalEstimatedTime = args.estimatedTime;
    if (args.estimatedHours || args.estimatedMinutes) {
      totalEstimatedTime = (args.estimatedHours || 0) * 60 + (args.estimatedMinutes || 0);
    }

    // Validate due date if provided
    if (args.dueDate && args.dueDate < Date.now()) {
      console.warn('Creating task with due date in the past');
    }

    return await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      priority: args.priority ?? 3,
      dueDate: args.dueDate,
      estimatedTime: totalEstimatedTime,
      isCompleted: false,
      tags: args.tags ?? [],
      isRecurring: args.isRecurring ?? false,
      recurringPattern: args.isRecurring ? args.recurringPattern : undefined,
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
    estimatedHours: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    isCompleted: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
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

    // Validate recurring pattern if being updated
    if (args.isRecurring && args.recurringPattern) {
      const validPatterns = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!validPatterns.includes(args.recurringPattern)) {
        throw new Error(`Invalid recurring pattern. Must be one of: ${validPatterns.join(', ')}`);
      }
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.projectId !== undefined) updates.projectId = args.projectId;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.isRecurring !== undefined) updates.isRecurring = args.isRecurring;
    if (args.recurringPattern !== undefined) updates.recurringPattern = args.recurringPattern;
    
    // Handle time estimation updates
    if (args.estimatedTime !== undefined) {
      updates.estimatedTime = args.estimatedTime;
    } else if (args.estimatedHours !== undefined || args.estimatedMinutes !== undefined) {
      // Calculate total time from hours and minutes if provided
      const currentTask = await ctx.db.get(args.id);
      const currentHours = Math.floor((currentTask?.estimatedTime || 0) / 60);
      const currentMinutes = (currentTask?.estimatedTime || 0) % 60;
      
      const newHours = args.estimatedHours !== undefined ? args.estimatedHours : currentHours;
      const newMinutes = args.estimatedMinutes !== undefined ? args.estimatedMinutes : currentMinutes;
      
      updates.estimatedTime = newHours * 60 + newMinutes;
    }
    
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

    // Get all active tasks for the user
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_and_completed", (q) => 
        q.eq("userId", userId).eq("isCompleted", false)
      )
      .collect();

    // Filter tasks with due dates in the specified range
    const upcomingTasks = tasks.filter(task => 
      task.dueDate && 
      task.dueDate >= now && 
      task.dueDate <= futureDate
    );

    // Sort by due date chronologically
    upcomingTasks.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

    // Add project names to tasks
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

    let query = ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId));

    if (args.completed !== undefined) {
      query = ctx.db.query("tasks").withIndex("by_user_and_completed", (q) => 
        q.eq("userId", userId).eq("isCompleted", args.completed!)
      );
    }

    let tasks = await query.collect();
    
    // Filter by project if specified
    if (args.projectId) {
      tasks = tasks.filter(task => task.projectId === args.projectId);
    }
    
    // Filter by priority if specified
    if (args.priority) {
      tasks = tasks.filter(task => task.priority === args.priority);
    }
    
    // Sort tasks based on sortBy parameter
    if (args.sortBy) {
      const isDescending = args.sortOrder === "desc";
      
      tasks.sort((a, b) => {
        let comparison = 0;
        
        switch (args.sortBy) {
          case "priority":
            comparison = a.priority - b.priority; // Lower numbers = higher priority
            break;
          case "dueDate":
            const aDue = a.dueDate || Infinity;
            const bDue = b.dueDate || Infinity;
            comparison = aDue - bDue;
            break;
          case "createdAt":
            comparison = (a._creationTime || 0) - (b._creationTime || 0);
            break;
          default:
            comparison = 0;
        }
        
        return isDescending ? -comparison : comparison;
      });
    }
    
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
    const completedTasks = allTasks.filter(task => task.isCompleted);
    const recurringTasks = allTasks.filter(task => task.isRecurring);
    
    // Priority distribution
    const priorityStats = {
      high: activeTasks.filter(task => task.priority === 1).length,
      medium: activeTasks.filter(task => task.priority === 2).length,
      normal: activeTasks.filter(task => task.priority === 3).length,
      low: activeTasks.filter(task => task.priority === 4).length,
    };
    
    // Overdue tasks
    const now = Date.now();
    const overdueTasks = activeTasks.filter(task => 
      task.dueDate && task.dueDate < now
    ).length;
    
    return {
      total: allTasks.length,
      active: activeTasks.length,
      completed: completedTasks.length,
      recurring: recurringTasks.length,
      overdue: overdueTasks,
      priorityStats,
    };
  },
});