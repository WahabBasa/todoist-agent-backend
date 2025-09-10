// Request deduplication system for preventing identical requests in short timeframes
// Part of the database-backed caching solution for stateless Convex environment

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { DatabaseCaching } from "./databaseCaching";

// Mutation: Store request hash for deduplication
export const storeRequestHash = mutation({
  args: {
    requestHash: v.string(),
    tokenIdentifier: v.string(),
    sessionId: v.optional(v.string()),
    messageText: v.string(),
    responseId: v.optional(v.string())
  },
  handler: async (ctx, { requestHash, tokenIdentifier, sessionId, messageText, responseId }) => {
    const now = Date.now();
    const expiresAt = now + (5 * 60 * 1000); // 5 minutes TTL

    return await ctx.db.insert("requestDeduplication", {
      requestHash,
      tokenIdentifier,
      sessionId,
      messageText: messageText.substring(0, 200), // Limit message text length
      responseId,
      createdAt: now,
      expiresAt
    });
  }
});

// Query: Check if request hash exists (for duplicate detection)
export const checkRequestHash = query({
  args: {
    requestHash: v.string()
  },
  handler: async (ctx, { requestHash }) => {
    const existing = await ctx.db
      .query("requestDeduplication")
      .withIndex("by_request_hash", q => q.eq("requestHash", requestHash))
      .first();

    if (!existing) {
      return null;
    }

    // Check if expired
    if (Date.now() > existing.expiresAt) {
      return null; // Expired entries will be cleaned up by separate cleanup process
    }

    return {
      found: true,
      messageText: existing.messageText,
      createdAt: existing.createdAt,
      sessionId: existing.sessionId
    };
  }
});

// Mutation: Cleanup expired request deduplication entries
export const cleanupExpiredRequests = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find expired entries
    const expired = await ctx.db
      .query("requestDeduplication")
      .withIndex("by_expiration", q => q.lt("expiresAt", now))
      .collect();

    // Delete expired entries
    let deletedCount = 0;
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return {
      deletedCount,
      cleanupTime: now
    };
  }
});

// Query: Get request statistics for a user
export const getRequestStats = query({
  args: {
    tokenIdentifier: v.string(),
    timeRange: v.optional(v.number()) // in milliseconds, default 24 hours
  },
  handler: async (ctx, { tokenIdentifier, timeRange = 24 * 60 * 60 * 1000 }) => {
    const since = Date.now() - timeRange;
    
    const requests = await ctx.db
      .query("requestDeduplication")
      .withIndex("by_user_and_hash", q => q.eq("tokenIdentifier", tokenIdentifier))
      .filter(q => q.gte(q.field("createdAt"), since))
      .collect();

    const uniqueHashes = new Set(requests.map(r => r.requestHash));
    const sessionsCount = new Set(requests.map(r => r.sessionId).filter(Boolean)).size;

    return {
      totalRequests: requests.length,
      uniqueRequests: uniqueHashes.size,
      duplicateRequests: requests.length - uniqueHashes.size,
      sessionsCount,
      timeRangeHours: timeRange / (60 * 60 * 1000),
      oldestRequest: requests.length > 0 ? Math.min(...requests.map(r => r.createdAt)) : null,
      newestRequest: requests.length > 0 ? Math.max(...requests.map(r => r.createdAt)) : null
    };
  }
});