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
 * Simplified version following working mutation patterns
 */
export const createStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    userMessage: v.string(),
    modelName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Simple auth check following working pattern
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }

    // Basic parameter validation
    if (!args.streamId || !args.userMessage) {
      throw new ConvexError("StreamId and userMessage are required");
    }

    const now = Date.now();
    
    // Clean database insert
    const responseId = await ctx.db.insert("streamingResponses", {
      streamId: args.streamId,
      tokenIdentifier,
      sessionId: args.sessionId,
      content: "",
      isComplete: false,
      status: "streaming" as const,
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
    console.log('[STREAMING_ERROR] Starting errorStreamingResponse', {
      streamId: args.streamId?.substring(0, 20) + '...',
      errorMessage: args.errorMessage?.substring(0, 100) + '...',
      timestamp: Date.now()
    });
    
    try {
      console.log('[STREAMING_ERROR] Getting user identity...');
      
      // Use defensive auth pattern matching createStreamingResponse
      let identity;
      try {
        identity = await ctx.auth.getUserIdentity();
      } catch (authError) {
        console.error('[STREAMING_ERROR] Error getting user identity:', authError);
        throw new ConvexError("Authentication system error");
      }
      
      if (!identity) {
        console.error('[STREAMING_ERROR] No identity found - authentication failed');
        throw new ConvexError("Authentication required");
      }
      
      console.log('[STREAMING_ERROR] Identity obtained:', {
        hasTokenIdentifier: !!identity.tokenIdentifier,
        hasSubject: !!identity.subject,
        identityKeys: Object.keys(identity),
        identityType: typeof identity
      });
      
      // More defensive token identifier check
      const tokenIdentifier = identity.tokenIdentifier;
      if (!tokenIdentifier) {
        console.error('[STREAMING_ERROR] Token identifier not found in identity:', {
          identity: identity,
          hasTokenIdentifier: 'tokenIdentifier' in identity,
          tokenIdentifierValue: identity.tokenIdentifier,
          tokenIdentifierType: typeof identity.tokenIdentifier
        });
        throw new ConvexError("Token identifier not found");
      }
      
      if (typeof tokenIdentifier !== 'string' || tokenIdentifier.length === 0) {
        console.error('[STREAMING_ERROR] Token identifier invalid format:', {
          tokenIdentifier,
          type: typeof tokenIdentifier,
          length: tokenIdentifier?.length
        });
        throw new ConvexError("Invalid token identifier format");
      }
      
      console.log('[STREAMING_ERROR] Token identifier validated:', {
        tokenIdentifierPrefix: tokenIdentifier.substring(0, 20) + '...',
        tokenIdentifierLength: tokenIdentifier.length
      });
      
      console.log('[STREAMING_ERROR] Searching for streaming response:', {
        streamId: args.streamId,
        tokenIdentifier: tokenIdentifier.substring(0, 20) + '...'
      });
      
      // Find the streaming response
      const streamingResponse = await ctx.db
        .query("streamingResponses")
        .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
        .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
        .first();
      
      if (!streamingResponse) {
        console.error('[STREAMING_ERROR] Streaming response not found:', {
          streamId: args.streamId,
          tokenIdentifier: tokenIdentifier.substring(0, 20) + '...'
        });
        throw new ConvexError("Streaming response not found");
      }
      
      console.log('[STREAMING_ERROR] Found streaming response, marking as error:', {
        responseId: streamingResponse._id,
        currentStatus: streamingResponse.status,
        isComplete: streamingResponse.isComplete
      });
      
      // Mark as error
      await ctx.db.patch(streamingResponse._id, {
        isComplete: true,
        status: "error",
        errorMessage: args.errorMessage,
        updatedAt: Date.now(),
      });
      
      console.log('[STREAMING_ERROR] Successfully marked streaming response as error:', {
        streamId: args.streamId,
        responseId: streamingResponse._id
      });
      
      return { success: true, streamId: args.streamId };
      
    } catch (error) {
      console.error('[STREAMING_ERROR] Error in errorStreamingResponse:', {
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        streamId: args.streamId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
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
 * Robust cleanup for streaming responses with error recovery
 * This handles edge cases where normal error cleanup fails
 */
export const robustCleanupStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    errorMessage: v.optional(v.string()),
    forceCleanup: v.optional(v.boolean()), // Allow cleanup even without auth in extreme cases
  },
  handler: async (ctx, args) => {
    console.log('[STREAMING_ROBUST_CLEANUP] Starting robust cleanup', {
      streamId: args.streamId?.substring(0, 20) + '...',
      hasErrorMessage: !!args.errorMessage,
      forceCleanup: !!args.forceCleanup,
      timestamp: Date.now()
    });
    
    try {
      // Try to get auth context, but don't fail if it's not available in force cleanup mode
      let tokenIdentifier = null;
      
      try {
        const identity = await ctx.auth.getUserIdentity();
        tokenIdentifier = identity?.tokenIdentifier || null;
        console.log('[STREAMING_ROBUST_CLEANUP] Auth context:', {
          hasIdentity: !!identity,
          hasTokenIdentifier: !!tokenIdentifier
        });
      } catch (authError) {
        if (!args.forceCleanup) {
          console.error('[STREAMING_ROBUST_CLEANUP] Auth failed and force cleanup not enabled:', authError);
          throw new ConvexError("Authentication required for cleanup");
        }
        
        console.warn('[STREAMING_ROBUST_CLEANUP] Auth failed but force cleanup enabled:', authError);
      }
      
      // Try to find the streaming response with or without auth filter
      let streamingResponse;
      
      if (tokenIdentifier) {
        // Normal authenticated cleanup
        console.log('[STREAMING_ROBUST_CLEANUP] Searching with auth filter...');
        streamingResponse = await ctx.db
          .query("streamingResponses")
          .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
          .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
          .first();
      } else if (args.forceCleanup) {
        // Force cleanup mode - search without auth filter
        console.log('[STREAMING_ROBUST_CLEANUP] Force cleanup: searching without auth filter...');
        streamingResponse = await ctx.db
          .query("streamingResponses")
          .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
          .first();
      }
      
      if (!streamingResponse) {
        console.log('[STREAMING_ROBUST_CLEANUP] No streaming response found - cleanup not needed');
        return { success: true, found: false, action: "none" };
      }
      
      console.log('[STREAMING_ROBUST_CLEANUP] Found streaming response:', {
        responseId: streamingResponse._id,
        currentStatus: streamingResponse.status,
        isComplete: streamingResponse.isComplete,
        tokenIdentifier: streamingResponse.tokenIdentifier?.substring(0, 20) + '...'
      });
      
      // Update the record to mark as error
      const updateData: any = {
        isComplete: true,
        status: "error",
        updatedAt: Date.now(),
      };
      
      if (args.errorMessage) {
        updateData.errorMessage = args.errorMessage;
      }
      
      await ctx.db.patch(streamingResponse._id, updateData);
      
      console.log('[STREAMING_ROBUST_CLEANUP] Successfully cleaned up streaming response');
      return { 
        success: true, 
        found: true, 
        action: "marked_as_error",
        streamId: args.streamId,
        responseId: streamingResponse._id
      };
      
    } catch (error) {
      console.error('[STREAMING_ROBUST_CLEANUP] Robust cleanup failed:', {
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        streamId: args.streamId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
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