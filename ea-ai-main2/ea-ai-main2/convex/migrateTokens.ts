import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// SAFE Migration: Delete legacy records and let users re-authenticate
// This is the safest approach since we can't map old Convex userId to Clerk tokenIdentifier
export const migrateTodoistTokensSafe = internalMutation({
  handler: async (ctx) => {
    console.log("Starting SAFE todoistTokens migration: removing legacy records...");

    // Get all todoistTokens records
    const allTokens = await ctx.db.query("todoistTokens").collect();
    console.log(`Found ${allTokens.length} total records`);
    
    let deletedCount = 0;
    let keptCount = 0;
    let errors = 0;

    for (const token of allTokens) {
      try {
        // Check if record has legacy userId field (schema violation)
        const hasLegacyUserId = 'userId' in token;
        const hasValidTokenIdentifier = 'tokenIdentifier' in token && token.tokenIdentifier;
        
        if (hasLegacyUserId) {
          console.log(`Deleting legacy record ${token._id} with userId: ${(token as any).userId}`);
          await ctx.db.delete(token._id);
          deletedCount++;
        } else if (hasValidTokenIdentifier) {
          console.log(`Keeping valid record ${token._id} with tokenIdentifier`);
          keptCount++;
        } else {
          console.log(`Deleting invalid record ${token._id} - no valid identifier`);
          await ctx.db.delete(token._id);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing record ${token._id}:`, error);
        errors++;
      }
    }

    console.log(`Migration completed: ${deletedCount} deleted, ${keptCount} kept, ${errors} errors`);
    return { 
      deletedCount, 
      keptCount, 
      errors,
      totalRecords: allTokens.length,
      success: errors === 0,
      message: "Users with deleted tokens will need to re-authenticate with Todoist"
    };
  },
});

// Alternative: Migration with user mapping (if we have the data)
export const migrateTodoistTokensWithMapping = internalMutation({
  args: {
    mapping: v.array(v.object({
      userId: v.string(),
      tokenIdentifier: v.string()
    }))
  },
  handler: async (ctx, { mapping }) => {
    console.log("Starting todoistTokens migration with user mapping...");
    
    // Create lookup map
    const userMap = new Map<string, string>();
    for (const entry of mapping) {
      userMap.set(entry.userId, entry.tokenIdentifier);
    }
    
    const allTokens = await ctx.db.query("todoistTokens").collect();
    let migratedCount = 0;
    let deletedCount = 0;
    let errors = 0;

    for (const token of allTokens) {
      try {
        const hasUserId = 'userId' in token;
        
        if (hasUserId) {
          const legacyUserId = (token as any).userId;
          const newTokenIdentifier = userMap.get(legacyUserId);
          
          if (newTokenIdentifier) {
            // Replace record with correct schema
            const newTokenData = {
              tokenIdentifier: newTokenIdentifier,
              accessToken: token.accessToken,
              createdAt: token.createdAt,
              updatedAt: token.updatedAt,
            };
            
            await ctx.db.delete(token._id);
            await ctx.db.insert("todoistTokens", newTokenData);
            migratedCount++;
          } else {
            console.log(`No mapping found for userId ${legacyUserId}, deleting record`);
            await ctx.db.delete(token._id);
            deletedCount++;
          }
        }
      } catch (error) {
        console.error(`Error migrating record ${token._id}:`, error);
        errors++;
      }
    }

    return { migratedCount, deletedCount, errors, success: errors === 0 };
  },
});

// Helper to check current state of todoistTokens
export const checkTodoistTokensState = internalQuery({
  handler: async (ctx) => {
    const allTokens = await ctx.db.query("todoistTokens").collect();
    
    const summary = {
      totalRecords: allTokens.length,
      withTokenIdentifier: 0,
      withUserId: 0,
      records: [] as any[]
    };

    for (const token of allTokens) {
      const record = {
        id: token._id,
        hasTokenIdentifier: !!(token as any).tokenIdentifier,
        hasUserId: !!(token as any).userId,
        tokenIdentifier: (token as any).tokenIdentifier || null,
        userId: (token as any).userId || null,
        createdAt: token.createdAt,
      };
      
      summary.records.push(record);
      
      if ((token as any).tokenIdentifier) summary.withTokenIdentifier++;
      if ((token as any).userId) summary.withUserId++;
    }

    return summary;
  },
});