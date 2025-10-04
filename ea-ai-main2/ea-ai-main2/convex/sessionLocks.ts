import { mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_TTL_MS = 15_000;

export const acquireSessionLock = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    requestId: v.string(),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttlMs = Math.max(args.ttlMs ?? DEFAULT_TTL_MS, 1_000);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const existing = await ctx.db
      .query("sessionLocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!existing) {
      await ctx.db.insert("sessionLocks", {
        sessionId: args.sessionId,
        requestId: args.requestId,
        expiresAt,
      });
      return { status: "acquired" as const, expiresAt };
    }

    if (existing.requestId === args.requestId) {
      await ctx.db.patch(existing._id, { expiresAt });
      return { status: "renewed" as const, expiresAt };
    }

    if (existing.expiresAt <= now) {
      await ctx.db.patch(existing._id, {
        requestId: args.requestId,
        expiresAt,
      });
      return { status: "acquired" as const, expiresAt };
    }

    return {
      status: "busy" as const,
      ownerRequestId: existing.requestId,
      expiresAt: existing.expiresAt,
    };
  },
});

export const releaseSessionLock = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessionLocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!existing) {
      return { status: "missing" as const };
    }

    if (existing.requestId !== args.requestId) {
      if (existing.expiresAt <= Date.now()) {
        await ctx.db.delete(existing._id);
        return { status: "expired" as const };
      }
      return {
        status: "not_owner" as const,
        ownerRequestId: existing.requestId,
      };
    }

    await ctx.db.delete(existing._id);
    return { status: "released" as const };
  },
});
