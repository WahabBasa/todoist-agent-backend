import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v, ConvexError } from "convex/values";

// =================================================================
// STREAMING BACKWARD COMPATIBILITY LAYER
// Bridges the gap between old streamingResponses and new streamEvents
// Enables gradual migration without breaking existing functionality
// =================================================================

/**
 * Feature flags for controlling migration behavior
 */
export interface StreamingConfig {
  useEventSystem: boolean; // Whether to use new event-driven system
  useLegacySystem: boolean; // Whether to maintain legacy streamingResponses
  hybridMode: boolean; // Whether to write to both systems (for migration)
}

// Default configuration - can be overridden per deployment
const DEFAULT_CONFIG: StreamingConfig = {
  useEventSystem: true,   // Enable new system
  useLegacySystem: true,  // Keep legacy system during transition
  hybridMode: true,       // Write to both for now
};

/**
 * Hybrid streaming start - creates both legacy and event-based streams
 */
export const startStreamingHybrid = mutation({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    userMessage: v.string(),
    modelName: v.optional(v.string()),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Create legacy streaming response if enabled
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.createStreamingResponse, {
          streamId: args.streamId,
          sessionId: args.sessionId,
          userMessage: args.userMessage,
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to create legacy stream:", error);
        if (!config.useEventSystem) {
          throw error; // If only using legacy, propagate the error
        }
      }
    }
    
    // Create event-driven stream if enabled
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.startStream, {
          streamId: args.streamId,
          sessionId: args.sessionId,
          userMessage: args.userMessage,
          modelName: args.modelName,
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to create event stream:", error);
        if (!config.useLegacySystem) {
          throw error; // If only using events, propagate the error
        }
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      systems: {
        legacy: config.useLegacySystem || config.hybridMode,
        events: config.useEventSystem || config.hybridMode,
      },
      results,
    };
  },
});

/**
 * Hybrid text delta update - updates both systems
 */
export const updateStreamingTextHybrid = mutation({
  args: {
    streamId: v.string(),
    textDelta: v.string(),
    accumulatedText: v.string(),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Update legacy system
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.updateStreamingContent, {
          streamId: args.streamId,
          textDelta: args.textDelta,
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to update legacy stream:", error);
      }
    }
    
    // Publish text-delta event
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.publishEvent, {
          streamId: args.streamId,
          eventType: "text-delta",
          payload: {
            text: args.textDelta,
            accumulated: args.accumulatedText,
          },
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to publish text event:", error);
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      results,
    };
  },
});

/**
 * Hybrid tool call update - publishes tool execution to both systems
 */
export const updateStreamingToolCallHybrid = mutation({
  args: {
    streamId: v.string(),
    toolName: v.string(),
    toolCallId: v.string(),
    input: v.any(),
    accumulatedText: v.string(),
    toolCalls: v.array(v.any()),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Update legacy system
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.updateToolExecution, {
          streamId: args.streamId,
          toolCallId: args.toolCallId,
          toolName: args.toolName,
          input: args.input,
          status: "running",
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to update legacy stream:", error);
      }
    }
    
    // Publish tool-call event
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.publishEvent, {
          streamId: args.streamId,
          eventType: "tool-call",
          payload: {
            toolName: args.toolName,
            toolCallId: args.toolCallId,
            input: args.input,
          },
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to publish tool-call event:", error);
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      results,
    };
  },
});

/**
 * Hybrid tool result update - publishes tool completion to both systems
 */
export const updateStreamingToolResultHybrid = mutation({
  args: {
    streamId: v.string(),
    toolName: v.string(),
    toolCallId: v.string(),
    output: v.any(),
    success: v.optional(v.boolean()),
    error: v.optional(v.string()),
    accumulatedText: v.string(),
    toolResults: v.array(v.any()),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Update legacy system
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.updateToolExecution, {
          streamId: args.streamId,
          toolCallId: args.toolCallId,
          toolName: args.toolName,
          output: args.output,
          status: "completed",
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to update legacy stream:", error);
      }
    }
    
    // Publish tool-result event
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.publishEvent, {
          streamId: args.streamId,
          eventType: "tool-result",
          payload: {
            toolName: args.toolName,
            toolCallId: args.toolCallId,
            output: args.output,
            success: args.success ?? true,
            error: args.error,
          },
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to publish tool-result event:", error);
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      results,
    };
  },
});

