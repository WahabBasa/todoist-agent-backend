import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

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
    agentMode: v.optional(v.union(v.literal("primary"), v.literal("subagent"), v.literal("all"))),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      tokenIdentifier,
      title: args.title || "New Chat",
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      isDefault: args.isDefault || false,
      // Agent system fields
      agentMode: args.agentMode || "primary",
      agentName: args.agentName || "primary",
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
    // Big-brain pattern: return undefined when no user identity
    const tokenIdentifier = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
    if (!tokenIdentifier) {
      return undefined;
    }

    const limit = args.limit || 20;
    const offset = args.offset || 0;

    // ChatHub pattern: Get ALL sessions ordered by lastMessageAt DESC (most recent first)
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_time", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .order("desc")
      .collect();

    // Debug: Log session count to understand missing history issue
    console.log(`[getChatSessions] Found ${sessions.length} sessions for user ${tokenIdentifier.slice(0, 10)}...`);
    
    // For now, return all sessions to match ChatHub behavior (no artificial limits)
    // TODO: Add proper database-level pagination later if needed
    return {
      sessions: sessions,
      hasMore: false,
      nextOffset: null,
    };
  },
});

// Get a specific chat session
export const getChatSession = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    // Big-brain pattern: return null when no user identity
    const tokenIdentifier = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
    if (!tokenIdentifier) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      return null;
    }

    return session;
  },
});

// Get default chat session for user (Query - big-brain pattern)
export const getDefaultSession = query({
  args: {},
  handler: async (ctx) => {
    // Big-brain pattern: return null when no user identity
    const tokenIdentifier = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
    if (!tokenIdentifier) {
      return null;
    }

    // Check for existing default session
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_default", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true))
      .first();

    return defaultSession || null;
  },
});

// Create default chat session for user (Mutation - called intentionally)
export const createDefaultSession = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    // Check if default session already exists
    const existingDefaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_default", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true))
      .first();

    if (existingDefaultSession) {
      return existingDefaultSession._id;
    }

    // Create default session
    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      tokenIdentifier,
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
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.lastMessageAt !== undefined) updates.lastMessageAt = args.lastMessageAt;
    if (args.messageCount !== undefined) updates.messageCount = args.messageCount;
    if (args.agentName !== undefined) updates.agentName = args.agentName;

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    // Only update if it's still the default title
    if (session.title === "New Chat" || session.title === "Default Chat") {
      const newTitle = generateChatTitle(args.firstMessage);
      await ctx.db.patch(args.sessionId, { 
        title: newTitle,
        lastMessageAt: Date.now(), // Also update timestamp
      });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    const session = await ctx.db.get(args.sessionId);
    
    // ChatHub pattern: Idempotent operations like local storage filter()
    if (!session) {
      // Session already deleted or never existed - succeed silently like filter() would
      return { success: true, alreadyDeleted: true };
    }
    
    // Still check authorization for existing sessions
    if (session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    // Don't allow deleting default session
    if (session.isDefault) {
      throw new ConvexError("Cannot delete default chat session");
    }

    // Delete all conversations for this session (optimized batch deletion)
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Use Promise.all for parallel deletion within the same transaction
    await Promise.all(
      conversations.map(conversation => ctx.db.delete(conversation._id))
    );

    // Delete the session
    await ctx.db.delete(args.sessionId);
    return { success: true, deleted: true };
  },
});

// Clear all chat sessions except default
export const clearAllChatSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    // Get all non-default sessions
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.neq(q.field("isDefault"), true))
      .collect();

    // Delete all conversations and sessions (optimized batch deletion)
    // Collect all conversations and sessions to delete first
    const allConversationsToDelete = [];
    for (const session of sessions) {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      allConversationsToDelete.push(...conversations);
    }

    // Batch delete all conversations and sessions in parallel
    await Promise.all([
      ...allConversationsToDelete.map(conversation => ctx.db.delete(conversation._id)),
      ...sessions.map(session => ctx.db.delete(session._id))
    ]);

    // Clear default session messages
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_default", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true))
      .first();

    if (defaultSession) {
      const defaultConversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", defaultSession._id))
        .collect();

      // Batch delete default session conversations
      await Promise.all(
        defaultConversations.map(conversation => ctx.db.delete(conversation._id))
      );

      // Reset default session metadata
      await ctx.db.patch(defaultSession._id, {
        lastMessageAt: Date.now(),
        messageCount: 0,
      });
    }

    return { deletedSessions: sessions.length };
  },
});

