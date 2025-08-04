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

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return conversation;
  },
});

export const addMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      args: v.any(),
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
      const updatedMessages = [...existingConversation.messages, message];
      await ctx.db.patch(existingConversation._id, {
        messages: updatedMessages,
      });
      return existingConversation._id;
    } else {
      const conversationId = await ctx.db.insert("conversations", {
        userId,
        messages: [message],
      });
      return conversationId;
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
      await ctx.db.patch(conversation._id, { messages: [] });
    }
  },
});
