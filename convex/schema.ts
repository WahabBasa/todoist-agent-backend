import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    password: v.string(), // In production, this would be hashed
    firstName: v.string(),
    lastName: v.string(),
    todoistToken: v.string(),
    preferences: v.object({
      timezone: v.string(),
      defaultProject: v.optional(v.string())
    })
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  conversations: defineTable({
    userId: v.string(),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.any()))
  }).index("by_user", ["userId"])
});