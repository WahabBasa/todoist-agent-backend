import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createUserProfile = mutation({
  args: {
    fullName: v.string(),
    preferredName: v.string(),
    occupation: v.optional(v.string()),
    preferredWorkingHours: v.optional(v.object({
      start: v.string(),
      end: v.string(),
      timezone: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if profile already exists (prevent duplicates)
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (existing) {
      throw new Error("Profile already exists. Use updateUserProfile instead.");
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      tokenIdentifier: identity.tokenIdentifier,
      fullName: args.fullName,
      preferredName: args.preferredName,
      occupation: args.occupation,
      preferredWorkingHours: args.preferredWorkingHours,
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    return profile;
  },
});

export const hasUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    return !!profile;
  },
});

export const updateUserProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    occupation: v.optional(v.string()),
    preferredWorkingHours: v.optional(v.object({
      start: v.string(),
      end: v.string(),
      timezone: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!existing) {
      throw new Error("Profile not found. Create profile first.");
    }

    // Build update object with only provided fields
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.preferredName !== undefined) updates.preferredName = args.preferredName;
    if (args.occupation !== undefined) updates.occupation = args.occupation;
    if (args.preferredWorkingHours !== undefined) updates.preferredWorkingHours = args.preferredWorkingHours;

    await ctx.db.patch(existing._id, updates);
    return existing._id;
  },
});
