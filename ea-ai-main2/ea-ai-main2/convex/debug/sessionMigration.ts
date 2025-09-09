import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";

// Debug function to trigger session timestamp migration
export const triggerSessionTimestampMigration = mutation({
  handler: async (ctx) => {
    // Check if user is authenticated (basic safety)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    console.log("🚀 Triggering session timestamp migration...");
    
    // Run the internal migration
    const result = await ctx.runMutation(internal.migrations.backfillSessionTimestamps.runTimestampMigration, {});
    
    return {
      success: true,
      result,
      message: `Migration completed: ${result.updated}/${result.processed} sessions updated`,
    };
  },
});

// Debug function to check session timestamps
export const debugSessionTimestamps = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Get user's sessions ordered by lastMessageAt
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_time", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .order("desc")
      .collect();
    
    console.log(`📊 Debug: Found ${sessions.length} sessions for user`);
    
    const debugInfo = sessions.map(session => ({
      id: session._id,
      title: session.title,
      createdAt: new Date(session.createdAt).toISOString(),
      lastMessageAt: new Date(session.lastMessageAt).toISOString(),
      messageCount: session.messageCount,
      timeDiff: session.lastMessageAt - session.createdAt,
    }));
    
    return {
      totalSessions: sessions.length,
      sessions: debugInfo,
    };
  },
});