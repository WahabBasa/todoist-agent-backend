import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.optional(v.string()), // Clerk user ID - optional during migration
    firebaseUid: v.optional(v.string()), // Firebase UID - keeping for migration
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    todoistToken: v.optional(v.string()),
    todayViewText: v.optional(v.string()),
    preferences: v.object({
      timezone: v.optional(v.string()),
      defaultProject: v.optional(v.string())
    })
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_firebase_uid", ["firebaseUid"])
    .index("by_email", ["email"]),

  conversations: defineTable({
    userId: v.string(),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.any()))
  }).index("by_user", ["userId"]),

  userActivity: defineTable({
    userId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    totalMessages: v.number(),
    totalToolCalls: v.number(),
    lastActiveAt: v.number(),
    todosCreated: v.number(),
    todosCompleted: v.number(),
    todosUpdated: v.number(),
    todosDeleted: v.number(),
    preferredModel: v.optional(v.string()),
    dailyUsage: v.object({
      date: v.string(), // YYYY-MM-DD
      messageCount: v.number(),
      toolCallCount: v.number()
    })
  }).index("by_user", ["userId"])
    .index("by_last_active", ["lastActiveAt"])
});