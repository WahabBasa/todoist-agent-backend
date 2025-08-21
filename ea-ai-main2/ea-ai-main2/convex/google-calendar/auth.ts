import { mutation, query, action, internalQuery } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Google Calendar API configuration
const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";

// Store Google Calendar OAuth tokens for users (authenticated context)
export const storeGoogleCalendarToken = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, { accessToken, refreshToken, expiryDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check if user already has a Google Calendar token
    const existingToken = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        accessToken,
        refreshToken: refreshToken || existingToken.refreshToken,
        expiryDate: expiryDate || existingToken.expiryDate,
        updatedAt: Date.now(),
      });
      return existingToken._id;
    } else {
      // Create new token record
      return await ctx.db.insert("googleCalendarTokens", {
        userId,
        accessToken,
        refreshToken,
        expiryDate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Store Google Calendar OAuth tokens for specific user (OAuth callback context)
export const storeGoogleCalendarTokenForUser = mutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, { userId, accessToken, refreshToken, expiryDate }) => {
    // Check if user already has a Google Calendar token
    const existingToken = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        accessToken,
        refreshToken: refreshToken || existingToken.refreshToken,
        expiryDate: expiryDate || existingToken.expiryDate,
        updatedAt: Date.now(),
      });
      return existingToken._id;
    } else {
      // Create new token record
      return await ctx.db.insert("googleCalendarTokens", {
        userId,
        accessToken,
        refreshToken,
        expiryDate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get Google Calendar access token for the current user
export const getGoogleCalendarToken = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return token ? { 
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiryDate: token.expiryDate
    } : null;
  },
});

// Check if user has Google Calendar connected
export const hasGoogleCalendarConnection = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return token !== null;
  },
});

// Remove Google Calendar connection
export const removeGoogleCalendarConnection = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (token) {
      await ctx.db.delete(token._id);
    }
  },
});

// Internal query to get Google Calendar token for a specific user (for action contexts)
export const getGoogleCalendarTokenForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const tokenRecord = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return tokenRecord ? { 
      accessToken: tokenRecord.accessToken,
      refreshToken: tokenRecord.refreshToken,
      expiryDate: tokenRecord.expiryDate
    } : null;
  },
});

// Refresh Google Calendar access token using refresh token
export const refreshGoogleCalendarToken = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Get current token data
    const tokenData = await ctx.runQuery(api.googleCalendar.auth.getGoogleCalendarTokenForUser, {
      userId,
    });

    if (!tokenData || !tokenData.refreshToken) {
      throw new Error("No refresh token available. Please re-authenticate.");
    }

    const clientId = process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    // Refresh the access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const refreshData = await response.json();
    
    if (!refreshData.access_token) {
      throw new Error("No access token received from Google");
    }

    // Calculate expiry date (Google returns expires_in seconds)
    const expiryDate = refreshData.expires_in ? 
      Date.now() + (refreshData.expires_in * 1000) : undefined;

    // Store the refreshed token
    await ctx.runMutation(api.googleCalendar.auth.storeGoogleCalendarTokenForUser, {
      userId,
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token || tokenData.refreshToken, // Keep existing if not provided
      expiryDate,
    });

    return { success: true, accessToken: refreshData.access_token };
  },
});

// Check if token needs refresh (5 minute buffer before expiry)
export const needsTokenRefresh = (expiryDate?: number): boolean => {
  if (!expiryDate) return false;
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  return Date.now() >= (expiryDate - bufferTime);
};