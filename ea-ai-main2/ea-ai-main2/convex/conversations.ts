import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getConversation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const addMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      args: v.optional(v.any()),
      result: v.any(),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      toolCalls: args.toolCalls,
    };

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, {
        messages: [...existingConversation.messages, message],
      });
      return existingConversation._id;
    } else {
      return await ctx.db.insert("conversations", {
        userId,
        messages: [message],
      });
    }
  },
});

export const updateConversation = mutation({
  args: {
    // This validator now correctly matches the updated schema
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool")),
      content: v.any(),
      timestamp: v.number(),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        args: v.optional(v.any()),
        result: v.any(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, { messages: args.messages });
    } else {
      await ctx.db.insert("conversations", { userId, messages: args.messages });
    }
  },
});


export const clearConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (conversation) {
      await ctx.db.delete(conversation._id);
    }

    return true;
  },
});

export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!conversation) {
      return [];
    }

    const messages = conversation.messages;
    
    if (args.limit && args.limit > 0) {
      return messages.slice(-args.limit);
    }

    return messages;
  },
});