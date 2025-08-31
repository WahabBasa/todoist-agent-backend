import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// =================================================================
// CONVEX-NATIVE STREAMING RESPONSES
// Single document progressive updates with built-in reactivity
// Replaces complex event system with simple document patches
// =================================================================

/**
 * Create a new streaming response document
 * This initializes the streaming session
 */
export const createStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    userMessage: v.string(),
    modelName: v.optional(v.string()),
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
    
    const responseId = await ctx.db.insert("streamingResponses", {
      streamId: args.streamId,
      tokenIdentifier,
      sessionId: args.sessionId,
      content: "", // Start empty
      isComplete: false,
      status: "streaming",
      userMessage: args.userMessage,
      modelName: args.modelName,
      toolExecutions: [],
      createdAt: now,
      updatedAt: now,
    });
    
    return { responseId, streamId: args.streamId };
  },
});

/**
 * Update streaming content progressively
 * This is called repeatedly as AI generates text
 */
export const updateStreamingContent = mutation({
  args: {
    streamId: v.string(),
    textDelta: v.string(), // New text to append
    totalTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Find the streaming response
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!streamingResponse) {
      throw new ConvexError("Streaming response not found");
    }
    
    if (streamingResponse.isComplete) {
      console.warn(`Attempt to update completed stream ${args.streamId}`);
      return { success: false, reason: "Stream already completed" };
    }
    
    // Progressive update using ctx.db.patch - Convex handles reactivity
    await ctx.db.patch(streamingResponse._id, {
      content: streamingResponse.content + args.textDelta,
      updatedAt: Date.now(),
      ...(args.totalTokens && { totalTokens: args.totalTokens }),
    });
    
    return { success: true, contentLength: streamingResponse.content.length + args.textDelta.length };
  },
});

/**
 * Add or update tool execution in the streaming response
 */
export const updateToolExecution = mutation({
  args: {
    streamId: v.string(),
    toolCallId: v.string(),
    toolName: v.string(),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("error")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Find the streaming response
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!streamingResponse) {
      throw new ConvexError("Streaming response not found");
    }
    
    // Find or create tool execution entry
    const toolExecutions = streamingResponse.toolExecutions || [];
    const existingIndex = toolExecutions.findIndex(
      (tool) => tool.toolCallId === args.toolCallId
    );
    
    const toolExecution = {
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      input: args.input,
      output: args.output,
      status: args.status,
      startTime: args.startTime,
      endTime: args.endTime,
    };
    
    if (existingIndex >= 0) {
      // Update existing tool execution
      toolExecutions[existingIndex] = {
        ...toolExecutions[existingIndex],
        ...toolExecution,
      };
    } else {
      // Add new tool execution
      toolExecutions.push(toolExecution);
    }
    
    // Update document with new tool executions
    await ctx.db.patch(streamingResponse._id, {
      toolExecutions,
      updatedAt: Date.now(),
    });
    
    return { success: true, toolExecutionsCount: toolExecutions.length };
  },
});

/**
 * Mark streaming response as complete
 */
export const completeStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    finalContent: v.optional(v.string()),
    totalTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Find the streaming response
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!streamingResponse) {
      throw new ConvexError("Streaming response not found");
    }
    
    // Mark as complete
    await ctx.db.patch(streamingResponse._id, {
      isComplete: true,
      status: "complete",
      ...(args.finalContent && { content: args.finalContent }),
      ...(args.totalTokens && { totalTokens: args.totalTokens }),
      updatedAt: Date.now(),
    });
    
    return { success: true, streamId: args.streamId };
  },
});

/**
 * Mark streaming response as error
 */
export const errorStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Find the streaming response
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!streamingResponse) {
      throw new ConvexError("Streaming response not found");
    }
    
    // Mark as error
    await ctx.db.patch(streamingResponse._id, {
      isComplete: true,
      status: "error",
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
    
    return { success: true, streamId: args.streamId };
  },
});

/**
 * Get streaming response by streamId
 * This is used by the frontend for real-time subscriptions
 */
export const getStreamingResponse = query({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Allow unauthenticated reads to return null
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      return null;
    }
    
    return await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
  },
});

/**
 * Get active streaming responses for a user
 */
export const getActiveStreams = query({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      return [];
    }
    
    let query = ctx.db
      .query("streamingResponses")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("isComplete"), false));
    
    if (args.sessionId) {
      query = query.filter((q) => q.eq(q.field("sessionId"), args.sessionId));
    }
    
    return await query.collect();
  },
});

/**
 * Clean up old completed streaming responses
 * This prevents the database from growing indefinitely
 */
export const cleanupOldStreams = mutation({
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
    
    // Find completed streams older than cutoff
    const oldStreams = await ctx.db
      .query("streamingResponses")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", cutoffTime))
      .filter((q) => 
        q.and(
          q.eq(q.field("tokenIdentifier"), tokenIdentifier),
          q.eq(q.field("isComplete"), true)
        )
      )
      .collect();
    
    let deletedCount = 0;
    
    for (const stream of oldStreams) {
      await ctx.db.delete(stream._id);
      deletedCount++;
    }
    
    return { 
      success: true, 
      deletedStreams: deletedCount 
    };
  },
});