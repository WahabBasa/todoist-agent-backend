import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { ModeController } from "./ai/modes/controller";
import { logDebug } from "./ai/logger";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { createEmbeddedMessage } from "./ai/messageSchemas";
import { optimizeConversation, type ConvexMessage } from "./ai/simpleMessages";

// Debug logging control
const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === "true";

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

// Helper function for schema migration: Convert legacy format to new format
function migrateConversationSchema(conversation: any) {
  if (!conversation) {
    return null;
  }
  
  // If already migrated or has new format, return as-is
  if (conversation.schemaVersion === 2 || conversation.messages) {
    return conversation;
  }
  
  // Legacy format detected - convert to new format
  if (conversation.message) {
    if (ENABLE_DEBUG_LOGS) {
      console.log('🔄 [MIGRATION] Converting legacy conversation format');
    }
    
    const migratedMessages = [];
    
    // Add user message
    migratedMessages.push({
      role: "user" as const,
      content: conversation.message,
      timestamp: conversation.timestamp || Date.now(),
    });
    
    // Add assistant response if exists
    if (conversation.response) {
      migratedMessages.push({
        role: "assistant" as const,
        content: conversation.response,
        toolCalls: conversation.toolCalls || undefined,
        timestamp: (conversation.timestamp || Date.now()) + 1,
      });
    }
    
    // Return conversation with migrated messages
    const result = {
      ...conversation,
      messages: migratedMessages,
      schemaVersion: 2,
    };
    
    if (ENABLE_DEBUG_LOGS) {
      console.log('✅ [MIGRATION] Completed:', { messageCount: result.messages.length });
    }
    
    return result;
  }
  
  if (ENABLE_DEBUG_LOGS) {
    console.warn('⚠️ [MIGRATION] Unknown conversation format');
  }
  return conversation;
}

const embeddedMetadataArg = v.object({
  mode: v.optional(v.string()),
  toolStates: v.optional(
    v.record(
      v.string(),
      v.union(v.literal("pending"), v.literal("running"), v.literal("completed"))
    )
  ),
  requestId: v.optional(v.string()),
  delegation: v.optional(
    v.object({
      target: v.string(),
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
      reason: v.optional(v.string()),
    })
  ),
});

type AppendStatus = "appended" | "noop" | "conflict";

type AppendResult = {
  status: AppendStatus;
  messages: ConvexMessage[];
  version: number;
  previousVersion: number;
};

export const appendUserMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    historyVersion: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AppendResult> => {
    const tokenIdentifier = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .first();

    const messages: ConvexMessage[] = Array.isArray(conversation?.messages)
      ? [...(conversation!.messages as ConvexMessage[])]
      : [];

    const previousVersion = messages.length;
    const trimmedContent = args.content.trim();

    if (args.historyVersion !== undefined && args.historyVersion !== previousVersion) {
      return {
        status: "conflict",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    if (!trimmedContent) {
      return {
        status: "noop",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    const mode = resolveMode(args.sessionId, session);
    const candidate = createEmbeddedMessage(
      {
        role: "user" as const,
        content: trimmedContent,
        timestamp: Date.now(),
      },
      { mode }
    ) as ConvexMessage;

    if (!shouldAppendMessage(messages, candidate)) {
      return {
        status: "noop",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    messages.push(candidate);
    const now = Date.now();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        messages,
        schemaVersion: 2,
      });
    } else {
      await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages,
        schemaVersion: 2,
      });
    }

    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      messageCount: messages.length,
    });

    return {
      status: "appended",
      messages,
      version: messages.length,
      previousVersion,
    };
  },
});

