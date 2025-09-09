import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";

// Define return type for migration result
type MigrationResult = {
  processed: number;
  updated: number;
  emptySessions: number;
};

// Define return type for the debug function
type TriggerMigrationResult = {
  success: boolean;
  result: MigrationResult;
  message: string;
};

// Debug function to trigger session timestamp migration
export const triggerSessionTimestampMigration = mutation({
  handler: async (ctx): Promise<TriggerMigrationResult> => {
    // Check if user is authenticated (basic safety)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    console.log("🚀 Triggering session timestamp migration...");
    
    // Run the internal migration
    const result: MigrationResult = await ctx.runMutation(internal.migrations.backfillSessionTimestamps.runTimestampMigration, {});
    
    return {
      success: true,
      result,
      message: `Migration completed: ${result.updated}/${result.processed} sessions updated`,
    };
  },
});

// Define return type for debug session info
type DebugSessionInfo = {
  id: string;
  title?: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount?: number;
  timeDiff: number;
};

type DebugSessionResult = {
  totalSessions: number;
  sessions: DebugSessionInfo[];
};

// Debug function to check session timestamps
export const debugSessionTimestamps = mutation({
  handler: async (ctx): Promise<DebugSessionResult> => {
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