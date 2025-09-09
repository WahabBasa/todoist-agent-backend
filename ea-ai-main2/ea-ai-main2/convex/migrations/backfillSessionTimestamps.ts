import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

// Define return type for migration result
type MigrationResult = {
  processed: number;
  updated: number;
  emptySessions: number;
};

// Migration: Backfill lastMessageAt for existing sessions based on their conversations
export const backfillSessionTimestamps = internalMutation({
  handler: async (ctx): Promise<MigrationResult> => {
    console.log("🔄 Starting session timestamp backfill migration...");
    
    // Get all sessions
    const allSessions = await ctx.db.query("chatSessions").collect();
    console.log(`Found ${allSessions.length} sessions to process`);
    
    let updatedCount = 0;
    let sessionsWithoutConversations = 0;
    
    for (const session of allSessions) {
      try {
        // Get all conversations for this session
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        
        if (conversations.length === 0) {
          sessionsWithoutConversations++;
          // Session has no conversations - use createdAt as lastMessageAt
          if (session.lastMessageAt !== session.createdAt) {
            await ctx.db.patch(session._id, {
              lastMessageAt: session.createdAt,
              messageCount: 0,
            });
            updatedCount++;
          }
          continue;
        }
        
        // Find the most recent conversation timestamp
        let mostRecentTimestamp = session.createdAt;
        let totalMessageCount = 0;
        
        for (const conversation of conversations) {
          // Count messages in this conversation
          if (conversation.messages && conversation.messages.length > 0) {
            totalMessageCount += conversation.messages.length;
            // Find most recent message timestamp
            const latestMessage = conversation.messages
              .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
            if (latestMessage && latestMessage.timestamp > mostRecentTimestamp) {
              mostRecentTimestamp = latestMessage.timestamp;
            }
          } else if (conversation.timestamp) {
            // Legacy format - count as 2 messages (user + assistant) if response exists
            totalMessageCount += conversation.response ? 2 : 1;
            if (conversation.timestamp > mostRecentTimestamp) {
              mostRecentTimestamp = conversation.timestamp;
            }
          }
        }
        
        // Update session if timestamp is different
        if (session.lastMessageAt !== mostRecentTimestamp || session.messageCount !== totalMessageCount) {
          await ctx.db.patch(session._id, {
            lastMessageAt: mostRecentTimestamp,
            messageCount: totalMessageCount,
          });
          updatedCount++;
          
          console.log(`Updated session ${session._id}: ${new Date(session.lastMessageAt).toISOString()} → ${new Date(mostRecentTimestamp).toISOString()}`);
        }
        
      } catch (error) {
        console.error(`Error processing session ${session._id}:`, error);
      }
    }
    
    console.log(`✅ Migration complete:`);
    console.log(`  - Processed: ${allSessions.length} sessions`);
    console.log(`  - Updated: ${updatedCount} sessions`);  
    console.log(`  - Empty sessions: ${sessionsWithoutConversations} sessions`);
    
    return {
      processed: allSessions.length,
      updated: updatedCount,
      emptySessions: sessionsWithoutConversations,
    };
  },
});

// Helper function to run the migration (can be called from frontend)
export const runTimestampMigration = internalMutation({
  handler: async (ctx): Promise<MigrationResult> => {
    return await ctx.runMutation(internal.migrations.backfillSessionTimestamps.backfillSessionTimestamps, {});
  },
});