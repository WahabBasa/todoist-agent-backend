import { action } from "../_generated/server";
// Clerk authentication handled via ctx.auth.getUserIdentity()
import { v } from "convex/values";
import { api } from "../_generated/api";

// Enhanced integration functions that combine Todoist APIs to match our existing tool interface

export const getTodoistProjectAndTaskMap = action({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { includeCompleted = false }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check if user has Todoist connected
    const hasConnection = await ctx.runQuery(api.todoist.auth.hasTodoistConnection);
    if (!hasConnection) {
      throw new Error("Todoist not connected. Please connect your Todoist account first to manage tasks.");
    }

    try {
      // Get projects and tasks in parallel
      const [projects, allTasks] = await Promise.all([
        ctx.runAction(api.todoist.syncApi.getTodoistProjectsSync),
        ctx.runAction(api.todoist.syncApi.getTodoistTasksSync, {})
      ]) as [any[], any[]];

      // Filter tasks based on completion status if needed
      const filteredTasks = includeCompleted 
        ? allTasks 
        : allTasks.filter((task: any) => !task.is_completed);

      // Group tasks by project
      const tasksGroupedByProject: Record<string, Array<{ _id: string; title: string; }>> = 
        filteredTasks.reduce((acc: Record<string, Array<{ _id: string; title: string; }>>, task: any) => {
          const projectId = task.project_id;
          if (!acc[projectId]) {
            acc[projectId] = [];
          }
          acc[projectId].push({
            _id: task.id,
            title: task.content
          });
          return acc;
        }, {});

      // Build project structure with tasks
      const projectsWithTasks = projects.map((project: any) => ({
        _id: project.id,
        name: project.name,
        color: project.color,
        tasks: tasksGroupedByProject[project.id] || []
      }));

      // Find unassigned tasks (tasks not belonging to any project)
      const assignedTaskIds = new Set();
      Object.values(tasksGroupedByProject).forEach((tasks) => {
        tasks.forEach((task) => assignedTaskIds.add(task._id));
      });

      const unassignedTasks = filteredTasks
        .filter((task: any) => !assignedTaskIds.has(task.id))
        .map((task: any) => ({
          _id: task.id,
          title: task.content
        }));

      return {
        projects: projectsWithTasks,
        unassignedTasks: unassignedTasks
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch Todoist data: ${error.message}`);
    }
  },
});

export const getTodoistProjectDetails = action({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, { projectId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check Todoist connection
    const hasConnection = await ctx.runQuery(api.todoist.auth.hasTodoistConnection);
    if (!hasConnection) {
      throw new Error("Todoist not connected. Please connect your Todoist account first.");
    }

    try {
      // Get project details and associated tasks
      const [projects, tasks] = await Promise.all([
        ctx.runAction(api.todoist.syncApi.getTodoistProjectsSync),
        ctx.runAction(api.todoist.syncApi.getTodoistTasksSync, { projectId })
      ]) as [any[], any[]];

      const project = projects.find((p: any) => p.id === projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Convert tasks to expected format
      const formattedTasks = tasks.map((task: any) => ({
        _id: task.id,
        title: task.content,
        description: task.description || "",
        priority: task.priority || 1,
        dueDate: task.due ? new Date(task.due.datetime || task.due.date).getTime() : undefined,
        isCompleted: task.is_completed,
        labels: task.labels || [],
        createdAt: new Date(task.created_at).getTime(),
        updatedAt: task.updated_at ? new Date(task.updated_at).getTime() : undefined
      }));

      return {
        _id: project.id,
        name: project.name,
        color: project.color,
        description: project.comment || "",
        tasks: formattedTasks,
        taskCount: formattedTasks.length,
        completedTaskCount: formattedTasks.filter((t) => t.isCompleted).length
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch project details: ${error.message}`);
    }
  },
});

export const getTodoistTaskDetails = action({
  args: {
    taskId: v.string(),
  },
  handler: async (ctx, { taskId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check Todoist connection
    const hasConnection = await ctx.runQuery(api.todoist.auth.hasTodoistConnection);
    if (!hasConnection) {
      throw new Error("Todoist not connected. Please connect your Todoist account first.");
    }

    try {
      // Get all tasks and find the specific one
      // Note: Todoist REST API doesn't have a single task endpoint, so we filter from all tasks
      const allTasks = await ctx.runAction(api.todoist.syncApi.getTodoistTasksSync, {}) as any[];
      const task = allTasks.find((t: any) => t.id === taskId);

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // Get project info if task belongs to a project
      let projectInfo = null;
      if (task.project_id) {
        const projects = await ctx.runAction(api.todoist.syncApi.getTodoistProjectsSync) as any[];
        const project = projects.find((p: any) => p.id === task.project_id);
        if (project) {
          projectInfo = {
            _id: project.id,
            name: project.name,
            color: project.color
          };
        }
      }

      // Format task details
      return {
        _id: task.id,
        title: task.content,
        description: task.description || "",
        projectId: task.project_id,
        project: projectInfo,
        priority: task.priority || 1,
        dueDate: task.due ? new Date(task.due.datetime || task.due.date).getTime() : undefined,
        isCompleted: task.is_completed,
        labels: task.labels || [],
        createdAt: new Date(task.created_at).getTime(),
        updatedAt: task.updated_at ? new Date(task.updated_at).getTime() : undefined,
        url: task.url
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch task details: ${error.message}`);
    }
  },
});