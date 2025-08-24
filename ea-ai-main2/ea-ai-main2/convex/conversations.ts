import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper function for consistent authentication (tokenIdentifier pattern)
async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  return identity.tokenIdentifier;
}

// Helper function for optional authentication (tokenIdentifier pattern)
async function getTokenIdentifier(ctx: QueryCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier || null;
}

// Get conversation for specific session (new multi-chat approach)
export const getConversationBySession = query({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    // Big-brain pattern: return null when user not found
    const tokenIdentifier = await getTokenIdentifier(ctx);
    if (!tokenIdentifier) {
      return null;
    }

    if (!args.sessionId) {
      // No session provided, return null (will be handled by frontend)
      return null;
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      return null; // Big-brain pattern: return null instead of throwing
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
      .first();
  },
});

// Legacy function - get default conversation (backward compatibility)
export const getConversation = query({
  args: {},
  handler: async (ctx) => {
    // Big-brain pattern: return null when user not found
    const tokenIdentifier = await getTokenIdentifier(ctx);
    if (!tokenIdentifier) {
      return null;
    }

    // Try to get conversation for default session first
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_tokenIdentifier_and_default", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true))
      .first();

    if (defaultSession) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_tokenIdentifier_and_session", (q) => 
          q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", defaultSession._id))
        .first();
      
      if (conversation) {
        return conversation;
      }
    }

    // Fallback to any conversation by this user
    return await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
  },
});

// Get all conversations for a user
export const getAllConversations = query({
  args: {},
  handler: async (ctx) => {
    const tokenIdentifier = await getTokenIdentifier(ctx);
    if (!tokenIdentifier) {
      return [];
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();
  },
});

// Create or update conversation with messages array (new schema)
export const upsertConversation = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool")),
      content: v.optional(v.string()),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        args: v.any(),
        toolCallId: v.string(),
      }))),
      toolResults: v.optional(v.array(v.object({
        toolCallId: v.string(),
        toolName: v.string(),
        result: v.any(),
      }))),
      timestamp: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Verify session belongs to user if sessionId is provided
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.tokenIdentifier !== tokenIdentifier) {
        throw new ConvexError("Chat session not found or unauthorized");
      }
    }

    // Check if conversation exists for this session
    let conversation = null;
    if (args.sessionId) {
      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_tokenIdentifier_and_session", (q) => 
          q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
        .first();
    } else {
      // Find or create conversation for default session
      const defaultSession = await ctx.db
        .query("chatSessions")
        .withIndex("by_tokenIdentifier_and_default", (q) => 
          q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true))
        .first();

      if (!defaultSession) {
        throw new ConvexError("No default session found");
      }

      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_tokenIdentifier_and_session", (q) => 
          q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", defaultSession._id))
        .first();

      args.sessionId = defaultSession._id;
    }

    if (conversation) {
      // Update existing conversation
      await ctx.db.patch(conversation._id, {
        messages: args.messages,
        schemaVersion: 2,
      });
      return conversation._id;
    } else {
      // Create new conversation
      return await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages: args.messages,
        schemaVersion: 2,
      });
    }
  },
});

// Legacy: Create conversation with message/response (backward compatibility)
export const createConversation = mutation({
  args: {
    message: v.string(),
    response: v.optional(v.string()),
    sessionId: v.optional(v.id("chatSessions")),
    toolCalls: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Verify session belongs to user if sessionId is provided
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.tokenIdentifier !== tokenIdentifier) {
        throw new ConvexError("Chat session not found or unauthorized");
      }
    }

    return await ctx.db.insert("conversations", {
      tokenIdentifier,
      sessionId: args.sessionId,
      message: args.message,
      response: args.response,
      timestamp: Date.now(),
      toolCalls: args.toolCalls,
      schemaVersion: 1, // Legacy schema version
    });
  },
});

// Update conversation response (legacy support)
export const updateConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    response: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Conversation not found or unauthorized");
    }

    const updates: any = {};
    if (args.response !== undefined) updates.response = args.response;
    if (args.toolCalls !== undefined) updates.toolCalls = args.toolCalls;

    await ctx.db.patch(args.conversationId, updates);
    return true;
  },
});

// Delete conversation
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Conversation not found or unauthorized");
    }

    await ctx.db.delete(args.conversationId);
    return true;
  },
});

// Clear all conversations for a user
export const clearAllConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const tokenIdentifier = await requireAuth(ctx);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();

    let deletedCount = 0;
    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
      deletedCount++;
    }

    return { deletedConversations: deletedCount };
  },
});

// Clear conversations for a specific session
export const clearConversationsBySession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
      .collect();

    let deletedCount = 0;
    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
      deletedCount++;
    }

    return { deletedConversations: deletedCount };
  },
});