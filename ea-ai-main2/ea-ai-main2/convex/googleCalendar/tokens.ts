import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireUserAuth } from "../todoist/userAccess";

// Query: fetch stored Google Calendar refresh token for current user
export const getRefreshToken = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    const row = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    return row?.refreshToken || null;
  },
});

// Mutation: upsert Google Calendar refresh token for a user (by tokenIdentifier)
export const storeGoogleCalendarRefreshToken = mutation({
  args: { tokenIdentifier: v.string(), refreshToken: v.string(), scope: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, { tokenIdentifier, refreshToken, scope }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { refreshToken, scope, updatedAt: now });
    } else {
      await ctx.db.insert("googleCalendarTokens", { tokenIdentifier, refreshToken, scope, createdAt: now, updatedAt: now });
    }
    return true;
  },
});

// Mutation: delete the current user's stored Google Calendar refresh token
export const deleteGoogleCalendarToken = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return false;
    const existing = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

// Settings: get whether Google Calendar is enabled for current user
export const getGoogleCalendarEnabled = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    const row = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    return !!row?.enabled;
  },
});

// Settings: set enabled flag for Google Calendar (soft connect/disconnect)
export const setGoogleCalendarEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx: MutationCtx, { enabled }) => {
    const identity = await ctx.auth.getUserIdentity();
    const tokenIdentifier = identity?.tokenIdentifier;
    if (!tokenIdentifier) return false;
    const now = Date.now();
    const existing = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: now });
    } else {
      await ctx.db.insert("googleCalendarSettings", { tokenIdentifier, enabled, createdAt: now, updatedAt: now });
    }
    return true;
  },
});