/**
 * Hybrid stream completion - finishes both systems
 */
export const finishStreamingHybrid = mutation({
  args: {
    streamId: v.string(),
    finalContent: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Complete legacy system
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.completeStreamingResponse, {
          streamId: args.streamId,
          finalContent: args.finalContent,
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to complete legacy stream:", error);
      }
    }
    
    // Finish event stream
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.finishStream, {
          streamId: args.streamId,
          finalContent: args.finalContent,
          toolCalls: args.toolCalls,
          toolResults: args.toolResults,
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to finish event stream:", error);
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      results,
    };
  },
});

/**
 * Hybrid error handling - marks both systems as error
 */
export const errorStreamingHybrid = mutation({
  args: {
    streamId: v.string(),
    error: v.string(),
    errorType: v.optional(v.string()),
    config: v.optional(v.object({
      useEventSystem: v.optional(v.boolean()),
      useLegacySystem: v.optional(v.boolean()),
      hybridMode: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const config: StreamingConfig = {
      ...DEFAULT_CONFIG,
      ...args.config,
    };
    
    const results: any = {};
    
    // Mark legacy system as error
    if (config.useLegacySystem || config.hybridMode) {
      try {
        const legacyResult = await ctx.runMutation(api.streamingResponses.errorStreamingResponse, {
          streamId: args.streamId,
          errorMessage: args.error,
        });
        results.legacy = legacyResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to error legacy stream:", error);
      }
    }
    
    // Error event stream
    if (config.useEventSystem || config.hybridMode) {
      try {
        const eventResult = await ctx.runMutation(api.streamEvents.errorStream, {
          streamId: args.streamId,
          error: args.error,
          errorType: args.errorType as any,
        });
        results.events = eventResult;
      } catch (error) {
        console.warn("[COMPAT] Failed to error event stream:", error);
      }
    }
    
    return {
      success: true,
      streamId: args.streamId,
      results,
    };
  },
});

/**
 * Smart stream query - returns data from best available system
 * Prefers event system but falls back to legacy
 */
export const getStreamingDataSmart = query({
  args: {
    streamId: v.string(),
    preferEvents: v.optional(v.boolean()), // Default true
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const preferEvents = args.preferEvents ?? true;
    
    if (preferEvents) {
      // Try event system first
      try {
        const eventState: any = await ctx.runQuery(api.streamEvents.getStreamState, {
          streamId: args.streamId,
        });
        
        if (eventState) {
          // Reconstruct content from events
          const reconstructed: any = await ctx.runQuery(api.streamEvents.reconstructStreamContent, {
            streamId: args.streamId,
          });
          
          return {
            source: "events",
            streamId: args.streamId,
            partialContent: reconstructed?.finalContent || "",
            isComplete: eventState.isComplete,
            status: eventState.status,
            userMessage: eventState.userMessage,
            sessionId: eventState.sessionId,
            createdAt: eventState.startedAt,
            updatedAt: eventState.completedAt || eventState.startedAt,
            // Additional event-specific data
            eventMetadata: {
              totalEvents: eventState.totalEvents,
              lastEventOrder: eventState.lastEventOrder,
            },
          };
        }
      } catch (error) {
        console.warn("[COMPAT] Failed to get event stream data:", error);
      }
    }
    
    // Fall back to legacy system
    try {
      const legacyData: any = await ctx.runQuery(api.streamingResponses.getStreamingResponse, {
        streamId: args.streamId,
      });
      
      if (legacyData) {
        return {
          source: "legacy",
          ...legacyData,
        };
      }
    } catch (error) {
      console.warn("[COMPAT] Failed to get legacy stream data:", error);
    }
    
    return null; // No data found in either system
  },
});

/**
 * Migration utility: Convert legacy stream to events
 */
export const migrateLegacyStreamToEvents = mutation({
  args: {
    streamId: v.string(),
    preserveLegacy: v.optional(v.boolean()), // Whether to keep legacy record
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    // Get legacy stream data
    const legacyStream = await ctx.runQuery(api.streamingResponses.getStreamingResponse, {
      streamId: args.streamId,
    });
    
    if (!legacyStream) {
      throw new ConvexError(`Legacy stream not found: ${args.streamId}`);
    }
    
    // Check if events already exist
    const existingEvents = await ctx.runQuery(api.streamEvents.getStreamState, {
      streamId: args.streamId,
    });
    
    if (existingEvents) {
      return {
        success: true,
        message: "Events already exist for this stream",
        streamId: args.streamId,
      };
    }
    
    // Create event stream from legacy data
    const startResult = await ctx.runMutation(api.streamEvents.startStream, {
      streamId: args.streamId,
      sessionId: legacyStream.sessionId,
      userMessage: legacyStream.userMessage || "Migrated stream",
    });
    
    // Create text-delta events from final content
    if (legacyStream.content) {
      await ctx.runMutation(api.streamEvents.publishEvent, {
        streamId: args.streamId,
        eventType: "text-delta",
        payload: {
          text: legacyStream.content,
          accumulated: legacyStream.content,
        },
      });
    }
    
    // Create tool events if they exist
    if (legacyStream.toolExecutions) {
      for (const toolExecution of legacyStream.toolExecutions) {
        // Create tool-call event
        await ctx.runMutation(api.streamEvents.publishEvent, {
          streamId: args.streamId,
          eventType: "tool-call",
          payload: {
            toolName: toolExecution.toolName || "unknown",
            toolCallId: toolExecution.toolCallId || "migrated",
            input: toolExecution.input,
          },
        });
        
        // Create tool-result event if completed
        if (toolExecution.status === "completed" && toolExecution.output) {
          await ctx.runMutation(api.streamEvents.publishEvent, {
            streamId: args.streamId,
            eventType: "tool-result",
            payload: {
              toolName: toolExecution.toolName || "unknown",
              toolCallId: toolExecution.toolCallId || "migrated",
              output: toolExecution.output,
              success: toolExecution.status === "completed",
            },
          });
        }
      }
    }
    
    // Finish the stream
    if (legacyStream.isComplete) {
      if (legacyStream.status === "error") {
        await ctx.runMutation(api.streamEvents.errorStream, {
          streamId: args.streamId,
          error: "Migrated error stream",
          errorType: "system",
        });
      } else {
        await ctx.runMutation(api.streamEvents.finishStream, {
          streamId: args.streamId,
          finalContent: legacyStream.content || "",
        });
      }
    }
    
    // Optionally remove legacy record
    if (!args.preserveLegacy) {
      // Note: We don't have a delete function in streamingResponses.ts
      // This would need to be added if we want to clean up legacy data
    }
    
    return {
      success: true,
      message: "Stream migrated to event system",
      streamId: args.streamId,
      eventsCreated: true,
      legacyPreserved: args.preserveLegacy ?? true,
    };
  },
});

/**
 * Get migration status for all streams
 */
export const getMigrationStatus = query({
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
    
    // Get all legacy streams
    const legacyStreams = await ctx.db
      .query("streamingResponses")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();
    
    // Get all event streams
    const eventStreams = await ctx.db
      .query("streamEvents")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("eventType"), "stream-start"))
      .collect();
    
    const legacyStreamIds = new Set(legacyStreams.map(s => s.streamId));
    const eventStreamIds = new Set(eventStreams.map(s => s.streamId));
    
    const migratedStreams = [...legacyStreamIds].filter(id => eventStreamIds.has(id));
    const unmigradedStreams = [...legacyStreamIds].filter(id => !eventStreamIds.has(id));
    const eventOnlyStreams = [...eventStreamIds].filter(id => !legacyStreamIds.has(id));
    
    return {
      totalLegacyStreams: legacyStreams.length,
      totalEventStreams: eventStreams.length,
      migratedStreams: migratedStreams.length,
      unmigradedStreams: unmigradedStreams.length,
      eventOnlyStreams: eventOnlyStreams.length,
      migrationProgress: legacyStreams.length > 0 ? 
        (migratedStreams.length / legacyStreams.length) * 100 : 100,
      unmigradedStreamIds: unmigradedStreams.slice(0, 10), // First 10 for reference
    };
  },
});