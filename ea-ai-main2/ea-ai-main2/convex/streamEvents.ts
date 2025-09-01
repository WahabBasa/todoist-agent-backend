import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// =================================================================
// STREAM EVENTS MANAGEMENT
// Event-driven streaming architecture inspired by OpenCode
// Replaces single-record updates with discrete event publishing
// =================================================================

/**
 * Event type definitions for type safety
 */
export type StreamEventType = 
  | 'stream-start'
  | 'text-delta' 
  | 'tool-call'
  | 'tool-result'
  | 'stream-finish'
  | 'stream-error';

/**
 * Event payload type definitions
 */
export type StreamEventPayload = {
  'stream-start': {
    userMessage: string;
    modelName?: string;
    sessionContext?: any;
  };
  'text-delta': {
    text: string;
    accumulated?: string; // For debugging/reconstruction
  };
  'tool-call': {
    toolName: string;
    toolCallId: string;
    input: any;
  };
  'tool-result': {
    toolName: string;
    toolCallId: string;
    output: any;
    success: boolean;
    error?: string;
  };
  'stream-finish': {
    totalEvents: number;
    finalContent: string;
    toolCalls?: any[];
    toolResults?: any[];
  };
  'stream-error': {
    error: string;
    errorType: 'auth' | 'ai' | 'tool' | 'system';
    recoverable: boolean;
  };
};

/**
 * Initialize a new stream with a start event
 */
export const startStream = mutation({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    userMessage: v.string(),
    modelName: v.optional(v.string()),
    sessionContext: v.optional(v.any()),
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
    const startPayload: StreamEventPayload['stream-start'] = {
      userMessage: args.userMessage,
      modelName: args.modelName,
      sessionContext: args.sessionContext,
    };
    
    await ctx.db.insert("streamEvents", {
      streamId: args.streamId,
      tokenIdentifier,
      sessionId: args.sessionId,
      eventType: 'stream-start',
      payload: startPayload,
      order: 0, // Start event is always order 0
      userMessage: args.userMessage, // Store on start event for easy access
      createdAt: now,
    });
    
    return { success: true, streamId: args.streamId, startOrder: 0 };
  },
});

/**
 * Publish a new event to an existing stream
 * This is the core function that replaces constant record updates
 */
export const publishEvent = mutation({
  args: {
    streamId: v.string(),
    eventType: v.string(), // StreamEventType
    payload: v.any(), // StreamEventPayload[eventType]
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
    
    // Get the current max order for this stream to ensure proper sequencing
    const lastEvent = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .order("desc")
      .first();
    
    const nextOrder = (lastEvent?.order ?? -1) + 1;
    
    // Get session info from the start event if needed
    let sessionId: Id<"chatSessions"> | undefined;
    let userMessage: string | undefined;
    
    if (nextOrder > 0) { // Not the start event, get context from start event
      const startEvent = await ctx.db
        .query("streamEvents")
        .withIndex("by_streamId_and_order", (q) => 
          q.eq("streamId", args.streamId).eq("order", 0)
        )
        .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
        .first();
      
      sessionId = startEvent?.sessionId;
      userMessage = startEvent?.userMessage;
    }
    
    const now = Date.now();
    
    await ctx.db.insert("streamEvents", {
      streamId: args.streamId,
      tokenIdentifier,
      sessionId,
      eventType: args.eventType,
      payload: args.payload,
      order: nextOrder,
      userMessage, // Propagate from start event
      createdAt: now,
    });
    
    return { 
      success: true, 
      streamId: args.streamId, 
      eventType: args.eventType,
      order: nextOrder 
    };
  },
});

/**
 * Batch publish multiple events at once for efficiency
 * Useful for tool execution that generates multiple events
 */
export const publishEventBatch = mutation({
  args: {
    streamId: v.string(),
    events: v.array(v.object({
      eventType: v.string(),
      payload: v.any(),
    })),
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
    
    // Get current max order
    const lastEvent = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .order("desc")
      .first();
    
    let currentOrder = (lastEvent?.order ?? -1) + 1;
    
    // Get session context from start event
    const startEvent = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => 
        q.eq("streamId", args.streamId).eq("order", 0)
      )
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    const sessionId = startEvent?.sessionId;
    const userMessage = startEvent?.userMessage;
    const now = Date.now();
    
    // Insert all events in batch
    const insertPromises = args.events.map(async (event) => {
      const order = currentOrder++;
      
      return ctx.db.insert("streamEvents", {
        streamId: args.streamId,
        tokenIdentifier,
        sessionId,
        eventType: event.eventType,
        payload: event.payload,
        order,
        userMessage,
        createdAt: now,
      });
    });
    
    await Promise.all(insertPromises);
    
    return { 
      success: true, 
      streamId: args.streamId, 
      eventsPublished: args.events.length,
      finalOrder: currentOrder - 1
    };
  },
});

/**
 * Get all events for a stream in proper order
 * This is the primary query for reconstructing stream state
 */
