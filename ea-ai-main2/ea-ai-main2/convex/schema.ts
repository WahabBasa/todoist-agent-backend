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
    .index("by_tokenIdentifier_and_default", ["tokenIdentifier", "isDefault"])
    .index("by_tokenIdentifier_default_time", ["tokenIdentifier", "isDefault", "lastMessageAt"]),

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
    .index("by_active", ["isActive"])
    .index("by_tokenIdentifier_and_active", ["tokenIdentifier", "isActive"])
    .index("by_tokenIdentifier_session_active", ["tokenIdentifier", "sessionId", "isActive"]),

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

  // Custom System Prompts - User-defined system prompts for AI personalization
  customSystemPrompts: defineTable({
    tokenIdentifier: v.string(), // User identifier (follows big-brain pattern)
    name: v.string(), // Prompt name (e.g., "coding-assistant", "creative-writer")
    content: v.string(), // The custom system prompt content
    version: v.number(), // Version number for tracking updates
    isActive: v.boolean(), // Track if this is the current active custom prompt
    isDefault: v.boolean(), // Whether this is the user's default prompt
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_tokenIdentifier_and_active", ["tokenIdentifier", "isActive"])
    .index("by_tokenIdentifier_and_default", ["tokenIdentifier", "isDefault"])
    .index("by_tokenIdentifier_and_name", ["tokenIdentifier", "name"]),

  // AI Caching System - Database-backed caching for consistent request payloads
  // Replaces in-memory Maps to enable Anthropic ephemeral caching in stateless environment
  aiCache: defineTable({
    cacheKey: v.string(), // Unique cache key for the cached content
    cacheType: v.union(
      v.literal("mental_model"), 
      v.literal("custom_prompt"), 
      v.literal("system_prompt"),
      v.literal("tool_result"),
      v.literal("request_payload")
    ),
    tokenIdentifier: v.string(), // User identifier for user-specific caches
    sessionId: v.optional(v.string()), // Session identifier for session-specific caches
    content: v.string(), // The cached content (JSON string for complex objects)
    contentHash: v.string(), // SHA-256 hash of content for fast comparison
    metadata: v.optional(v.object({
      promptName: v.optional(v.string()),
      toolName: v.optional(v.string()),
      args: v.optional(v.any()),
      contextLength: v.optional(v.number()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(), // TTL for cache expiration
    hitCount: v.number(), // Track cache usage for analytics
  }).index("by_cache_key", ["cacheKey"])
    .index("by_type_and_user", ["cacheType", "tokenIdentifier"])
    .index("by_type_user_session", ["cacheType", "tokenIdentifier", "sessionId"])
    .index("by_expiration", ["expiresAt"])
    .index("by_user_and_type", ["tokenIdentifier", "cacheType"])
    .index("by_content_hash", ["contentHash"]),

  // Request Deduplication - Prevent identical requests in short timeframes
  requestDeduplication: defineTable({
    requestHash: v.string(), // SHA-256 hash of request payload
    tokenIdentifier: v.string(), // User identifier
    sessionId: v.optional(v.string()), // Session identifier
    messageText: v.string(), // Original user message (for debugging)
    responseId: v.optional(v.string()), // ID of the cached response
    createdAt: v.number(),
    expiresAt: v.number(), // Short TTL (5 minutes)
  }).index("by_request_hash", ["requestHash"])
    .index("by_user_and_hash", ["tokenIdentifier", "requestHash"])
    .index("by_expiration", ["expiresAt"]),

  // Cache Analytics - Track caching performance and effectiveness
  cacheAnalytics: defineTable({
    tokenIdentifier: v.string(), // User identifier
    date: v.string(), // Date in YYYY-MM-DD format
    cacheHits: v.number(),
    cacheMisses: v.number(),
    mentalModelHits: v.number(),
    customPromptHits: v.number(),
    toolCallHits: v.number(),
    requestPayloadHits: v.number(),
    totalRequests: v.number(),
    tokensSaved: v.number(), // Estimated tokens saved from caching
    lastUpdated: v.number(),
  }).index("by_user_and_date", ["tokenIdentifier", "date"])
    .index("by_date", ["date"]),

};

// Export schema with tokenIdentifier-based tables (big-brain pattern)
export default defineSchema({
  ...applicationTables,
});