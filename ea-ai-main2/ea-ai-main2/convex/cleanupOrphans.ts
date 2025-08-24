import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Delete old chatSessions (older than specified days)
export const deleteOldChatSessions = internalMutation({
  args: {
    olderThanDays: v.optional(v.number()), // Default to 30 days
  },
  handler: async (ctx, args) => {
    const olderThanDays = args.olderThanDays || 30;
    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const chatSessions = await ctx.db.query("chatSessions").collect();
    
    let deletedCount = 0;
    
    for (const session of chatSessions) {
      // Don't delete default sessions unless they're very old (>90 days)
      const isVeryOld = session.lastMessageAt < (Date.now() - (90 * 24 * 60 * 60 * 1000));
      const shouldDelete = session.lastMessageAt < cutoffDate && (!session.isDefault || isVeryOld);
      
      if (shouldDelete) {
        // Delete associated conversations first
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        
        for (const conversation of conversations) {
          await ctx.db.delete(conversation._id);
        }
        
        await ctx.db.delete(session._id);
        deletedCount++;
        console.log(`Deleted old chatSession: ${session._id} (title: "${session.title}", tokenIdentifier: ${session.tokenIdentifier}, lastMessageAt: ${new Date(session.lastMessageAt).toISOString()})`);
      }
    }
    
    console.log(`Cleanup complete: ${deletedCount} old chatSessions deleted (older than ${olderThanDays} days)`);
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
      // Delete associated conversations first
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      
      for (const conversation of conversations) {
        await ctx.db.delete(conversation._id);
      }
      
      await ctx.db.delete(session._id);
      deletedCount++;
      console.log(`Deleted chatSession: ${session._id} (title: "${session.title}")`);
    }
    
    console.log(`Deleted all ${deletedCount} chatSessions`);
    return { deletedSessions: deletedCount };
  },
});

// Delete empty chatSessions (sessions with no conversations)
export const deleteEmptyChatSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chatSessions = await ctx.db.query("chatSessions").collect();
    
    let deletedCount = 0;
    
    for (const session of chatSessions) {
      // Skip default sessions
      if (session.isDefault) {
        continue;
      }
      
      // Check if session has any conversations
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      
      if (conversations.length === 0 && session.messageCount === 0) {
        await ctx.db.delete(session._id);
        deletedCount++;
        console.log(`Deleted empty chatSession: ${session._id} (title: "${session.title}", tokenIdentifier: ${session.tokenIdentifier})`);
      }
    }
    
    console.log(`Cleanup complete: ${deletedCount} empty chatSessions deleted`);
    return { deletedSessions: deletedCount };
  },
});

// List sessions statistics for inspection
export const listSessionsStatistics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chatSessions = await ctx.db.query("chatSessions").collect();
    const conversations = await ctx.db.query("conversations").collect();
    
    // Group by tokenIdentifier
    const userStats = new Map();
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    for (const session of chatSessions) {
      const tokenId = session.tokenIdentifier;
      if (!userStats.has(tokenId)) {
        userStats.set(tokenId, {
          tokenIdentifier: tokenId,
          totalSessions: 0,
          defaultSessions: 0,
          recentSessions: 0,
          oldSessions: 0,
        });
      }
      
      const stats = userStats.get(tokenId);
      stats.totalSessions++;
      if (session.isDefault) stats.defaultSessions++;
      if (session.lastMessageAt > thirtyDaysAgo) {
        stats.recentSessions++;
      } else {
        stats.oldSessions++;
      }
    }
    
    const userStatsList = Array.from(userStats.values());
    
    console.log(`\n=== Session Statistics ===`);
    console.log(`Total sessions: ${chatSessions.length}`);
    console.log(`Total conversations: ${conversations.length}`);
    console.log(`Unique users: ${userStatsList.length}`);
    console.log(`Recent sessions (last 30 days): ${userStatsList.reduce((sum, u) => sum + u.recentSessions, 0)}`);
    console.log(`Old sessions (>30 days): ${userStatsList.reduce((sum, u) => sum + u.oldSessions, 0)}`);
    
    for (const userStat of userStatsList.slice(0, 10)) { // Show first 10 users
      console.log(`- User ${userStat.tokenIdentifier.split('|')[1] || 'unknown'}: ${userStat.totalSessions} sessions (${userStat.recentSessions} recent, ${userStat.oldSessions} old, ${userStat.defaultSessions} default)`);
    }
    
    return {
      totalSessions: chatSessions.length,
      totalConversations: conversations.length,
      uniqueUsers: userStatsList.length,
      recentSessions: userStatsList.reduce((sum, u) => sum + u.recentSessions, 0),
      oldSessions: userStatsList.reduce((sum, u) => sum + u.oldSessions, 0),
      userStats: userStatsList,
    };
  },
});