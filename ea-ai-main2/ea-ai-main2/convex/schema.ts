import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Big-brain pattern: Use tokenIdentifier directly, no users table needed
const applicationTables = {
  // Chat Sessions - Multiple conversations per user (Morphic-style) with Primary Mode + Subagent Support
  chatSessions: defineTable({
    tokenIdentifier: v.string(),
    title: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    isDefault: v.optional(v.boolean()), // Mark the default chat session
    
    // NEW: Session type - primary conversation or subagent execution
    sessionType: v.optional(v.union(
      v.literal("primary"),    // Primary conversation (preserves context)
      v.literal("subagent")    // Subagent execution (isolated)
    )),
    
    // Primary mode system (for sessions that preserve context)
    primaryMode: v.optional(v.union(
      v.literal("primary"), 
      v.literal("information-collector")
    )), // Which primary mode is active (context-preserving)
    
    // Subagent system (for isolated executions)
    subagentType: v.optional(v.string()), // Name of subagent (planning, execution, general, custom)
    
    // Session hierarchy support (for subagent isolation)
    parentSessionId: v.optional(v.id("chatSessions")), // Parent session for subagent executions
    delegationContext: v.optional(v.object({
      delegatedTask: v.string(), // Original task that was delegated
      delegationType: v.union(v.literal("primary-mode"), v.literal("subagent")), // Type of delegation
      targetName: v.string(), // Target mode or subagent name
      createdAt: v.number(), // When delegation was created
      status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
      result: v.optional(v.string()), // Final result from delegation
    })),
    
    // --- Legacy fields for migration ---
    modeType: v.optional(v.union(
      v.literal("primary"), 
      v.literal("information-collector"), 
      v.literal("planning"), 
      v.literal("execution")
    )), // Old mode type field
    modeName: v.optional(v.string()), // Old mode name field
    agentMode: v.optional(v.string()), // Legacy agent mode field
    agentName: v.optional(v.string()), // Legacy agent name field
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_tokenIdentifier_and_time", ["tokenIdentifier", "lastMessageAt"])
    .index("by_tokenIdentifier_and_default", ["tokenIdentifier", "isDefault"])
    .index("by_tokenIdentifier_default_time", ["tokenIdentifier", "isDefault", "lastMessageAt"])
    .index("by_parent_session", ["parentSessionId"])
    .index("by_session_type", ["sessionType"])
    .index("by_tokenIdentifier_and_session_type", ["tokenIdentifier", "sessionType"])
    .index("by_primary_mode", ["primaryMode"])
    .index("by_subagent_type", ["subagentType"])
    .index("by_tokenIdentifier_and_primary_mode", ["tokenIdentifier", "primaryMode"])
    .index("by_tokenIdentifier_and_subagent", ["tokenIdentifier", "subagentType"])
    // Legacy indexes for migration
    .index("by_mode_type", ["modeType"])
    .index("by_tokenIdentifier_and_mode", ["tokenIdentifier", "modeName"]),

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

  // AI Mode Internal Todos - Session-scoped task management for complex workflows
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


};

// Export schema with tokenIdentifier-based tables (big-brain pattern)
export default defineSchema({
  ...applicationTables,
});