import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Clerk-compatible users table
const clerkTables = {
  users: defineTable({
    name: v.string(),
    // This is the Clerk ID, stored in the subject JWT field
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),
};

const applicationTables = {
  projects: defineTable({
    userId: v.union(v.id("users"), v.null()),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.union(v.literal("user"), v.literal("system")),
  }).index("by_user", ["userId"]),

  labels: defineTable({
    userId: v.union(v.id("users"), v.null()),
    name: v.string(),
    type: v.union(v.literal("user"), v.literal("system")),
  }).index("by_user", ["userId"]),

  // Chat Sessions - Multiple conversations per user (Morphic-style)
  chatSessions: defineTable({
    userId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    isDefault: v.optional(v.boolean()), // Mark the default chat session
  }).index("by_user", ["userId"])
    .index("by_user_and_time", ["userId", "lastMessageAt"])
    .index("by_user_and_default", ["userId", "isDefault"]),

  tasks: defineTable({
    userId: v.id("users"),
    // TodoVex compatibility fields
    taskName: v.string(),
    labelId: v.optional(v.id("labels")),
    // Legacy field mapping (keep for migration)
    title: v.optional(v.string()),
    // Standard fields
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.float64()), // Changed to float64 for TodoVex compatibility
    dueDate: v.optional(v.number()),
    isCompleted: v.boolean(),
    // AI-specific fields (preserved)
    estimatedTime: v.optional(v.number()), // in minutes
    tags: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "isCompleted"])
    .index("by_project", ["projectId"]),

  subTodos: defineTable({
    userId: v.id("users"),
    parentId: v.id("tasks"),
    taskName: v.string(),
    description: v.optional(v.string()),
    projectId: v.id("projects"),
    labelId: v.id("labels"),
    priority: v.optional(v.float64()),
    dueDate: v.number(),
    isCompleted: v.boolean(),
  }).index("by_user", ["userId"])
    .index("by_parent", ["parentId"]),

  conversations: defineTable({
    userId: v.id("users"),
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
  }).index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_user_and_session", ["userId", "sessionId"]),

  numbers: defineTable({
    value: v.number(),
  }),

  // Todoist API Integration
  todoistTokens: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Google Calendar Scheduling System (based on Calendly clone)
  events: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    durationInMinutes: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_and_active", ["userId", "isActive"]),

  schedules: defineTable({
    userId: v.id("users"),
    timezone: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  scheduleAvailabilities: defineTable({
    scheduleId: v.id("schedules"),
    dayOfWeek: v.union(
      v.literal("monday"),
      v.literal("tuesday"), 
      v.literal("wednesday"),
      v.literal("thursday"),
      v.literal("friday"),
      v.literal("saturday"),
      v.literal("sunday")
    ),
    startTime: v.string(), // "09:00" format
    endTime: v.string(),   // "17:00" format
  }).index("by_schedule", ["scheduleId"])
    .index("by_schedule_and_day", ["scheduleId", "dayOfWeek"]),

  meetings: defineTable({
    eventId: v.id("events"),
    hostUserId: v.id("users"),
    guestName: v.string(),
    guestEmail: v.string(),
    guestNotes: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    timezone: v.string(),
    googleCalendarEventId: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_event", ["eventId"])
    .index("by_host", ["hostUserId"])
    .index("by_guest_email", ["guestEmail"])
    .index("by_status", ["status"])
    .index("by_start_time", ["startTime"]),

};

// Export schema with Clerk users table and application tables
export default defineSchema({
  ...clerkTables,
  ...applicationTables,
});