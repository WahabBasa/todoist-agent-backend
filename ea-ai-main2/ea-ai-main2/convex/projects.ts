import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

export const getProjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Add task counts
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        
        return {
          ...project,
          taskCount: tasks.length,
          completedTaskCount: tasks.filter(task => task.isCompleted).length,
        };
      })
    );

    return projectsWithCounts;
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("projects", {
      userId,
      name: args.name,
      color: args.color,
      description: args.description,
    });
  },
});

export const updateProject = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const deleteProject = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    // Check if project has tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    if (tasks.length > 0) {
      throw new Error("Cannot delete project with existing tasks");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const getProject = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    return project;
  },
});

// Type definitions for the hierarchical map structure
type LightweightTask = {
  _id: Id<"tasks">;
  title: string;
};

type ProjectWithTasks = {
  _id: Id<"projects">;
  userId: Id<"users">;
  name: string;
  color: string;
  description?: string;
  _creationTime: number;
  tasks: LightweightTask[];
};

type ProjectAndTaskMap = {
  projects: ProjectWithTasks[];
  unassignedTasks: LightweightTask[];
};

/**
 * getProjectAndTaskMap - Efficiently queries a user's entire data store
 * and returns a single, hierarchically structured object containing all
 * projects with their associated tasks, plus unassigned tasks.
 * 
 * This function implements the theorem-proven approach for optimal data retrieval:
 * 1. Parallel queries for projects and tasks (O(1) database operations)
 * 2. Map-based lookup for O(1) task-to-project assignment
 * 3. Lightweight task objects containing only _id and title
 * 4. Separate array for tasks not assigned to any project
 */
export const getProjectAndTaskMap = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProjectAndTaskMap> => {
    // Step 1: Authorization and Data Integrity
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return empty map for unauthenticated users to prevent data leakage
      return {
        projects: [],
        unassignedTasks: [],
      };
    }

    // Step 2: Efficient, Parallel Data Retrieval
    // Use Promise.all for parallel execution - most efficient approach
    const [projects, tasks] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    // Step 3: Structuring for Efficient Lookup
    // Create Map for O(1) lookup performance
    const projectMap = new Map<Id<"projects">, ProjectWithTasks>();
    
    // Initialize project map with empty task arrays
    projects.forEach(project => {
      projectMap.set(project._id, {
        ...project,
        tasks: [],
      });
    });

    // Step 4: Hierarchical Mapping and Task Assignment
    const unassignedTasks: LightweightTask[] = [];
    
    // Single pass through tasks for optimal performance
    tasks.forEach(task => {
      // Filter out completed tasks unless specifically requested
      if (!args.includeCompleted && task.isCompleted) {
        return; // Skip completed tasks by default
      }

      // Create lightweight task object with only required fields
      const lightweightTask: LightweightTask = {
        _id: task._id,
        title: task.title,
      };

      // Check if task has valid project assignment
      if (task.projectId && projectMap.has(task.projectId)) {
        // Add to corresponding project's task list
        projectMap.get(task.projectId)!.tasks.push(lightweightTask);
      } else {
        // Add to unassigned tasks if no valid project
        unassignedTasks.push(lightweightTask);
      }
    });

    // Step 5: Final Output Formulation
    return {
      projects: Array.from(projectMap.values()),
      unassignedTasks,
    };
  },
});

/**
 * getProjectDetails - Gets detailed information about a specific project
 * including all associated tasks with full details, not just lightweight versions.
 * This is used after the AI has identified a project using getProjectAndTaskMap.
 */
export const getProjectDetails = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      ...project,
      tasks,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter(task => task.isCompleted).length,
    };
  },
});