export const appendAssistantMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.optional(v.string()),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          args: v.any(),
          toolCallId: v.string(),
        })
      )
    ),
    toolResults: v.optional(
      v.array(
        v.object({
          toolCallId: v.string(),
          toolName: v.string(),
          result: v.any(),
        })
      )
    ),
    historyVersion: v.optional(v.number()),
    metadata: v.optional(embeddedMetadataArg),
  },
  handler: async (ctx, args): Promise<AppendResult> => {
    const tokenIdentifier = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .first();

    const messages: ConvexMessage[] = Array.isArray(conversation?.messages)
      ? [...(conversation!.messages as ConvexMessage[])]
      : [];

    const previousVersion = messages.length;

    if (args.historyVersion !== undefined && args.historyVersion !== previousVersion) {
      console.warn('[BACKEND DEBUG] Assistant append conflict detected', {
        sessionId: args.sessionId,
        providedVersion: args.historyVersion,
        previousVersion,
      });
      return {
        status: "conflict",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    const trimmedContent = args.content?.trim() ?? "";
    const hasContent = Boolean(trimmedContent);
    const hasTools = Boolean(args.toolCalls?.length || args.toolResults?.length);

    if (!hasContent && !hasTools) {
      console.log('[BACKEND DEBUG] Assistant append noop (no content/tools)', {
        sessionId: args.sessionId,
        previousVersion,
      });
      return {
        status: "noop",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    const mode = args.metadata?.mode ?? resolveMode(args.sessionId, session);
    const metadata = args.metadata ? { ...args.metadata, mode } : { mode };

    const baseMessage: ConvexMessage = {
      role: "assistant",
      timestamp: Date.now(),
    };

    if (hasContent) {
      baseMessage.content = trimmedContent;
    }

    if (args.toolCalls?.length) {
      baseMessage.toolCalls = args.toolCalls;
    }

    if (args.toolResults?.length) {
      baseMessage.toolResults = args.toolResults.map((result) => ({
        ...result,
        toolName: result.toolName,
      }));
    }

    const candidate = createEmbeddedMessage(baseMessage, metadata) as ConvexMessage;

    const combined = [...messages, candidate];
    const optimized = optimizeConversation(combined);

    const now = Date.now();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        messages: optimized,
        schemaVersion: 2,
      });
    } else {
      await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages: optimized,
        schemaVersion: 2,
      });
    }

    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      messageCount: optimized.length,
    });

    const result: AppendResult = {
      status: "appended",
      messages: optimized,
      version: optimized.length,
      previousVersion,
    };
    console.log('[BACKEND DEBUG] Assistant append success', {
      sessionId: args.sessionId,
      previousVersion,
      nextVersion: result.version,
      contentLength: trimmedContent.length,
      hasTools,
    });
    return result;
  },
});

// OpenCode-style progressive assistant turn lifecycle: begin → update → finish
export const beginAssistantTurn = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    requestId: v.string(),
    historyVersion: v.optional(v.number()),
    metadata: v.optional(embeddedMetadataArg),
  },
  handler: async (ctx, args): Promise<AppendResult> => {
    const tokenIdentifier = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .first();

    const messages: ConvexMessage[] = Array.isArray(conversation?.messages)
      ? [...(conversation!.messages as ConvexMessage[])]
      : [];

    const previousVersion = messages.length;
    if (args.historyVersion !== undefined && args.historyVersion !== previousVersion) {
      return {
        status: "conflict",
        messages,
        version: previousVersion,
        previousVersion,
      };
    }

    const mode = args.metadata?.mode ?? resolveMode(args.sessionId, session);
    const baseMessage: ConvexMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    const metadata = { ...(args.metadata || {}), mode, requestId: args.requestId };
    const candidate = createEmbeddedMessage(baseMessage, metadata) as ConvexMessage;

    messages.push(candidate);

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        messages,
        schemaVersion: 2,
      });
    } else {
      await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages,
        schemaVersion: 2,
      });
    }

    await ctx.db.patch(args.sessionId, {
      lastMessageAt: Date.now(),
      messageCount: messages.length,
    });

    return {
      status: "appended",
      messages,
      version: messages.length,
      previousVersion,
    };
  },
});

