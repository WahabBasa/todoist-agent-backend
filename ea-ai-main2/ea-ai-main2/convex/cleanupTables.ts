import { internalMutation, internalQuery } from "./_generated/server";

// Tables that should exist (defined in schema.ts)
const VALID_TABLES = [
  "chatSessions",
  "conversations", 
  "numbers",
  "todoistTokens",
  "events",
  "schedules",
  "scheduleAvailabilities",
  "meetings"
];

// Tables to be deleted (not in schema.ts)
const TABLES_TO_DELETE = [
  // Legacy Convex Auth tables
  "authAccounts",
  "authRateLimits", 
  "authRefreshTokens",
  "authSessions",
  "authVerificationCodes",
  "authVerifiers",
  // Legacy application tables
  "googleCalendarTokens",
  "labels",
  "memberships",
  "projects", 
  "subTodos",
  "tasks",
  "users"
];

// Delete all data from tables that will be removed
export const deleteExtraTableData = internalMutation({
  handler: async (ctx) => {
    console.log("Starting cleanup of extra tables not in schema...");
    
    const results = [];
    
    for (const tableName of TABLES_TO_DELETE) {
      try {
        console.log(`Clearing table: ${tableName}`);
        
        // Get all documents in the table
        const docs = await ctx.db.query(tableName as any).collect();
        let deletedCount = 0;
        
        // Delete each document
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          deletedCount++;
        }
        
        console.log(`Deleted ${deletedCount} records from ${tableName}`);
        results.push({ table: tableName, deletedCount, success: true });
        
      } catch (error) {
        console.error(`Error clearing table ${tableName}:`, error);
        results.push({ table: tableName, deletedCount: 0, success: false, error: String(error) });
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
      message: "Data deleted from extra tables. Deploy schema to remove table definitions."
    };
  },
});

// Check current table status
export const checkTableStatus = internalQuery({
  handler: async (ctx) => {
    console.log("Checking table status...");
    
    const tableStatus = [];
    
    for (const tableName of TABLES_TO_DELETE) {
      try {
        const docs = await ctx.db.query(tableName as any).collect();
        tableStatus.push({
          table: tableName,
          recordCount: docs.length,
          shouldDelete: true
        });
      } catch (error) {
        tableStatus.push({
          table: tableName,
          recordCount: 0,
          shouldDelete: true,
          error: String(error)
        });
      }
    }
    
    for (const tableName of VALID_TABLES) {
      try {
        const docs = await ctx.db.query(tableName as any).collect();
        tableStatus.push({
          table: tableName,
          recordCount: docs.length,
          shouldDelete: false
        });
      } catch (error) {
        tableStatus.push({
          table: tableName,
          recordCount: 0,
          shouldDelete: false,
          error: String(error)
        });
      }
    }
    
    return {
      validTables: VALID_TABLES,
      tablesToDelete: TABLES_TO_DELETE,
      status: tableStatus
    };
  },
});