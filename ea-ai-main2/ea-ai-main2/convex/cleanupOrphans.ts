import { internalMutation } from "./_generated/server";

// Delete all orphaned chatSessions (sessions without valid users)
export const deleteOrphanedChatSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chatSessions = await ctx.db.query("chatSessions").collect();
    const users = await ctx.db.query("users").collect();
    
    // Create a set of valid user IDs for quick lookup
    const validUserIds = new Set(users.map(user => user._id));
    
    let deletedCount = 0;
    
    for (const session of chatSessions) {
      // Check if the session's userId references a valid user
      if (!validUserIds.has(session.userId)) {
        await ctx.db.delete(session._id);
        deletedCount++;
        console.log(`Deleted orphaned chatSession: ${session._id} (title: "${session.title}", userId: ${session.userId})`);
      }
    }
    
    console.log(`Cleanup complete: ${deletedCount} orphaned chatSessions deleted`);
    return { deletedSessions: deletedCount };
  },
});

// Delete ALL chatSessions (nuclear option)
export const deleteAllChatSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chatSessions = await ctx.db.query("chatSessions").collect();
    
    let deletedCount = 0;
    for (const session of chatSessions) {
      await ctx.db.delete(session._id);
      deletedCount++;
      console.log(`Deleted chatSession: ${session._id} (title: "${session.title}")`);
    }
    
    console.log(`Deleted all ${deletedCount} chatSessions`);
    return { deletedSessions: deletedCount };
  },
});

// List orphaned chatSessions for inspection
export const listOrphanedChatSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chatSessions = await ctx.db.query("chatSessions").collect();
    const users = await ctx.db.query("users").collect();
    
    const validUserIds = new Set(users.map(user => user._id));
    const orphanedSessions = chatSessions.filter(session => !validUserIds.has(session.userId));
    
    console.log(`Found ${orphanedSessions.length} orphaned chatSessions out of ${chatSessions.length} total`);
    console.log(`Valid users: ${users.length}`);
    
    for (const session of orphanedSessions) {
      console.log(`- Orphaned: ${session._id} (title: "${session.title}", userId: ${session.userId})`);
    }
    
    return {
      totalSessions: chatSessions.length,
      orphanedSessions: orphanedSessions.length,
      validUsers: users.length,
      orphans: orphanedSessions.map(s => ({
        id: s._id,
        title: s.title,
        userId: s.userId,
        isDefault: s.isDefault
      }))
    };
  },
});