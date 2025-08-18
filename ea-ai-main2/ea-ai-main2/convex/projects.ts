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

    // Get user projects
    const userProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Get system projects
    const systemProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("type"), "system"))
      .collect();

    const allProjects = [...systemProjects, ...userProjects];

    // Add task counts
    const projectsWithCounts = await Promise.all(
      allProjects.map(async (project) => {
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
    color: v.optional(v.string()),
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
      type: "user",
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

// TodoVex-compatible functions
export const getProjectByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(projectId);
    if (!project) {
      return null;
    }

    // Allow access to system projects or user's own projects
    if (project.type === "system" || project.userId === userId) {
      return project;
    }

    return null;
  },
});

// Helper function to create default system projects
export const createSystemProjects = mutation({
  args: {},
  handler: async (ctx) => {
    const systemProjects = [
      { name: "Inbox", type: "system" as const, color: "#64748b" },
      { name: "Personal", type: "system" as const, color: "#10b981" },
      { name: "Work", type: "system" as const, color: "#3b82f6" },
    ];

    const projectIds = [];
    for (const projectData of systemProjects) {
      // Check if system project already exists
      const existing = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("name"), projectData.name))
        .filter((q) => q.eq(q.field("type"), "system"))
        .first();

      if (!existing) {
        const projectId = await ctx.db.insert("projects", {
          userId: null,
          name: projectData.name,
          type: projectData.type,
          color: projectData.color,
        });
        projectIds.push(projectId);
      }
    }

    return projectIds;
  },
});

/**
 * Migration function to populate missing 'type' field in existing projects
 * This function identifies system vs user projects and updates them accordingly
 */
export const migrateProjectTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // System project names that should be marked as "system" type
    const systemProjectNames = ["Inbox", "Personal", "Work"];
    
    // Find all projects without a type field
    const projectsNeedingMigration = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("type"), undefined))
      .collect();
    
    const migrationResults = {
      systemProjects: 0,
      userProjects: 0,
      total: projectsNeedingMigration.length,
    };

    // Update each project with the appropriate type
    for (const project of projectsNeedingMigration) {
      let projectType: "user" | "system";
      
      // Determine if this is a system project based on name and userId
      if (systemProjectNames.includes(project.name) || project.userId === null) {
        projectType = "system";
        migrationResults.systemProjects++;
      } else {
        projectType = "user";
        migrationResults.userProjects++;
      }
      
      // Update the project with the determined type
      await ctx.db.patch(project._id, {
        type: projectType,
      });
    }
    
    return migrationResults;
  },
});

// Enhanced delete with cascade support
export const deleteProjectAndTasks = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId || project.type === "system") {
      throw new Error("Project not found or unauthorized");
    }

    // Get all tasks for this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Delete all subtodos for each task
    for (const task of tasks) {
      const subTodos = await ctx.db
        .query("subTodos")
        .filter((q) => q.eq(q.field("parentId"), task._id))
        .collect();
      
      for (const subTodo of subTodos) {
        await ctx.db.delete(subTodo._id);
      }
    }

    // Delete all tasks
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    // Finally delete the project
    await ctx.db.delete(projectId);
    return projectId;
  },
});

// Type definitions for the hierarchical map structure
type LightweightTask = {
  _id: Id<"tasks">;
  title: string;
};

type ProjectWithTasks = {
  _id: Id<"projects">;
  userId: Id<"users"> | null;
  name: string;
  color?: string;
  description?: string;
  type: "user" | "system";
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
        title: task.title || task.taskName || "Untitled Task", // Guaranteed string fallback
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