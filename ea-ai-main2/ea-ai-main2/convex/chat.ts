import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PersistentTextStreaming, StreamIdValidator } from "@convex-dev/persistent-text-streaming";

// Declare the components global that Convex provides when app is configured with components
declare const components: any;

// Initialize the persistent text streaming component at module level
const persistentTextStreaming = new PersistentTextStreaming(
  components.persistentTextStreaming
);

/**
 * Create a new chat stream using the persistent text streaming component
 * This mutation creates the stream and stores the chat data in the database
 */
export const createChat = mutation({
  args: {
    prompt: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    useHaiku: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Authentication check following existing pattern
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new Error("Token identifier not found");
    }

    // Create a stream using the component
    const streamId = await persistentTextStreaming.createStream(ctx);
    
    // Store the chat conversation in the database
    const chatId = await ctx.db.insert("conversations", {
      tokenIdentifier,
      sessionId: args.sessionId,
      messages: [
        {
          role: "user" as const,
          content: args.prompt,
          timestamp: Date.now(),
        }
      ],
      schemaVersion: 2,
    });
    
    // Also create a streaming response record for compatibility with existing UI
    await ctx.db.insert("streamingResponses", {
      streamId: streamId as unknown as string,
      tokenIdentifier,
      sessionId: args.sessionId,
      content: "",
      isComplete: false,
      status: "streaming" as const,
      userMessage: args.prompt,
      modelName: args.useHaiku ? "anthropic/claude-3-haiku" : "anthropic/claude-3-haiku",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      chatId,
      streamId: streamId as unknown as string,
      prompt: args.prompt,
      useHaiku: args.useHaiku || true,
    };
  },
});

/**
 * Get the persistent stream body using the component
 * This query is used by the frontend to subscribe to stream updates
 */
export const getChatBody = query({
  args: {
    streamId: StreamIdValidator,
  },
  handler: async (ctx, args) => {
    return await persistentTextStreaming.getStreamBody(
      ctx,
      args.streamId
    );
  },
});

/**
 * Get streaming response by streamId for compatibility with existing frontend
 * This provides a bridge between the new streaming system and existing UI components
 */
export const getStreamingResponse = query({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
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
 * Mark streaming response as complete for compatibility with existing system
 */
export const completeStreamingResponse = mutation({
  args: {
    streamId: v.string(),
    finalContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    
    // Find the streaming response
    const streamingResponse = await ctx.db
      .query("streamingResponses")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();
    
    if (!streamingResponse) {
      return null;
    }
    
    // Mark as complete
    await ctx.db.patch(streamingResponse._id, {
      isComplete: true,
      status: "complete",
      ...(args.finalContent && { content: args.finalContent }),
      updatedAt: Date.now(),
    });
    
    return { success: true, streamId: args.streamId };
  },
});