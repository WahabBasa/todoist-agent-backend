import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getLabels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userLabels = await ctx.db
      .query("labels")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const systemLabels = await ctx.db
      .query("labels")
      .filter((q) => q.eq(q.field("type"), "system"))
      .collect();

    return [...systemLabels, ...userLabels];
  },
});

export const getLabelById = query({
  args: {
    labelId: v.id("labels"),
  },
  handler: async (ctx, { labelId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const label = await ctx.db.get(labelId);
    if (!label) {
      return null;
    }

    // Allow access to system labels or user's own labels
    if (label.type === "system" || label.userId === userId) {
      return label;
    }

    return null;
  },
});

export const createLabel = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if label already exists for this user
    const existingLabel = await ctx.db
      .query("labels")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existingLabel) {
      throw new Error("Label already exists");
    }

    const newLabelId = await ctx.db.insert("labels", {
      userId,
      name,
      type: "user",
    });

    return newLabelId;
  },
});

export const updateLabel = mutation({
  args: {
    labelId: v.id("labels"),
    name: v.string(),
  },
  handler: async (ctx, { labelId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const label = await ctx.db.get(labelId);
    if (!label || label.userId !== userId || label.type === "system") {
      throw new Error("Label not found or unauthorized");
    }

    await ctx.db.patch(labelId, { name });
    return labelId;
  },
});

export const deleteLabel = mutation({
  args: {
    labelId: v.id("labels"),
  },
  handler: async (ctx, { labelId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const label = await ctx.db.get(labelId);
    if (!label || label.userId !== userId || label.type === "system") {
      throw new Error("Label not found or unauthorized");
    }

    await ctx.db.delete(labelId);
    return labelId;
  },
});

// Helper function to create default system labels
export const createSystemLabels = mutation({
  args: {},
  handler: async (ctx) => {
    const systemLabels = [
      { name: "Personal", type: "system" as const },
      { name: "Work", type: "system" as const },
      { name: "Important", type: "system" as const },
      { name: "Urgent", type: "system" as const },
    ];

    const labelIds = [];
    for (const labelData of systemLabels) {
      // Check if system label already exists
      const existing = await ctx.db
        .query("labels")
        .filter((q) => q.eq(q.field("name"), labelData.name))
        .filter((q) => q.eq(q.field("type"), "system"))
        .first();

      if (!existing) {
        const labelId = await ctx.db.insert("labels", {
          userId: null,
          name: labelData.name,
          type: labelData.type,
        });
        labelIds.push(labelId);
      }
    }

    return labelIds;
  },
});