export const getStreamEvents = query({
  args: {
    streamId: v.string(),
    fromOrder: v.optional(v.number()), // For pagination/incremental updates
    limit: v.optional(v.number()), // Default 100
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
    
    // Build the complete query chain before awaiting
    const query = ctx.db
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => {
        if (args.fromOrder !== undefined) {
          return q.eq("streamId", args.streamId).gte("order", args.fromOrder);
        }
        return q.eq("streamId", args.streamId);
      })
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .order("asc")
      .take(args.limit ?? 100); // Apply limit in the chain
    
    return await query.collect();
  },
});

/**
 * Get stream metadata and current state
 * Reconstructs current stream state from events without returning all events
 */
export const getStreamState = query({
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
    
    // Get start and finish/error events
    const startEvent = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => 
        q.eq("streamId", args.streamId).eq("order", 0)
      )
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!startEvent) {
      return null; // Stream doesn't exist
    }
    
    // Check for finish or error event
    const terminalEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => 
        q.and(
          q.eq(q.field("tokenIdentifier"), tokenIdentifier),
          q.or(
            q.eq(q.field("eventType"), "stream-finish"),
            q.eq(q.field("eventType"), "stream-error")
          )
        )
      )
      .first();
    
    // Get total event count
    const totalEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .collect();
    
    const isComplete = !!terminalEvents;
    const status = terminalEvents ? 
      (terminalEvents.eventType === "stream-error" ? "error" : "complete") : 
      "streaming";
    
    return {
      streamId: args.streamId,
      sessionId: startEvent.sessionId,
      userMessage: startEvent.userMessage,
      status,
      isComplete,
      totalEvents: totalEvents.length,
      startedAt: startEvent.createdAt,
      completedAt: terminalEvents?.createdAt,
      lastEventOrder: Math.max(...totalEvents.map(e => e.order)),
    };
  },
});

/**
 * Finish a stream with final results
 */
export const finishStream = mutation({
  args: {
    streamId: v.string(),
    finalContent: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new ConvexError("Token identifier not found");
    }
    
    // Get total event count for metadata
    const allEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .collect();
    
    const finishPayload: StreamEventPayload['stream-finish'] = {
      totalEvents: allEvents.length,
      finalContent: args.finalContent,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
    };
    
    return await ctx.runMutation(api.streamEvents.publishEvent, {
      streamId: args.streamId,
      eventType: 'stream-finish',
      payload: finishPayload,
    });
  },
});

/**
 * Mark stream as error
 */
export const errorStream = mutation({
  args: {
    streamId: v.string(),
    error: v.string(),
    errorType: v.optional(v.union(
      v.literal("auth"),
      v.literal("ai"), 
      v.literal("tool"),
      v.literal("system")
    )),
    recoverable: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    const errorPayload: StreamEventPayload['stream-error'] = {
      error: args.error,
      errorType: args.errorType ?? 'system',
      recoverable: args.recoverable ?? false,
    };
    
    return await ctx.runMutation(api.streamEvents.publishEvent, {
      streamId: args.streamId,
      eventType: 'stream-error',
      payload: errorPayload,
    });
  },
});

/**
 * Get incremental events since last order - for real-time updates
 * This is critical for frontend event subscription efficiency
 */
export const getIncrementalEvents = query({
  args: {
    streamId: v.string(),
    sinceOrder: v.number(),
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
      .query("streamEvents")
      .withIndex("by_streamId_and_order", (q) => 
        q.eq("streamId", args.streamId).gt("order", args.sinceOrder)
      )
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .order("asc")
      .collect();
  },
});

/**
 * Get all active streams for a user - useful for UI state management
 */
export const getActiveStreams = query({
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
    
    // Get all start events for user (optionally filtered by session)
    let startEventsQuery = ctx.db
      .query("streamEvents")
      .withIndex("by_eventType", (q) => q.eq("eventType", "stream-start"))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier));
    
    if (args.sessionId) {
      startEventsQuery = startEventsQuery.filter((q) => 
        q.eq(q.field("sessionId"), args.sessionId)
      );
    }
    
    const startEvents = await startEventsQuery.collect();
    
    // Check which streams are still active (no finish/error event)
    const activeStreams = [];
    
    for (const startEvent of startEvents) {
      const terminalEvent = await ctx.db
        .query("streamEvents")
        .withIndex("by_streamId", (q) => q.eq("streamId", startEvent.streamId))
        .filter((q) => 
          q.and(
            q.eq(q.field("tokenIdentifier"), tokenIdentifier),
            q.or(
              q.eq(q.field("eventType"), "stream-finish"),
              q.eq(q.field("eventType"), "stream-error")
            )
          )
        )
        .first();
      
      if (!terminalEvent) {
        activeStreams.push({
          streamId: startEvent.streamId,
          sessionId: startEvent.sessionId,
          userMessage: startEvent.userMessage,
          startedAt: startEvent.createdAt,
        });
      }
    }
    
    return activeStreams;
  },
});

