import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getConversation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

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

    const message = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      toolCalls: args.toolCalls,
    };

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingConversation) {
      const currentMessages = existingConversation.messages || [];
      await ctx.db.patch(existingConversation._id, {
        messages: [...currentMessages, message],
      });
      return existingConversation._id;
    } else {
      return await ctx.db.insert("conversations", {
        userId,
        messages: [message],
      });
    }
  },
});

export const updateConversation = mutation({
  args: {
    // This validator now correctly matches the updated schema
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
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, { messages: args.messages });
    } else {
      await ctx.db.insert("conversations", { userId, messages: args.messages });
    }
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
      throw new Error("Not authenticated");
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