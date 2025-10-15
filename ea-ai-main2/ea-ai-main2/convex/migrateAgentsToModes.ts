// Schema migration script to convert agent fields to mode fields
// Run this script to migrate existing chatSessions from agent-based to mode-based schema

import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Migration action to convert agent fields to mode fields
 * This should be run once after deploying the new schema
 */
export const migrateAgentToModeFields = action({
  args: {},
  handler: async (ctx) => {
    console.log("[Migration] Starting agent to mode field migration...");
    
    // Get all chat sessions that have agent fields but not mode fields
    const sessionsToMigrate = await ctx.runQuery(api.chatSessions.getChatSessionsWithAgentFields);
    
    console.log(`[Migration] Found ${sessionsToMigrate.length} sessions to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const session of sessionsToMigrate) {
      try {
        // Map agent fields to mode fields
        const updates: any = {};
        
        // Convert agentMode to modeType
        if (session.agentMode) {
          updates.modeType = session.agentMode;
        }
        
        // Convert agentName to modeName
        if (session.agentName) {
          updates.modeName = session.agentName;
        }
        
        // Remove old agent fields
        // Note: We can't actually remove fields in Convex, but we can set them to undefined
        // or just leave them as they won't be used anymore
        
        // Update the session
        await ctx.runMutation(api.chatSessions.updateChatSessionFields, {
          sessionId: session._id,
          updates
        });
        
        console.log(`[Migration] Migrated session ${session._id}: ${session.agentMode || 'no agentMode'} -> ${updates.modeType || 'no modeType'}`);
        migratedCount++;
      } catch (error) {
        console.error(`[Migration] Failed to migrate session ${session._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`[Migration] Completed. Migrated: ${migratedCount}, Errors: ${errorCount}`);
    return {
      migrated: migratedCount,
      errors: errorCount
    };
  }
});