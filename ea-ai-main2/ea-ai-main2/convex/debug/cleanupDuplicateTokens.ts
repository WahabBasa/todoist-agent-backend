import { mutation } from "../_generated/server";
import { v } from "convex/values";

// One-time cleanup function to remove duplicate tokenIdentifier records
export const cleanupDuplicateTodoistTokens = mutation({
  handler: async (ctx) => {
    console.log("🧹 Starting cleanup of duplicate Todoist tokens...");
    
    // Get all tokens
    const allTokens = await ctx.db.query("todoistTokens").collect();
    console.log(`Found ${allTokens.length} total tokens`);
    
    // Group by base URL (without the user part)
    const tokensByBaseUrl = new Map<string, typeof allTokens>();
    
    for (const token of allTokens) {
      const baseUrl = token.tokenIdentifier.split('|')[0];
      if (!tokensByBaseUrl.has(baseUrl)) {
        tokensByBaseUrl.set(baseUrl, []);
      }
      tokensByBaseUrl.get(baseUrl)!.push(token);
    }
    
    let deletedCount = 0;
    let keptCount = 0;
    
    // For each base URL, keep the most recent full tokenIdentifier and delete others
    for (const [baseUrl, tokens] of tokensByBaseUrl.entries()) {
      if (tokens.length > 1) {
        console.log(`🔍 Found ${tokens.length} tokens for base URL: ${baseUrl}`);
        
        // Sort by creation time (newest first) and prefer full tokenIdentifier format
        tokens.sort((a, b) => {
          // First, prefer tokens that have the full format (longer tokenIdentifier)
          const aIsFull = a.tokenIdentifier.length > baseUrl.length + 10;
          const bIsFull = b.tokenIdentifier.length > baseUrl.length + 10;
          
          if (aIsFull && !bIsFull) return -1;
          if (!aIsFull && bIsFull) return 1;
          
          // Then sort by creation time (newest first)
          return b._creationTime - a._creationTime;
        });
        
        // Keep the first token (most recent + full format preferred)
        const tokenToKeep = tokens[0];
        console.log(`✅ Keeping token: ${tokenToKeep.tokenIdentifier} (${tokenToKeep._creationTime})`);
        keptCount++;
        
        // Delete the rest
        for (let i = 1; i < tokens.length; i++) {
          const tokenToDelete = tokens[i];
          console.log(`❌ Deleting token: ${tokenToDelete.tokenIdentifier} (${tokenToDelete._creationTime})`);
          await ctx.db.delete(tokenToDelete._id);
          deletedCount++;
        }
      } else {
        console.log(`✅ Single token for ${baseUrl}: ${tokens[0].tokenIdentifier}`);
        keptCount++;
      }
    }
    
    console.log(`🧹 Cleanup complete: Kept ${keptCount} tokens, deleted ${deletedCount} duplicates`);
    
    // Return final state
    const finalTokens = await ctx.db.query("todoistTokens").collect();
    return {
      success: true,
      before: allTokens.length,
      after: finalTokens.length,
      deleted: deletedCount,
      kept: keptCount,
      finalTokens: finalTokens.map(t => ({
        id: t._id,
        tokenIdentifier: t.tokenIdentifier,
        creationTime: t._creationTime
      }))
    };
  },
});