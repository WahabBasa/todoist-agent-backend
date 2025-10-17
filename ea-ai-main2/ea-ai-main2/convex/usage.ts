import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get the first millisecond of the current month in UTC
function getMonthStartUTC(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
}

export const getMonthlyTotal = query({
  args: {
    tokenIdentifier: v.string(),
    monthStart: v.optional(v.number()),
  },
  handler: async (ctx, { tokenIdentifier, monthStart }) => {
    const start = monthStart ?? getMonthStartUTC(Date.now());
    // Scan usageEvents for this user since monthStart and sum totalTokens
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_tokenIdentifier_and_ts", (q) => q.eq("tokenIdentifier", tokenIdentifier).gte("ts", start))
      .collect();
    return events.reduce((acc, e) => acc + (e.totalTokens || 0), 0);
  },
});

export const getMonthlyCap = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    // Per-user override
    const override = await ctx.db
      .query("usageQuotas")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
    if (override?.monthlyTokenCap && override.monthlyTokenCap > 0) {
      return override.monthlyTokenCap;
    }
    // Default hard cap: 1,000,000 tokens per user per month
    return 1_000_000;
  },
});

export const recordEvent = mutation({
  args: {
    tokenIdentifier: v.string(),
    ts: v.number(),
    reqId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageEvents", args as any);
    return { ok: true };
  },
});
