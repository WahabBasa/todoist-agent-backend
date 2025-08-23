import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

// Generate a title from the first user message (Morphic-style)
function generateChatTitle(firstMessage: string): string {
  const words = firstMessage.trim().split(' ');
  const title = words.length > 8 
    ? words.slice(0, 8).join(' ') + '...'
    : firstMessage;
  return title || "New Chat";
}

// Create a new chat session
export const createChatSession = mutation({
  args: {
    title: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      userId,
      title: args.title || "New Chat",
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      isDefault: args.isDefault || false,
    });

    return sessionId;
  },
});

// Get paginated chat sessions for a user (Morphic-style)
export const getChatSessions = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const limit = args.limit || 20;
    const offset = args.offset || 0;

    // Get sessions ordered by last message time
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_time", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Paginate results
    const paginatedSessions = sessions.slice(offset, offset + limit);
    const hasMore = sessions.length > offset + limit;

    return {
      sessions: paginatedSessions,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  },
});

// Get a specific chat session
export const getChatSession = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    return session;
  },
});

// Get or create default chat session for user
export const getOrCreateDefaultSession = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    // Check for existing default session
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_default", (q) => 
        q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (defaultSession) {
      return defaultSession._id;
    }

    // Create default session
    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      userId,
      title: "Default Chat",
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      isDefault: true,
    });

    return sessionId;
  },
});

// Update chat session metadata
export const updateChatSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    title: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    messageCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.lastMessageAt !== undefined) updates.lastMessageAt = args.lastMessageAt;
    if (args.messageCount !== undefined) updates.messageCount = args.messageCount;

    await ctx.db.patch(args.sessionId, updates);
    return true;
  },
});

// Auto-generate title from first message
export const updateChatTitleFromMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    firstMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    // Only update if it's still the default title
    if (session.title === "New Chat" || session.title === "Default Chat") {
      const newTitle = generateChatTitle(args.firstMessage);
      await ctx.db.patch(args.sessionId, { title: newTitle });
    }

    return true;
  },
});

// Delete a chat session and its messages
export const deleteChatSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    // Don't allow deleting default session
    if (session.isDefault) {
      throw new Error("Cannot delete default chat session");
    }

    // Delete all conversations for this session
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);
    return true;
  },
});

// Clear all chat sessions except default
export const clearAllChatSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id;

    // Get all non-default sessions
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isDefault"), true))
      .collect();

    // Delete all conversations and sessions
    for (const session of sessions) {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const conversation of conversations) {
        await ctx.db.delete(conversation._id);
      }

      await ctx.db.delete(session._id);
    }

    // Clear default session messages
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_default", (q) => 
        q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (defaultSession) {
      const defaultConversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", defaultSession._id))
        .collect();

      for (const conversation of defaultConversations) {
        await ctx.db.delete(conversation._id);
      }

      // Reset default session metadata
      await ctx.db.patch(defaultSession._id, {
        lastMessageAt: Date.now(),
        messageCount: 0,
      });
    }

    return { deletedSessions: sessions.length };
  },
});