// Internal function to delete ALL chat sessions (no auth required - for cleanup)
export const forceDeleteAllChatSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("chatSessions").collect();
    
    let deletedCount = 0;
    for (const session of sessions) {
      await ctx.db.delete(session._id);
      deletedCount++;
      console.log(`Deleted chatSession: ${session._id} (title: "${session.title}", tokenIdentifier: ${session.tokenIdentifier})`);
    }
    
    console.log(`Force deleted all ${deletedCount} chatSessions`);
    return { deletedSessions: deletedCount };
  },
});

// Public cleanup function to remove today's "New Chat" sessions (keeps default sessions)  
export const cleanupTodaysNewChats = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    // Get today's date range (start and end of day)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
    
    console.log(`Cleaning up "New Chat" sessions for user ${tokenIdentifier.slice(0, 10)}... created today (${new Date(startOfDay).toDateString()})`);
    
    // Find all sessions created today with title "New Chat" (not default sessions) for this user only
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();
    
    const toDelete = sessions.filter(session => 
      session.createdAt >= startOfDay && 
      session.createdAt <= endOfDay && 
      session.title === "New Chat" && 
      !session.isDefault
    );
    
    console.log(`Found ${toDelete.length} "New Chat" sessions to delete from today`);
    
    let deletedCount = 0;
    for (const session of toDelete) {
      // Also delete associated conversations
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      
      // Delete conversations first
      for (const conversation of conversations) {
        await ctx.db.delete(conversation._id);
      }
      
      // Delete the session
      await ctx.db.delete(session._id);
      deletedCount++;
      console.log(`Deleted "New Chat" session: ${session._id} (created: ${new Date(session.createdAt).toLocaleString()})`);
    }
    
    console.log(`Successfully cleaned up ${deletedCount} "New Chat" sessions from today`);
    return { deletedSessions: deletedCount };
  },
});

// Create child session for agent delegation
export const createChildSession = mutation({
  args: {
    tokenIdentifier: v.string(),
    parentSessionId: v.id("chatSessions"),
    title: v.string(),
    agentMode: v.union(v.literal("primary"), v.literal("subagent"), v.literal("all")),
    agentName: v.string(),
    delegationContext: v.object({
      delegatedTask: v.string(),
      createdAt: v.number(),
      status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
      agentName: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // Verify parent session exists and belongs to user
    const parentSession = await ctx.db.get(args.parentSessionId);
    if (!parentSession || parentSession.tokenIdentifier !== args.tokenIdentifier) {
      throw new ConvexError("Parent session not found or unauthorized");
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      tokenIdentifier: args.tokenIdentifier,
      title: args.title,
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      isDefault: false,
      // Agent system fields
      agentMode: args.agentMode,
      agentName: args.agentName,
      // Session hierarchy
      parentSessionId: args.parentSessionId,
      delegationContext: args.delegationContext,
    });

    return {
      sessionId,
      parentSessionId: args.parentSessionId,
    };
  },
});

// Update delegation status for a child session
export const updateDelegationStatus = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Session not found or unauthorized");
    }

    if (!session.delegationContext) {
      throw new ConvexError("Session is not a delegated task session");
    }

    await ctx.db.patch(args.sessionId, {
      delegationContext: {
        ...session.delegationContext,
        status: args.status,
      },
      lastMessageAt: Date.now(),
    });

    return true;
  },
});

// Get child sessions for a parent session
export const getChildSessions = query({
  args: {
    parentSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
    if (!tokenIdentifier) {
      return [];
    }

    // Verify parent session exists and belongs to user
    const parentSession = await ctx.db.get(args.parentSessionId);
    if (!parentSession || parentSession.tokenIdentifier !== tokenIdentifier) {
      return [];
    }

    const childSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_parent_session", (q) => q.eq("parentSessionId", args.parentSessionId))
      .collect();

    return childSessions;
  },
});