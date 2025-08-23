import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const addUserIdToOrg = internalMutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
  async handler(ctx, { userId, orgId }) {
    // Check if membership already exists
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        userId,
        orgId,
        createdAt: Date.now(),
      });
    }
  },
});

export const removeUserIdFromOrg = internalMutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
  async handler(ctx, { userId, orgId }) {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .unique();

    if (membership) {
      await ctx.db.delete(membership._id);
    }
  },
});