"use node";

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { TodoistClient } from "./todoist";
import { api } from "./_generated/api";

export const storeConversation = mutation({
  args: {
    userId: v.string(),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.object({
      toolName: v.string(),
      args: v.any(),
    }))),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversations", {
      userId: args.userId,
      message: args.message,
      response: args.response,
      timestamp: args.timestamp,
      toolCalls: args.toolCalls,
    });
  },
});

export const createOrUpdateUser = mutation({
  args: {
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (!existingUser) {
      // Create new Firebase user
      await ctx.db.insert("users", {
        firebaseUid: args.firebaseUid,
        email: args.email,
        displayName: args.displayName,
        photoUrl: args.photoUrl,
        preferences: {
          timezone: undefined,
          defaultProject: undefined,
        },
      });
    } else {
      // Update existing Firebase user with latest info
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        photoUrl: args.photoUrl,
      });
    }
  },
});

export const getUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    const userId = identity.subject || identity.tokenIdentifier;
    
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getAllUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    // Only return if authenticated (basic check)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    return await ctx.db.query("users").collect();
  },
});

export const getUserActivitySummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    return await ctx.db
      .query("userActivity")
      .withIndex("by_last_active")
      .order("desc")
      .collect();
  },
});

export const getUserTodayView = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    const userId = identity.subject || identity.tokenIdentifier;
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", userId))
      .first();
    
    return user?.todayViewText || null;
  },
});

export const updateUserActivity = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    toolCallsCount: v.number(),
    modelUsed: v.string(),
    toolsUsed: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const existingActivity = await ctx.db
      .query("userActivity")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Count specific todo operations from tools used
    const todosCreated = args.toolsUsed.filter(tool => tool === 'createTask').length;
    const todosCompleted = args.toolsUsed.filter(tool => tool === 'completeTask').length;
    const todosUpdated = args.toolsUsed.filter(tool => tool === 'updateTask').length;
    const todosDeleted = args.toolsUsed.filter(tool => tool === 'deleteTask').length;

    if (!existingActivity) {
      // Create new activity record
      await ctx.db.insert("userActivity", {
        userId: args.userId,
        displayName: args.displayName,
        email: args.email,
        totalMessages: 1,
        totalToolCalls: args.toolCallsCount,
        lastActiveAt: Date.now(),
        todosCreated,
        todosCompleted,
        todosUpdated,
        todosDeleted,
        preferredModel: args.modelUsed,
        dailyUsage: {
          date: today,
          messageCount: 1,
          toolCallCount: args.toolCallsCount
        }
      });
    } else {
      // Update existing activity record
      const isNewDay = existingActivity.dailyUsage.date !== today;
      
      await ctx.db.patch(existingActivity._id, {
        displayName: args.displayName,
        email: args.email,
        totalMessages: existingActivity.totalMessages + 1,
        totalToolCalls: existingActivity.totalToolCalls + args.toolCallsCount,
        lastActiveAt: Date.now(),
        todosCreated: existingActivity.todosCreated + todosCreated,
        todosCompleted: existingActivity.todosCompleted + todosCompleted,
        todosUpdated: existingActivity.todosUpdated + todosUpdated,
        todosDeleted: existingActivity.todosDeleted + todosDeleted,
        preferredModel: args.modelUsed,
        dailyUsage: {
          date: today,
          messageCount: isNewDay ? 1 : existingActivity.dailyUsage.messageCount + 1,
          toolCallCount: isNewDay ? args.toolCallsCount : existingActivity.dailyUsage.toolCallCount + args.toolCallsCount
        }
      });
    }
  },
});

export const updateUserTodayView = mutation({
  args: {
    userId: v.string(),
    todayViewText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        todayViewText: args.todayViewText,
      });
    }
  },
});