import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Big-brain pattern: Use tokenIdentifier directly, no users table needed
const applicationTables = {
  // Chat Sessions - Multiple conversations per user (Morphic-style)
  chatSessions: defineTable({
    tokenIdentifier: v.string(),
    title: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    isDefault: v.optional(v.boolean()), // Mark the default chat session
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_tokenIdentifier_and_time", ["tokenIdentifier", "lastMessageAt"])
    .index("by_tokenIdentifier_and_default", ["tokenIdentifier", "isDefault"]),

  conversations: defineTable({
    tokenIdentifier: v.string(),
    sessionId: v.optional(v.id("chatSessions")), // Link to chat session
    // New schema - messages array
    messages: v.optional(v.array(v.object({
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
    }))),
    // Legacy schema - temporary optional fields for migration
    message: v.optional(v.string()),
    response: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    toolCalls: v.optional(v.array(v.any())),
    // Migration tracking
    schemaVersion: v.optional(v.number()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_session", ["sessionId"])
    .index("by_tokenIdentifier_and_session", ["tokenIdentifier", "sessionId"]),

  // Todoist API Integration
  todoistTokens: defineTable({
    tokenIdentifier: v.string(), // Required - Clerk tokenIdentifier
    accessToken: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  // Google Calendar API Integration
  googleCalendarTokens: defineTable({
    tokenIdentifier: v.string(), // Required - Clerk tokenIdentifier
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(), // Token expiration timestamp
    scope: v.string(), // OAuth scopes granted
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

};

// Export schema with tokenIdentifier-based tables (big-brain pattern)
export default defineSchema({
  ...applicationTables,
});