/**
 * Get events of specific types - useful for debugging and analytics
 */
export const getEventsByType = query({
  args: {
    streamId: v.string(),
    eventTypes: v.array(v.string()),
    limit: v.optional(v.number()),
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
    
    const results = [];
    
    for (const eventType of args.eventTypes) {
      // Build the complete query chain before awaiting
      const eventsQuery = ctx.db
        .query("streamEvents")
        .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
        .filter((q) => 
          q.and(
            q.eq(q.field("tokenIdentifier"), tokenIdentifier),
            q.eq(q.field("eventType"), eventType)
          )
        )
        .order("asc")
        .take(args.limit ?? 50);
      
      // Await only at the end
      const events = await eventsQuery.collect();
      results.push(...events);
    }
    
    // Sort by order since we combined multiple queries
    results.sort((a, b) => a.order - b.order);
    
    return results;
  },
});

/**
 * Reconstruct final content from text-delta events
 * This is the core function for building the accumulated text
 */
export const reconstructStreamContent = query({
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
    
    // Get all text-delta events in order
    const textEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => 
        q.and(
          q.eq(q.field("tokenIdentifier"), tokenIdentifier),
          q.eq(q.field("eventType"), "text-delta")
        )
      )
      .order("asc")
      .collect();
    
    // Reconstruct text by concatenating all text deltas
    let reconstructedText = "";
    const textDeltas = [];
    
    for (const event of textEvents) {
      const payload = event.payload as StreamEventPayload['text-delta'];
      if (payload.text) {
        reconstructedText += payload.text;
        textDeltas.push({
          order: event.order,
          text: payload.text,
          timestamp: event.createdAt,
        });
      }
    }
    
    return {
      streamId: args.streamId,
      finalContent: reconstructedText,
      totalTextEvents: textEvents.length,
      textDeltas, // For debugging
    };
  },
});

/**
 * Get stream summary with tool execution details
 */
export const getStreamSummary = query({
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
    
    // Get all events for analysis
    const allEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .order("asc")
      .collect();
    
    if (allEvents.length === 0) {
      return null;
    }
    
    const startEvent = allEvents.find(e => e.eventType === "stream-start");
    const finishEvent = allEvents.find(e => e.eventType === "stream-finish");
    const errorEvent = allEvents.find(e => e.eventType === "stream-error");
    
    const toolCalls = allEvents.filter(e => e.eventType === "tool-call");
    const toolResults = allEvents.filter(e => e.eventType === "tool-result");
    const textEvents = allEvents.filter(e => e.eventType === "text-delta");
    
    // Calculate timing
    const duration = (finishEvent?.createdAt || errorEvent?.createdAt || Date.now()) - 
                    (startEvent?.createdAt || 0);
    
    return {
      streamId: args.streamId,
      status: errorEvent ? "error" : (finishEvent ? "complete" : "streaming"),
      startedAt: startEvent?.createdAt,
      completedAt: finishEvent?.createdAt || errorEvent?.createdAt,
      duration,
      userMessage: startEvent?.userMessage,
      sessionId: startEvent?.sessionId,
      totalEvents: allEvents.length,
      textEvents: textEvents.length,
      toolsExecuted: toolCalls.length,
      toolsCompleted: toolResults.length,
      toolNames: [...new Set(toolCalls.map(tc => (tc.payload as any).toolName))],
      error: errorEvent ? (errorEvent.payload as StreamEventPayload['stream-error']).error : null,
    };
  },
});

/**
 * Cleanup old completed streams (for maintenance)
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
    const oldFinishEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_eventType", (q) => q.eq("eventType", "stream-finish"))
      .filter((q) => 
        q.and(
          q.eq(q.field("tokenIdentifier"), tokenIdentifier),
          q.lt(q.field("createdAt"), cutoffTime)
        )
      )
      .collect();
    
    const oldErrorEvents = await ctx.db
      .query("streamEvents")
      .withIndex("by_eventType", (q) => q.eq("eventType", "stream-error"))
      .filter((q) => 
        q.and(
          q.eq(q.field("tokenIdentifier"), tokenIdentifier),
          q.lt(q.field("createdAt"), cutoffTime)
        )
      )
      .collect();
    
    const completedStreamIds = new Set([
      ...oldFinishEvents.map(e => e.streamId),
      ...oldErrorEvents.map(e => e.streamId)
    ]);
    
    let deletedCount = 0;
    
    // Delete all events for each completed stream
    for (const streamId of completedStreamIds) {
      const streamEvents = await ctx.db
        .query("streamEvents")
        .withIndex("by_streamId", (q) => q.eq("streamId", streamId))
        .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
        .collect();
      
      for (const event of streamEvents) {
        await ctx.db.delete(event._id);
        deletedCount++;
      }
    }
    
    return { 
      success: true, 
      deletedStreams: completedStreamIds.size,
      deletedEvents: deletedCount 
    };
  },
});