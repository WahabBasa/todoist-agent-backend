import { internalMutation } from "./_generated/server";

// One-time cleanup script to remove today's duplicate "New Chat" sessions
// Run this from the Convex dashboard Functions page
export const cleanupDuplicateNewChats = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Starting cleanup of duplicate 'New Chat' sessions...");
    
    // Get today's date range
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
    
    console.log(`Looking for sessions created today: ${new Date(startOfDay).toDateString()}`);
    
    // Get all sessions
    const allSessions = await ctx.db.query("chatSessions").collect();
    
    console.log(`Total sessions in database: ${allSessions.length}`);
    
    // Group sessions by user
    const sessionsByUser = new Map<string, any[]>();
    
    for (const session of allSessions) {
      const userId = session.tokenIdentifier;
      if (!sessionsByUser.has(userId)) {
        sessionsByUser.set(userId, []);
      }
      sessionsByUser.get(userId)!.push(session);
    }
    
    console.log(`Found sessions for ${sessionsByUser.size} users`);
    
    let totalDeleted = 0;
    
    // Process each user's sessions
    for (const [userId, userSessions] of sessionsByUser) {
      console.log(`\n👤 Processing user ${userId.slice(0, 10)}... (${userSessions.length} sessions)`);
      
      // Find today's "New Chat" sessions (non-default)
      const todaysNewChats = userSessions.filter(session => 
        session.createdAt >= startOfDay && 
        session.createdAt <= endOfDay && 
        session.title === "New Chat" && 
        !session.isDefault
      );
      
      if (todaysNewChats.length === 0) {
        console.log(`  ✅ No duplicate "New Chat" sessions found for this user`);
        continue;
      }
      
      console.log(`  🗑️  Found ${todaysNewChats.length} duplicate "New Chat" sessions to delete`);
      
      // Delete these sessions and their conversations
      for (const session of todaysNewChats) {
        // Delete associated conversations first
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        
        for (const conversation of conversations) {
          await ctx.db.delete(conversation._id);
        }
        
        // Delete the session
        await ctx.db.delete(session._id);
        totalDeleted++;
        
        console.log(`    ✅ Deleted session "${session.title}" (${new Date(session.createdAt).toLocaleString()})`);
      }
    }
    
    console.log(`\n🎉 Cleanup completed! Deleted ${totalDeleted} duplicate "New Chat" sessions`);
    return { deletedSessions: totalDeleted };
  },
});