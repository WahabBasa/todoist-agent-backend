// Simple data clearing script for development
// Run this to clear all chat sessions and start fresh with the new schema

import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Clear all chat sessions for development
 * WARNING: This will delete all chat data
 */
export const clearAllDataForDevelopment = action({
  args: {},
  handler: async (ctx) => {
    console.log("[Development] Clearing all chat sessions...");
    
    try {
      // Get all chat sessions
      const sessions = await ctx.db.query("chatSessions").collect();
      
      console.log(`[Development] Found ${sessions.length} sessions to delete`);
      
      // Delete all sessions
      for (const session of sessions) {
        // First delete associated conversations
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
          
        for (const conversation of conversations) {
          await ctx.db.delete(conversation._id);
        }
        
        // Then delete the session
        await ctx.db.delete(session._id);
      }
      
      console.log("[Development] All chat sessions cleared successfully");
      
      // Also clear AI internal todos
      const todos = await ctx.db.query("aiInternalTodos").collect();
      console.log(`[Development] Found ${todos.length} todo lists to delete`);
      
      for (const todo of todos) {
        await ctx.db.delete(todo._id);
      }
      
      console.log("[Development] All internal todos cleared successfully");
      
      return {
        success: true,
        deletedSessions: sessions.length,
        deletedTodos: todos.length
      };
    } catch (error) {
      console.error("[Development] Error clearing data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});