import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Basic health check query
export const healthCheck = query({
  handler: async () => {
    return { status: "ok", timestamp: Date.now() };
  },
});

// Get current user info with display name
export const getCurrentUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    return user;
  },
});

// Get dashboard stats for the user
export const getDashboardStats = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.isCompleted).length,
      totalProjects: projects.length,
      todayTasks: tasks.filter(task => {
        if (!task.dueDate) return false;
        const today = new Date();
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === today.toDateString();
      }).length,
    };
  },
});