export const updateAssistantTurn = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    requestId: v.string(),
    patch: v.object({
      toolCalls: v.optional(
        v.array(
          v.object({ name: v.string(), args: v.any(), toolCallId: v.string() })
        )
      ),
      toolResults: v.optional(
        v.array(
          v.object({ toolCallId: v.string(), toolName: v.string(), result: v.any() })
        )
      ),
      metadata: v.optional(embeddedMetadataArg),
    }),
  },
  handler: async (ctx, args): Promise<AppendResult> => {
    const tokenIdentifier = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .first();

    const messages: ConvexMessage[] = Array.isArray(conversation?.messages)
      ? [...(conversation!.messages as ConvexMessage[])]
      : [];

    const previousVersion = messages.length;
    if (messages.length === 0) {
      return { status: "noop", messages, version: previousVersion, previousVersion };
    }

    // Find the most recent assistant message with matching requestId
    let idx = messages.length - 1;
    while (idx >= 0) {
      const m: any = messages[idx];
      if (m?.role === "assistant" && m?.metadata?.requestId === args.requestId) break;
      idx--;
    }
    if (idx < 0) {
      return { status: "noop", messages, version: previousVersion, previousVersion };
    }

    const msg: any = { ...(messages[idx] as any) };
    if (args.patch.toolCalls?.length) {
      const existing = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
      const merged = dedupeToolCallsForUpdate([...existing, ...args.patch.toolCalls]);
      msg.toolCalls = merged;
    }
    if (args.patch.toolResults?.length) {
      const existing = Array.isArray(msg.toolResults) ? msg.toolResults : [];
      const merged = dedupeToolResultsForUpdate([...existing, ...args.patch.toolResults]);
      msg.toolResults = merged;
    }
    if (args.patch.metadata) {
      msg.metadata = { ...(msg.metadata || {}), ...args.patch.metadata };
    }

    messages[idx] = msg as ConvexMessage;

    const optimized = optimizeConversation(messages);
    await ctx.db.patch(conversation!._id, { messages: optimized, schemaVersion: 2 });
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now(), messageCount: optimized.length });

    return { status: "appended", messages: optimized, version: optimized.length, previousVersion };
  },
});

export const finishAssistantTurn = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    requestId: v.string(),
    content: v.optional(v.string()),
    metadata: v.optional(embeddedMetadataArg),
  },
  handler: async (ctx, args): Promise<AppendResult> => {
    const tokenIdentifier = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId)
      )
      .first();

    const messages: ConvexMessage[] = Array.isArray(conversation?.messages)
      ? [...(conversation!.messages as ConvexMessage[])]
      : [];

    const previousVersion = messages.length;
    if (messages.length === 0) {
      return { status: "noop", messages, version: previousVersion, previousVersion };
    }

    // Find the most recent assistant message with matching requestId
    let idx = messages.length - 1;
    while (idx >= 0) {
      const m: any = messages[idx];
      if (m?.role === "assistant" && m?.metadata?.requestId === args.requestId) break;
      idx--;
    }
    if (idx < 0) {
      // Fallback: find last assistant placeholder (no content and no tools)
      idx = messages.length - 1;
      while (idx >= 0) {
        const m: any = messages[idx];
        const noContent = !m?.content || (typeof m.content === 'string' && m.content.trim() === '');
        const noTools = !Array.isArray(m?.toolCalls) && !Array.isArray(m?.toolResults);
        if (m?.role === 'assistant' && noContent && noTools) break;
        idx--;
      }
      if (idx < 0) {
        return { status: "noop", messages, version: previousVersion, previousVersion };
      }
    }

    const msg: any = { ...(messages[idx] as any) };
    if (typeof args.content === "string") {
      msg.content = args.content;
    }
    if (args.metadata) {
      msg.metadata = { ...(msg.metadata || {}), ...args.metadata };
    } else {
      // Ensure requestId is preserved on finalize
      msg.metadata = { ...(msg.metadata || {}), requestId: args.requestId };
    }

    messages[idx] = msg as ConvexMessage;
    const optimized = optimizeConversation(messages);

    await ctx.db.patch(conversation!._id, { messages: optimized, schemaVersion: 2 });
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now(), messageCount: optimized.length });

    return { status: "appended", messages: optimized, version: optimized.length, previousVersion };
  },
});

