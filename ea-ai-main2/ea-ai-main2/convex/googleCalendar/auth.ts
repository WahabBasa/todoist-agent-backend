import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuth, requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

// Google Calendar OAuth configuration
const GOOGLE_OAUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// Required OAuth scopes for Google Calendar integration
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly"
];

// =================================================================
// QUERY FUNCTIONS: Check connection status
// =================================================================

/**
 * Check if the current user has a Google Calendar connection
 * Returns true if user has valid tokens, false otherwise
 */
export const hasGoogleCalendarConnection = query({
  args: {},
  handler: async (ctx: QueryCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.hasGoogleCalendarConnection", "REQUESTED");

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    // Return true if we have a token record (even if expired - refresh logic handles this)
    return token !== null;
  },
});

/**
 * Get Google Calendar connection details for the current user
 */
export const getGoogleCalendarConnection = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getGoogleCalendarConnection", "REQUESTED");

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    if (!token) {
      return null;
    }

    return {
      hasConnection: true,
      scope: token.scope,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      isExpired: Date.now() > token.expiresAt,
    };
  },
});

// =================================================================
// MUTATION FUNCTIONS: Token storage and removal
// =================================================================

/**
 * Store Google Calendar OAuth tokens after successful authorization
 * This is called after the OAuth flow completes
 */
export const storeGoogleCalendarTokens = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(), // Seconds until expiration
    scope: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.storeGoogleCalendarTokens", "REQUESTED");

    const now = Date.now();
    const expiresAt = now + (args.expiresIn * 1000); // Convert seconds to milliseconds

    // Check if user already has tokens - update or insert
    const existingToken = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    if (existingToken) {
      // Update existing tokens
      await ctx.db.patch(existingToken._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken || existingToken.refreshToken,
        expiresAt,
        scope: args.scope,
        updatedAt: now,
      });
    } else {
      // Insert new token record
      await ctx.db.insert("googleCalendarTokens", {
        tokenIdentifier: tokenIdentifier,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt,
        scope: args.scope,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Remove Google Calendar connection for the current user
 * Revokes tokens and deletes from database
 */
export const removeGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", "REQUESTED");

    // Get the user's token
    const token = await ctx.runQuery(api.googleCalendar.auth.getGoogleCalendarTokenRecord, {});
    
    if (!token) {
      return { success: false, error: "No Google Calendar connection found" };
    }

    try {
      // Revoke the token with Google
      if (token.accessToken) {
        const revokeParams = new URLSearchParams();
        revokeParams.set("token", token.accessToken);

        const revokeResponse = await fetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: revokeParams.toString(),
        });

        console.log("Google token revocation response:", revokeResponse.status);
      }
    } catch (error) {
      console.error("Failed to revoke Google Calendar token:", error);
      // Continue with local deletion even if revocation fails
    }

    // Delete the token from our database
    await ctx.runMutation(api.googleCalendar.auth.deleteGoogleCalendarTokenForUser, {
      tokenIdentifier: tokenIdentifier,
    });

    return { success: true };
  },
});

// =================================================================
// INTERNAL HELPER FUNCTIONS
// =================================================================

/**
 * Internal query to get token record for the current user
 * Used by other modules to access tokens
 */
export const getGoogleCalendarTokenRecord = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();

    return token;
  },
});

/**
 * Internal mutation to delete token for a specific user
 * Used by removeGoogleCalendarConnection action
 */
export const deleteGoogleCalendarTokenForUser = mutation({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (token) {
      await ctx.db.delete(token._id);
      return { success: true };
    }

    return { success: false, error: "Token not found" };
  },
});

// =================================================================
// TOKEN MANAGEMENT FUNCTIONS
// =================================================================

/**
 * Get a valid access token for the current user
 * Automatically refreshes if expired
 */
export const getValidGoogleCalendarToken = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<string | null> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getValidGoogleCalendarToken", "REQUESTED");

    const tokenRecord = await ctx.runQuery(api.googleCalendar.auth.getGoogleCalendarTokenRecord, {});
    
    if (!tokenRecord) {
      return null;
    }

    const now = Date.now();
    
    // If token is still valid, return it
    if (now < tokenRecord.expiresAt) {
      return tokenRecord.accessToken;
    }

    // Token is expired, attempt to refresh
    if (!tokenRecord.refreshToken) {
      console.error("No refresh token available for expired access token");
      return null;
    }

    try {
      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          refresh_token: tokenRecord.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!refreshResponse.ok) {
        console.error("Failed to refresh Google Calendar token:", refreshResponse.status);
        return null;
      }

      const refreshData = await refreshResponse.json();
      
      // Update the stored tokens
      await ctx.runMutation(api.googleCalendar.auth.storeGoogleCalendarTokens, {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || tokenRecord.refreshToken, // Keep existing if not provided
        expiresIn: refreshData.expires_in || 3600, // Default to 1 hour
        scope: tokenRecord.scope,
      });

      return refreshData.access_token;
    } catch (error) {
      console.error("Error refreshing Google Calendar token:", error);
      return null;
    }
  },
});

/**
 * Generate OAuth authorization URL for Google Calendar
 * This is used to initiate the OAuth flow
 */
export const generateGoogleCalendarOAuthURL = query({
  args: {
    redirectUri: v.string(),
    state: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.generateGoogleCalendarOAuthURL", "REQUESTED");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return { error: "Google OAuth is not configured" };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: args.redirectUri,
      response_type: "code",
      scope: REQUIRED_SCOPES.join(" "),
      access_type: "offline", // Required for refresh tokens
      prompt: "consent", // Force consent screen to ensure refresh token
      state: args.state || tokenIdentifier, // Use tokenIdentifier as state for security
    });

    return {
      url: `${GOOGLE_OAUTH_BASE_URL}?${params.toString()}`,
      state: args.state || tokenIdentifier,
    };
  },
});