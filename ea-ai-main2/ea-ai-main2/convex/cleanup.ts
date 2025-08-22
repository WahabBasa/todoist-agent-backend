import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const clearOldConversations = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all conversations to fix schema issues
    const conversations = await ctx.db.query("conversations").collect();
    
    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
    }
    
    return `Deleted ${conversations.length} old conversation records`;
  },
});

export const deleteLegacyUser = mutation({
  args: { 
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Get the user record first
    const user = await ctx.db.get(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Delete associated conversations first
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
      
    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
    }
    
    // Delete associated chat sessions
    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
      
    for (const session of chatSessions) {
      await ctx.db.delete(session._id);
    }
    
    // Finally delete the user record
    await ctx.db.delete(userId);
    
    return `Successfully deleted legacy user and ${conversations.length} conversations, ${chatSessions.length} chat sessions`;
  },
});