// Helpers for dedupe during updates
function dedupeToolCallsForUpdate(calls: Array<{ name: string; args: any; toolCallId: string }>) {
  const map = new Map<string, { name: string; args: any; toolCallId: string }>();
  for (const c of calls) {
    const existing = map.get(c.toolCallId);
    if (!existing) {
      map.set(c.toolCallId, { name: c.name, args: c.args ?? {}, toolCallId: c.toolCallId });
    } else {
      const mergedArgs = (existing.args && Object.keys(existing.args).length) ? existing.args : (c.args ?? {});
      map.set(c.toolCallId, { name: existing.name || c.name, args: mergedArgs, toolCallId: c.toolCallId });
    }
  }
  return Array.from(map.values());
}

function dedupeToolResultsForUpdate(results: Array<{ toolCallId: string; toolName: string; result: any }>) {
  const map = new Map<string, { toolCallId: string; toolName: string; result: any }>();
  for (const r of results) {
    const existing = map.get(r.toolCallId);
    if (!existing) {
      map.set(r.toolCallId, r);
    } else {
      map.set(r.toolCallId, { toolCallId: r.toolCallId, toolName: existing.toolName || r.toolName, result: r.result ?? existing.result });
    }
  }
  return Array.from(map.values());
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
      console.log('🔒 [BACKEND DEBUG] No token identifier found for conversation query');
      return null;
    }

    if (!args.sessionId) {
      // No session provided, return null (will be handled by frontend)
      console.log('⚠️ [BACKEND DEBUG] No session ID provided for conversation query');
      return null;
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      if (ENABLE_DEBUG_LOGS) {
        console.log('🔒 [AUTH] Session not found or unauthorized:', { sessionId: args.sessionId });
      }
      return null; // Big-brain pattern: return null instead of throwing
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
      .first();

    // Apply schema migration if needed
    const migratedConversation = migrateConversationSchema(conversation);
    
    return migratedConversation;
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
        return migrateConversationSchema(conversation);
      }
    }

    // Fallback to any conversation by this user
    const fallbackConversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
      
    return migrateConversationSchema(fallbackConversation);
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

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .collect();
      
    // Apply schema migration to all conversations
    return conversations.map(conversation => migrateConversationSchema(conversation));
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
      mode: v.optional(v.string()),
      metadata: v.optional(v.object({
        mode: v.optional(v.string()),
        toolStates: v.optional(v.record(v.string(), v.union(v.literal("pending"), v.literal("running"), v.literal("completed")))),
        requestId: v.optional(v.string()),
        delegation: v.optional(v.object({
          target: v.string(),
          status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
          reason: v.optional(v.string()),
        })),
      })),
    })),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);
    
    console.log('💾 [BACKEND DEBUG] Upserting conversation:', {
      sessionId: args.sessionId,
      messageCount: args.messages.length,
      tokenIdentifier: tokenIdentifier.substring(0, 20) + '...'
    });

    // Verify session belongs to user if sessionId is provided
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.tokenIdentifier !== tokenIdentifier) {
        console.log('🔒 [BACKEND DEBUG] Session not found or unauthorized for upsert:', {
          sessionId: args.sessionId,
          sessionExists: !!session,
          sessionTokenIdentifier: session?.tokenIdentifier,
          userTokenIdentifier: tokenIdentifier
        });
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

    const effectiveSessionId = args.sessionId!;
    const currentMode = ModeController.getCurrentMode(effectiveSessionId) || "primary";

    // Process messages to set mode on new assistant messages if missing
    const processedMessages = args.messages.map((msg) => {
      if (msg.role === "assistant" && !msg.mode) {
        logDebug(`[MESSAGE] Set mode ${currentMode} for assistant message in ${effectiveSessionId}`);
        return {
          ...msg,
          mode: currentMode,
        };
      }
      return msg;
    });

    const now = Date.now();
    
    if (conversation) {
      // Update existing conversation
      console.log('🔄 [BACKEND DEBUG] Updating existing conversation:', {
        conversationId: conversation._id,
        messageCount: processedMessages.length,
        messagesPreview: processedMessages.slice(-2).map(msg => ({
          role: msg.role,
          contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : '[structured content]'
        }))
      });
      
      await ctx.db.patch(conversation._id, {
        messages: processedMessages,
        schemaVersion: 2,
      });
      
      // ChatHub pattern: Update session timestamp when messages change
      if (args.sessionId) {
        await ctx.db.patch(args.sessionId, {
          lastMessageAt: now,
          messageCount: args.messages.length,
        });
      }
      
      console.log('✅ [BACKEND DEBUG] Conversation updated successfully');
      return conversation._id;
    } else {
      // Create new conversation
      console.log('➕ [BACKEND DEBUG] Creating new conversation:', {
        sessionId: args.sessionId,
        messageCount: args.messages.length,
        messagesPreview: args.messages.slice(-2).map(msg => ({
          role: msg.role,
          contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : '[structured content]'
        }))
      });
      
      const conversationId = await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages: processedMessages,
        schemaVersion: 2,
      });
      
      // ChatHub pattern: Update session timestamp when messages change
      if (args.sessionId) {
        await ctx.db.patch(args.sessionId, {
          lastMessageAt: now,
          messageCount: processedMessages.length,
        });
      }
      
      console.log('✅ [BACKEND DEBUG] New conversation created successfully:', conversationId);
      return conversationId;
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

    const now = Date.now();
    
    const conversationId = await ctx.db.insert("conversations", {
      tokenIdentifier,
      sessionId: args.sessionId,
      message: args.message,
      response: args.response,
      timestamp: now,
      toolCalls: args.toolCalls,
      schemaVersion: 1, // Legacy schema version
    });
    
    // ChatHub pattern: Update session timestamp when messages change
    if (args.sessionId) {
      await ctx.db.patch(args.sessionId, {
        lastMessageAt: now,
        messageCount: args.response ? 2 : 1, // User message + optional assistant response
      });
    }
    
    return conversationId;
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
    
    // ChatHub pattern: Update session timestamp when conversation is updated
    if (conversation.sessionId && (args.response || args.toolCalls)) {
      const now = Date.now();
      await ctx.db.patch(conversation.sessionId, {
        lastMessageAt: now,
      });
    }
    
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

    // Batch delete all conversations in parallel
    await Promise.all(
      conversations.map(conversation => ctx.db.delete(conversation._id))
    );

    return { deletedConversations: conversations.length };
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

    // Batch delete all conversations for this session in parallel
    await Promise.all(
      conversations.map(conversation => ctx.db.delete(conversation._id))
    );

    return { deletedConversations: conversations.length };
  },
});

