import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteAllUserData = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    let totalDeleted = 0;

    // Delete all chat sessions for the user and their related data
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();

    for (const session of sessions) {
      // Delete conversations tied to this session
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const c of conversations) {
        await ctx.db.delete(c._id);
        totalDeleted++;
      }

      // Delete any session locks
      try {
        const locks = await ctx.db
          .query("sessionLocks")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const l of locks) {
          await ctx.db.delete(l._id);
          totalDeleted++;
        }
      } catch (_) {
        // sessionLocks table may not exist; ignore
      }

      // Delete the session itself
      await ctx.db.delete(session._id);
      totalDeleted++;
    }

    // Delete any conversations that may not be attached to a session but belong to the user
    try {
      const orphanConversations = await ctx.db
        .query("conversations")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
        .collect();
      for (const c of orphanConversations) {
        await ctx.db.delete(c._id);
        totalDeleted++;
      }
    } catch (_) {
      // conversations index variations may differ; ignore if unavailable
    }

    // Tables with a by_tokenIdentifier index
    const tablesByToken = [
      "aiInternalTodos",
      "customSystemPrompts",
      "userProfiles",
      "systemConfig",
      "usageEvents",
      "usageQuotas",
      "todoistTokens",
      "googleCalendarTokens",
      "googleCalendarSettings",
    ] as const;

    for (const table of tablesByToken) {
      try {
        const docs = await ctx.db
          .query(table as any)
          .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
          .collect();
        for (const d of docs) {
          await ctx.db.delete(d._id);
          totalDeleted++;
        }
      } catch (_) {
        // Some tables may not be present depending on deployment/migrations; ignore
      }
    }

    return { success: true, deletedCount: totalDeleted };
  },
});

