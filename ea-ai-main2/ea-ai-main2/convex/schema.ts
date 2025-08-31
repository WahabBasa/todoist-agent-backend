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

  // Google Calendar integration now uses Clerk OAuth tokens directly
  // No database storage needed - Clerk manages all token lifecycle

  // AI Agent Internal Todos - Session-scoped task management for complex workflows
  aiInternalTodos: defineTable({
    tokenIdentifier: v.string(), // User identifier (follows big-brain pattern)
    sessionId: v.optional(v.id("chatSessions")), // Link to chat session
    todos: v.array(v.object({
      id: v.string(), // Unique identifier for the todo item
      content: v.string(), // Brief description of the task
      status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")), // Current status of the task
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")), // Priority level of the task
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(), // Track active todolist state
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_session", ["sessionId"])
    .index("by_tokenIdentifier_and_session", ["tokenIdentifier", "sessionId"])
    .index("by_active", ["isActive"]),

  // User Mental Models - AI learning about user behavioral patterns and preferences
  mentalModels: defineTable({
    tokenIdentifier: v.string(), // User identifier (follows big-brain pattern)
    content: v.string(), // The mental model content (behavioral patterns, preferences, etc.)
    version: v.number(), // Version number for tracking updates
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(), // Track if this is the current active mental model
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_tokenIdentifier_and_active", ["tokenIdentifier", "isActive"]),

  // Streaming Responses - Real-time progressive text generation tracking
  streamingResponses: defineTable({
    streamId: v.string(), // Unique identifier for this streaming session
    tokenIdentifier: v.string(), // User identifier (follows big-brain pattern)
    sessionId: v.optional(v.id("chatSessions")), // Link to chat session
    partialContent: v.string(), // Accumulated text content so far
    isComplete: v.boolean(), // Whether streaming is finished
    status: v.union(v.literal("streaming"), v.literal("complete"), v.literal("error")), // Current stream status
    userMessage: v.optional(v.string()), // Original user message that triggered this stream
    toolCalls: v.optional(v.array(v.any())), // Tool calls if any were executed
    toolResults: v.optional(v.array(v.any())), // Tool results if any were generated
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_streamId", ["streamId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_session", ["sessionId"])
    .index("by_tokenIdentifier_and_session", ["tokenIdentifier", "sessionId"])
    .index("by_status", ["status"]),

};

// Export schema with tokenIdentifier-based tables (big-brain pattern)
export default defineSchema({
  ...applicationTables,
});