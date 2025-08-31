import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// =================================================================
// STREAMING RESPONSES MANAGEMENT
// Real-time progressive text generation tracking for React + Convex
// =================================================================

/**
 * Create a new streaming response session
 */
export const createStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    userMessage: v.optional(v.string()),
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
    
    await ctx.db.insert("streamingResponses", {
      streamId: args.streamId,
      tokenIdentifier,
      sessionId: args.sessionId,
      partialContent: "",
      isComplete: false,
      status: "streaming",
      userMessage: args.userMessage,
      createdAt: now,
      updatedAt: now,
    });
    
    return { success: true, streamId: args.streamId };
  },
});

/**
 * Update streaming response with new content
 */
export const updateStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    partialContent: v.string(),
    isComplete: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("streaming"), v.literal("complete"), v.literal("error"))),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
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
    
    // Find the streaming response by streamId and ensure it belongs to the user
    const existing = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!existing) {
      throw new Error(`Streaming response not found: ${args.streamId}`);
    }
    
    // Update the streaming response
    await ctx.db.patch(existing._id, {
      partialContent: args.partialContent,
      isComplete: args.isComplete ?? existing.isComplete,
      status: args.status ?? existing.status,
      toolCalls: args.toolCalls ?? existing.toolCalls,
      toolResults: args.toolResults ?? existing.toolResults,
      updatedAt: Date.now(),
    });
    
    return { success: true, updated: true };
  },
});

/**
 * Get streaming response by streamId
 */
export const getStreamingResponse = query({
  args: {
    streamId: v.string(),
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
    
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    return streamingResponse;
  },
});

/**
 * Get active streaming responses for a session
 */
export const getActiveStreamingResponses = query({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
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
    
    return await ctx.db
      .query("streamingResponses")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .filter((q) => q.eq(q.field("status"), "streaming"))
      .collect();
  },
});

/**
 * Complete streaming response and clean up
 */
export const completeStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    finalContent: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
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
    
    // Find the streaming response
    const existing = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!existing) {
      throw new Error(`Streaming response not found: ${args.streamId}`);
    }
    
    // Mark as complete
    await ctx.db.patch(existing._id, {
      partialContent: args.finalContent,
      isComplete: true,
      status: "complete",
      toolCalls: args.toolCalls ?? existing.toolCalls,
      toolResults: args.toolResults ?? existing.toolResults,
      updatedAt: Date.now(),
    });
    
    // Return the completed response for potential conversation saving
    return await ctx.db.get(existing._id);
  },
});

/**
 * Mark streaming response as error
 */
export const markStreamingError = mutation({
  args: {
    streamId: v.string(),
    errorMessage: v.optional(v.string()),
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
    
    const existing = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!existing) {
      throw new Error(`Streaming response not found: ${args.streamId}`);
    }
    
    await ctx.db.patch(existing._id, {
      status: "error",
      partialContent: existing.partialContent + (args.errorMessage ? `\n\nError: ${args.errorMessage}` : ""),
      isComplete: true,
      updatedAt: Date.now(),
    });
    
    return { success: true, error: true };
  },
});

/**
 * Cleanup old completed streaming responses (for maintenance)
 */
export const cleanupOldStreamingResponses = mutation({
  args: {
    olderThanHours: v.optional(v.number()), // Default 24 hours
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
    const cutoffTime = Date.now() - ((args.olderThanHours ?? 24) * 60 * 60 * 1000);
    
    const oldResponses = await ctx.db
      .query("streamingResponses")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => 
        q.and(
          q.or(
            q.eq(q.field("status"), "complete"),
            q.eq(q.field("status"), "error")
          ),
          q.lt(q.field("updatedAt"), cutoffTime)
        )
      )
      .collect();
    
    let deletedCount = 0;
    for (const response of oldResponses) {
      await ctx.db.delete(response._id);
      deletedCount++;
    }
    
    return { success: true, deletedCount };
  },
});