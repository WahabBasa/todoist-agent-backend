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
    labelId: v.optional(v.id("labels")),
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
      // TodoVex compatibility
      taskName: args.title,
      labelId: args.labelId,
      // Legacy compatibility
      title: args.title,
      // Standard fields
      description: args.description,
      projectId: args.projectId,
      priority: args.priority ?? 3,
      dueDate: args.dueDate,
      isCompleted: false,
      // AI-specific fields
      estimatedTime: totalEstimatedTime > 0 ? totalEstimatedTime : undefined,
      tags: args.tags ?? [],
      isRecurring: false,
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

/**
 * getTaskDetails - Gets detailed information about a specific task
 * including associated project information if applicable.
 * This is used after the AI has identified a task using getProjectAndTaskMap.
 */
export const getTaskDetails = query({
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

    // Get project information if task is assigned to a project
    let project = null;
    if (task.projectId) {
      project = await ctx.db.get(task.projectId);
    }

    return {
      ...task,
      project: project ? {
        _id: project._id,
        name: project.name,
        color: project.color,
        description: project.description,
      } : null,
    };
  },
});

export const getInboxTasks = query({
  args: {
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get tasks that don't belong to any project (inbox tasks)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter for inbox tasks (no projectId) and completion status
    const inboxTasks = tasks.filter(task => {
      const isInboxTask = !task.projectId;
      const matchesCompletionFilter = args.completed !== undefined 
        ? task.isCompleted === args.completed 
        : !task.isCompleted; // Default to active tasks
      
      return isInboxTask && matchesCompletionFilter;
    });

    // Sort by creation time (newest first)
    inboxTasks.sort((a, b) => b._creationTime - a._creationTime);

    return inboxTasks;
  },
});

// TodoVex-compatible functions
export const getTodosByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .collect();
  },
});

export const getCompletedTodosByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();
  },
});

export const getIncompleteTodosByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();
  },
});

export const todayTodos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => 
        q.gte(q.field("dueDate"), todayStart.getTime()) &&
        q.lte(q.field("dueDate"), todayEnd.getTime())
      )
      .collect();
  },
});

export const overdueTodos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .filter((q) => q.lt(q.field("dueDate"), todayStart.getTime()))
      .collect();
  },
});

export const completedTodos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();
  },
});

export const incompleteTodos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();
  },
});

export const checkATodo = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.patch(taskId, { isCompleted: true });
    return taskId;
  },
});

export const uncheckATodo = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.patch(taskId, { isCompleted: false });
    return taskId;
  },
});

export const createATodo = mutation({
  args: {
    taskName: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    labelId: v.optional(v.id("labels")),
  },
  handler: async (ctx, { taskName, description, priority, dueDate, projectId, labelId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("tasks", {
      userId,
      taskName,
      title: taskName, // Legacy compatibility
      description,
      priority: priority ?? 3,
      dueDate,
      projectId,
      labelId,
      isCompleted: false,
      // Default AI fields
      estimatedTime: undefined,
      tags: [],
      isRecurring: false,
    });
  },
});

export const groupTodosByDate = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const todos = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.gt(q.field("dueDate"), new Date().getTime()))
      .collect();

    const groupedTodos = todos.reduce<any>((acc, todo) => {
      if (todo.dueDate) {
        const dueDate = new Date(todo.dueDate).toDateString();
        acc[dueDate] = (acc[dueDate] || []).concat(todo);
      }
      return acc;
    }, {});

    return groupedTodos;
  },
});

// Enhanced delete that also deletes subtodos
export const deleteATodo = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    // Delete all subtodos first
    const subTodos = await ctx.db
      .query("subTodos")
      .filter((q) => q.eq(q.field("parentId"), taskId))
      .collect();

    for (const subTodo of subTodos) {
      await ctx.db.delete(subTodo._id);
    }

    // Delete the main task
    await ctx.db.delete(taskId);
    return taskId;
  },
});

/**
 * Migration function to populate missing 'taskName' field from 'title' field
 * This function migrates legacy tasks to TodoVex compatibility format
 */
export const migrateTaskNames = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all tasks without a taskName field but with a title field
    const tasksNeedingMigration = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskName"), undefined))
      .collect();
    
    const migrationResults = {
      migratedFromTitle: 0,
      skippedNoTitle: 0,
      total: tasksNeedingMigration.length,
    };

    // Update each task with taskName populated from title
    for (const task of tasksNeedingMigration) {
      if (task.title) {
        // Copy title to taskName field
        await ctx.db.patch(task._id, {
          taskName: task.title,
        });
        migrationResults.migratedFromTitle++;
      } else {
        // Task has no title field - provide a default
        await ctx.db.patch(task._id, {
          taskName: "Untitled Task",
        });
        migrationResults.skippedNoTitle++;
      }
    }
    
    return migrationResults;
  },
});