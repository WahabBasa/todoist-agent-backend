import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { ModeController } from "./ai/modes/controller";
import { logDebug } from "./ai/logger";
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

// Helper function for schema migration: Convert legacy format to new format
function migrateConversationSchema(conversation: any) {
  console.log('🔄 [BACKEND DEBUG] Checking conversation schema migration:', {
    conversationExists: !!conversation,
    hasSchemaVersion: !!conversation?.schemaVersion,
    schemaVersion: conversation?.schemaVersion,
    hasMessages: !!conversation?.messages,
    hasMessage: !!conversation?.message
  });
  
  if (!conversation) {
    console.log('⚠️ [BACKEND DEBUG] No conversation to migrate');
    return null;
  }
  
  // If already migrated or has new format, return as-is
  if (conversation.schemaVersion === 2 || conversation.messages) {
    console.log('✅ [BACKEND DEBUG] Conversation already in new format, no migration needed');
    return conversation;
  }
  
  // Legacy format detected - convert to new format
  if (conversation.message) {
    console.log('🔄 [BACKEND DEBUG] Migrating legacy conversation format');
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
        timestamp: (conversation.timestamp || Date.now()) + 1, // Slightly after user message
      });
    }
    
    // Return conversation with migrated messages
    const result = {
      ...conversation,
      messages: migratedMessages,
      schemaVersion: 2,
    };
    
    console.log('✅ [BACKEND DEBUG] Migration completed:', {
      messageCount: result.messages.length,
      messagesPreview: result.messages.map((msg: any) => ({
        role: msg.role,
        contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : '[structured content]'
      }))
    });
    
    return result;
  }
  
  console.log('⚠️ [BACKEND DEBUG] Unknown conversation format, returning as-is');
  return conversation;
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
      console.log('🔒 [BACKEND DEBUG] Session not found or unauthorized:', {
        sessionId: args.sessionId,
        sessionExists: !!session,
        sessionTokenIdentifier: session?.tokenIdentifier,
        userTokenIdentifier: tokenIdentifier
      });
      return null; // Big-brain pattern: return null instead of throwing
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId))
      .first();
      
    console.log('📚 [BACKEND DEBUG] Fetched conversation from database:', {
      sessionId: args.sessionId,
      conversationExists: !!conversation,
      messageCount: conversation?.messages?.length || 0,
      messagesPreview: conversation?.messages?.slice(-2).map(msg => ({
        role: msg.role,
        contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : '[structured content]'
      })) || 'no messages'
    });

    // Apply schema migration if needed
    const migratedConversation = migrateConversationSchema(conversation);
    
    console.log('📚 [BACKEND DEBUG] Migrated conversation:', {
      originalExists: !!conversation,
      migratedExists: !!migratedConversation,
      messageCount: migratedConversation?.messages?.length || 0
    });
    
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