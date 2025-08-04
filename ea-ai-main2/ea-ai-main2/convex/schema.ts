import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.number(), // 1-4, 1 being highest priority
    dueDate: v.optional(v.number()),
    estimatedTime: v.optional(v.number()), // in minutes
    isCompleted: v.boolean(),
    tags: v.array(v.string()),
    isRecurring: v.boolean(),
    recurringPattern: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "isCompleted"])
    .index("by_project", ["projectId"]),

  conversations: defineTable({
    userId: v.id("users"),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      timestamp: v.number(),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        args: v.any(),
        result: v.any(),
      }))),
    })),
  }).index("by_user", ["userId"]),
};

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  ...applicationTables,
});
