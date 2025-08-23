import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get conversation for specific session (new multi-chat approach)
export const getConversationBySession = query({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    if (!args.sessionId) {
      // No session provided, return null (will be handled by frontend)
      return null;
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_user_and_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId))
      .first();
  },
});

// Legacy function - get default conversation (backward compatibility)
export const getConversation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Try to get conversation for default session first
    const defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_default", (q) => 
        q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (defaultSession) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_user_and_session", (q) => 
          q.eq("userId", userId).eq("sessionId", defaultSession._id))
        .first();
      
      if (conversation) {
        return conversation;
      }
    }

    // Fallback to legacy behavior for migration
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("sessionId"), undefined))
      .first();
  },
});

// Add message to specific session
export const addMessageToSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      args: v.any(),
      toolCallId: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      toolCalls: args.toolCalls,
    };

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existingConversation) {
      const currentMessages = existingConversation.messages || [];
      await ctx.db.patch(existingConversation._id, {
        messages: [...currentMessages, message],
      });

      // Update session metadata
      await ctx.db.patch(args.sessionId, {
        lastMessageAt: now,
        messageCount: currentMessages.length + 1,
      });

      return existingConversation._id;
    } else {
      const conversationId = await ctx.db.insert("conversations", {
        userId,
        sessionId: args.sessionId,
        messages: [message],
      });

      // Update session metadata
      await ctx.db.patch(args.sessionId, {
        lastMessageAt: now,
        messageCount: 1,
      });

      return conversationId;
    }
  },
});

// Legacy function - add message to default session (backward compatibility)
export const addMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      args: v.any(),
      toolCallId: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get or create default session
    let defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_default", (q) => 
        q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (!defaultSession) {
      const now = Date.now();
      const sessionId = await ctx.db.insert("chatSessions", {
        userId,
        title: "Default Chat",
        createdAt: now,
        lastMessageAt: now,
        messageCount: 0,
        isDefault: true,
      });
      defaultSession = await ctx.db.get(sessionId);
    }

    if (!defaultSession) {
      throw new Error("Failed to create default session");
    }

    // Implement the logic directly instead of calling another mutation
    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      toolCalls: args.toolCalls,
    };

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_session", (q) => 
        q.eq("userId", userId).eq("sessionId", defaultSession._id))
      .first();

    const now = Date.now();

    if (existingConversation) {
      const currentMessages = existingConversation.messages || [];
      await ctx.db.patch(existingConversation._id, {
        messages: [...currentMessages, message],
      });

      // Update session metadata
      await ctx.db.patch(defaultSession._id, {
        lastMessageAt: now,
        messageCount: currentMessages.length + 1,
      });

      return existingConversation._id;
    } else {
      const conversationId = await ctx.db.insert("conversations", {
        userId,
        sessionId: defaultSession._id,
        messages: [message],
      });

      // Update session metadata
      await ctx.db.patch(defaultSession._id, {
        lastMessageAt: now,
        messageCount: 1,
      });

      return conversationId;
    }
  },
});

// Update conversation for specific session
export const updateConversationBySession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool")),
      content: v.optional(v.string()),
      timestamp: v.number(),
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
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found or unauthorized");
    }

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_session", (q) => 
        q.eq("userId", userId).eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, { messages: args.messages });
    } else {
      await ctx.db.insert("conversations", { 
        userId, 
        sessionId: args.sessionId,
        messages: args.messages 
      });
    }

    // Update session metadata
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      messageCount: args.messages.length,
    });

    return true;
  },
});

// Legacy function - update default conversation (backward compatibility)
export const updateConversation = mutation({
  args: {
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool")),
      content: v.optional(v.string()),
      timestamp: v.number(),
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
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get or create default session
    let defaultSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_and_default", (q) => 
        q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (!defaultSession) {
      const now = Date.now();
      const sessionId = await ctx.db.insert("chatSessions", {
        userId,
        title: "Default Chat",
        createdAt: now,
        lastMessageAt: now,
        messageCount: 0,
        isDefault: true,
      });
      defaultSession = await ctx.db.get(sessionId);
    }

    if (!defaultSession) {
      throw new Error("Failed to create default session");
    }

    // Implement the logic directly instead of calling another mutation
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_session", (q) => 
        q.eq("userId", userId).eq("sessionId", defaultSession._id))
      .first();

    const now = Date.now();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, { messages: args.messages });
    } else {
      await ctx.db.insert("conversations", { 
        userId, 
        sessionId: defaultSession._id,
        messages: args.messages 
      });
    }

    // Update session metadata
    await ctx.db.patch(defaultSession._id, {
      lastMessageAt: now,
      messageCount: args.messages.length,
    });

    return true;
  },
});


export const clearConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (conversation) {
      await ctx.db.delete(conversation._id);
    }

    return true;
  },
});

export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!conversation) {
      return [];
    }

    const messages = conversation.messages || [];
    
    if (args.limit && args.limit > 0) {
      return messages.slice(-args.limit);
    }

    return messages;
  },
});

// Data migration mutation for legacy conversation format
export const migrateConversationData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    console.log("Starting conversation data migration...");
    
    // Get all conversations for this user
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let migratedCount = 0;
    let alreadyMigratedCount = 0;

    for (const conversation of conversations) {
      // Check if this conversation has legacy format (has 'message' field)
      const hasLegacyFormat = conversation.message !== undefined;
      
      // Check if already migrated
      if (conversation.schemaVersion === 2) {
        alreadyMigratedCount++;
        continue;
      }

      if (hasLegacyFormat) {
        console.log(`Migrating conversation ${conversation._id} from legacy format`);
        
        // Transform legacy format to new format
        const messages = [];
        
        // Add user message
        if (conversation.message) {
          messages.push({
            role: "user" as const,
            content: conversation.message,
            timestamp: conversation.timestamp || Date.now(),
          });
        }
        
        // Add assistant response
        if (conversation.response) {
          const assistantMessage: any = {
            role: "assistant" as const,
            content: conversation.response,
            timestamp: (conversation.timestamp || Date.now()) + 1000, // Slightly later
          };
          
          // Preserve toolCalls if they exist
          if (conversation.toolCalls && conversation.toolCalls.length > 0) {
            assistantMessage.toolCalls = conversation.toolCalls;
          }
          
          messages.push(assistantMessage);
        }
        
        // Update the conversation with new format and remove legacy fields
        await ctx.db.patch(conversation._id, {
          messages,
          schemaVersion: 2,
          // Remove legacy fields
          message: undefined,
          response: undefined,
          timestamp: undefined,
          toolCalls: undefined,
        });
        
        migratedCount++;
        console.log(`Successfully migrated conversation ${conversation._id}`);
      } else if (conversation.messages && conversation.messages.length > 0) {
        // Already has new format, just mark as migrated
        await ctx.db.patch(conversation._id, {
          schemaVersion: 2,
        });
        alreadyMigratedCount++;
      }
    }

    const result = {
      totalConversations: conversations.length,
      migratedCount,
      alreadyMigratedCount,
      status: "completed"
    };
    
    console.log("Migration completed:", result);
    return result;
  },
});

// Helper query to check migration status
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const legacyCount = conversations.filter(c => c.message !== undefined).length;
    const migratedCount = conversations.filter(c => c.schemaVersion === 2).length;
    const totalCount = conversations.length;

    return {
      totalConversations: totalCount,
      legacyConversations: legacyCount,
      migratedConversations: migratedCount,
      needsMigration: legacyCount > 0,
    };
  },
});