// Add synthetic message for primary mode switching (like OpenCode prompt injection)
export const addSyntheticMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.tokenIdentifier !== tokenIdentifier) {
      throw new ConvexError("Chat session not found or unauthorized");
    }

    // Find or create conversation for this session
    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
      .first();

    if (!conversation) {
      // Create new conversation
      const conversationId = await ctx.db.insert("conversations", {
        tokenIdentifier,
        sessionId: args.sessionId,
        messages: [],
        schemaVersion: 2,
      });
      conversation = await ctx.db.get(conversationId);
    }

    // Add synthetic system message (like OpenCode's prompt injection)
    const syntheticMessage = {
      role: "system" as const,
      content: args.content,
      timestamp: args.timestamp,
    };

    const currentMessages = conversation?.messages || [];
    const updatedMessages = [...currentMessages, syntheticMessage];

    await ctx.db.patch(conversation!._id, {
      messages: updatedMessages,
    });

    return { success: true, messageAdded: syntheticMessage };
  },
});

function resolveMode(sessionId: Id<"chatSessions">, session: any): string {
  return (
    ModeController.getCurrentMode(sessionId) ||
    session?.activeMode ||
    session?.primaryMode ||
    "primary"
  );
}

function shouldAppendMessage(history: ConvexMessage[], candidate: ConvexMessage): boolean {
  if (history.length === 0) {
    return true;
  }

  const last = history[history.length - 1];
  return !(last.role === candidate.role && last.content === candidate.content);
}