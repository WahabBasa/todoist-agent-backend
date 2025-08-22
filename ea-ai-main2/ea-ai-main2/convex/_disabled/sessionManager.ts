import { mutation, query, action, internalQuery } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Google Calendar Session Manager
 * 
 * Inspired by gdata-provider's calGoogleSession architecture, this provides
 * centralized OAuth session management for Google Calendar integration.
 * 
 * Key features:
 * - Single source of truth for OAuth tokens
 * - Automatic token lifecycle management  
 * - Session caching and reuse
 * - Seamless token refresh handling
 */

// Session cache to avoid redundant database queries
const sessionCache = new Map<string, GoogleCalendarSession>();

// Session timeout configuration (30 second grace period like gdata-provider)
const TOKEN_GRACE_TIME_MS = 30 * 1000;
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GoogleCalendarSession
 * 
 * Manages OAuth lifecycle for a single user's Google Calendar connection.
 * Adapted from gdata-provider's calGoogleSession patterns.
 */
class GoogleCalendarSession {
  private userId: string;
  private sessionId: string;
  private cachedTokenData: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
    scope?: string;
  } | null = null;
  private lastCacheUpdate: number = 0;

  constructor(userId: string) {
    this.userId = userId;
    this.sessionId = `gdata-session-${userId}`;
  }

  /**
   * Get the user ID for this session
   */
  get id(): string {
    return this.userId;
  }

  /**
   * Check if the current token has expired or will expire within grace time
   * Adapted from gdata-provider's tokenExpired getter
   */
  private get tokenExpired(): boolean {
    if (!this.cachedTokenData?.expiresAt) {
      return true; // No expiry time means we should refresh
    }
    return this.cachedTokenData.expiresAt - TOKEN_GRACE_TIME_MS < Date.now();
  }

  /**
   * Check if session cache is still valid
   */
  private get cacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < SESSION_CACHE_TTL_MS;
  }

  /**
   * Get OAuth token data from authAccounts table
   * This is our single source of truth for OAuth tokens
   */
  async getTokenData(ctx: any): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
    scope?: string;
  } | null> {
    // Use cached data if available and valid
    if (this.cachedTokenData && this.cacheValid) {
      return this.cachedTokenData;
    }

    // Query authAccounts for Google OAuth tokens
    const googleAccount = await ctx.runQuery(internal.googleCalendar.sessionManager.getGoogleOAuthTokens, {
      userId: this.userId,
    });

    if (!googleAccount) {
      console.log(`[GoogleCalendarSession] No Google account found for user: ${this.userId}`);
      this.cachedTokenData = null;
      return null;
    }

    // Check if OAuth tokens are available in the preferred fields
    if (googleAccount.access_token) {
      this.cachedTokenData = {
        accessToken: googleAccount.access_token,
        refreshToken: googleAccount.refresh_token,
        expiresAt: googleAccount.expires_at ? googleAccount.expires_at * 1000 : undefined, // Convert to milliseconds
        tokenType: googleAccount.token_type || "Bearer",
        scope: googleAccount.scope,
      };
      this.lastCacheUpdate = Date.now();
      return this.cachedTokenData;
    }

    // Fallback: Try to parse legacy secret field for backward compatibility
    if (googleAccount.secret) {
      try {
        const secretData = JSON.parse(googleAccount.secret);
        if (secretData.access_token) {
          this.cachedTokenData = {
            accessToken: secretData.access_token,
            refreshToken: secretData.refresh_token,
            expiresAt: secretData.expires_at ? secretData.expires_at * 1000 : undefined,
            tokenType: secretData.token_type || "Bearer",
            scope: secretData.scope,
          };
          this.lastCacheUpdate = Date.now();
          return this.cachedTokenData;
        }
      } catch (error) {
        console.error(`[GoogleCalendarSession] Failed to parse legacy secret for user ${this.userId}:`, error);
      }
    }

    console.log(`[GoogleCalendarSession] No valid OAuth tokens found for user: ${this.userId}`);
    this.cachedTokenData = null;
    return null;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * Adapted from gdata-provider's connect() method
   */
  async getValidAccessToken(ctx: any): Promise<string> {
    const tokenData = await this.getTokenData(ctx);
    
    if (!tokenData) {
      throw new Error(
        "Google Calendar not connected. Please connect your Google account:\n" +
        "1. Go to Settings in your app\n" +
        "2. Click 'Connect Google Calendar'\n" +
        "3. Grant Calendar access when prompted\n" +
        "4. Try your request again"
      );
    }

    // Check if token needs refresh
    if (this.tokenExpired) {
      if (!tokenData.refreshToken) {
        throw new Error(
          "Google Calendar token expired and no refresh token available. Please reconnect:\n" +
          "1. Go to Settings → Google Calendar\n" +
          "2. Disconnect and reconnect your account\n" +
          "3. Ensure all Calendar permissions are granted"
        );
      }

      console.log(`[GoogleCalendarSession] Token expired for user ${this.userId}, refreshing...`);
      
      // Refresh the token
      const refreshResult = await ctx.runAction(api.googleCalendar.sessionManager.refreshAccessToken, {
        userId: this.userId,
        refreshToken: tokenData.refreshToken,
      });

      if (!refreshResult.success) {
        throw new Error(refreshResult.error || "Failed to refresh Google Calendar token");
      }

      // Invalidate cache to force reload of fresh token
      this.invalidateCache();
      
      // Get the fresh token
      const freshTokenData = await this.getTokenData(ctx);
      if (!freshTokenData) {
        throw new Error("Failed to retrieve refreshed token");
      }
      
      return freshTokenData.accessToken;
    }

    return tokenData.accessToken;
  }

  /**
   * Invalidate the session cache
   * Similar to gdata-provider's invalidate() method
   */
  invalidateCache(): void {
    console.log(`[GoogleCalendarSession] Invalidating cache for session ${this.sessionId}`);
    this.cachedTokenData = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if the session has a valid connection
   */
  async isConnected(ctx: any): Promise<boolean> {
    try {
      const tokenData = await this.getTokenData(ctx);
      return tokenData !== null;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Google Calendar Session Manager
 * 
 * Central manager for all Google Calendar OAuth sessions.
 * Adapted from gdata-provider's calGoogleSessionManager.
 */
class GoogleCalendarSessionManager {
  /**
   * Get or create a session for the specified user
   * Adapted from gdata-provider's getSessionById
   */
  getSessionByUserId(userId: string, create: boolean = true): GoogleCalendarSession | null {
    if (sessionCache.has(userId)) {
      console.log(`[SessionManager] Reusing session for user: ${userId}`);
      return sessionCache.get(userId)!;
    }
    
    if (create) {
      console.log(`[SessionManager] Creating new session for user: ${userId}`);
      const session = new GoogleCalendarSession(userId);
      sessionCache.set(userId, session);
      return session;
    }
    
    return null;
  }

  /**
   * Remove a session from cache
   */
  removeSession(userId: string): void {
    console.log(`[SessionManager] Removing session for user: ${userId}`);
    sessionCache.delete(userId);
  }

  /**
   * Clear all cached sessions
   */
  clearAllSessions(): void {
    console.log(`[SessionManager] Clearing all cached sessions`);
    sessionCache.clear();
  }
}

// Singleton session manager instance
const sessionManager = new GoogleCalendarSessionManager();

// =================================================================
// CONVEX FUNCTIONS
// =================================================================

/**
 * Internal query to get Google OAuth tokens from authAccounts
 */
export const getGoogleOAuthTokens = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const googleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "google"))
      .unique();

    return googleAccount;
  },
});

/**
 * Get a Google Calendar session for the current user
 */
export const getCurrentUserSession = action({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const session = sessionManager.getSessionByUserId(userId);
    if (!session) {
      throw new Error("Failed to create Google Calendar session");
    }

    return {
      sessionId: session.id,
      isConnected: await session.isConnected(ctx),
    };
  },
});

/**
 * Get a valid access token for the current user
 */
export const getValidAccessToken = action({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const session = sessionManager.getSessionByUserId(userId);
    if (!session) {
      throw new Error("Failed to create Google Calendar session");
    }

    return await session.getValidAccessToken(ctx);
  },
});

/**
 * Refresh an access token using a refresh token
 * Adapted from gdata-provider's requestAccessToken method
 */
export const refreshAccessToken = action({
  args: {
    userId: v.id("users"),
    refreshToken: v.string(),
  },
  handler: async (ctx, { userId, refreshToken }): Promise<{ success: boolean; error?: string }> => {
    const clientId = process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "Google OAuth credentials not configured",
      };
    }

    try {
      console.log(`[SessionManager] Refreshing token for user: ${userId}`);
      
      // Make token refresh request to Google
      const response: Response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SessionManager] Token refresh failed: ${response.status} ${errorText}`);
        return {
          success: false,
          error: `Failed to refresh token: ${response.statusText}`,
        };
      }

      const refreshData: any = await response.json();
      
      if (refreshData.error) {
        console.error(`[SessionManager] Token refresh error:`, refreshData);
        
        // Handle specific error cases
        if (refreshData.error === "invalid_grant") {
          return {
            success: false,
            error: "Refresh token expired. Please reconnect your Google account.",
          };
        }
        
        return {
          success: false,
          error: refreshData.error_description || refreshData.error,
        };
      }

      if (!refreshData.access_token) {
        return {
          success: false,
          error: "No access token received from Google",
        };
      }

      // Calculate expiry time
      const expiresAt = refreshData.expires_in ? 
        Math.floor(Date.now() / 1000) + refreshData.expires_in : undefined;

      // Update the authAccounts table with new token
      await ctx.runMutation(api.googleCalendar.sessionManager.updateOAuthTokens, {
        userId,
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshToken, // Keep existing if not provided
        expiresAt,
        tokenType: "Bearer",
      });

      // Invalidate session cache for this user
      const session = sessionManager.getSessionByUserId(userId, false);
      if (session) {
        session.invalidateCache();
      }

      console.log(`[SessionManager] Successfully refreshed token for user: ${userId}`);
      return { success: true };

    } catch (error) {
      console.error(`[SessionManager] Error refreshing token for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during token refresh",
      };
    }
  },
});

/**
 * Update OAuth tokens in authAccounts table
 */
export const updateOAuthTokens = mutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, refreshToken, expiresAt, tokenType, scope }) => {
    // Find the Google account in authAccounts
    const googleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "google"))
      .unique();

    if (!googleAccount) {
      throw new Error("Google account not found in authAccounts");
    }

    // Update the account with new OAuth tokens
    await ctx.db.patch(googleAccount._id, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      token_type: tokenType,
      scope: scope,
    });

    console.log(`[SessionManager] Updated OAuth tokens for user: ${userId}`);
    return { success: true };
  },
});

/**
 * Check if user has Google Calendar connected
 */
export const hasGoogleCalendarConnection = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const session = sessionManager.getSessionByUserId(userId, false);
    if (!session) {
      return false;
    }

    return await session.isConnected(ctx);
  },
});

/**
 * Invalidate session cache for current user
 */
export const invalidateCurrentUserSession = action({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const session = sessionManager.getSessionByUserId(userId, false);
    if (session) {
      session.invalidateCache();
    }

    return { success: true };
  },
});

/**
 * Remove Google Calendar connection
 */
export const removeGoogleCalendarConnection = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Clear OAuth tokens from authAccounts
    const googleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "google"))
      .unique();

    if (googleAccount) {
      await ctx.db.patch(googleAccount._id, {
        access_token: undefined,
        refresh_token: undefined,
        expires_at: undefined,
        token_type: undefined,
        scope: undefined,
      });
    }

    // Remove session from cache
    sessionManager.removeSession(userId);

    console.log(`[SessionManager] Removed Google Calendar connection for user: ${userId}`);
    return { success: true };
  },
});

/**
 * Export the session manager for direct use in other modules
 */
export { GoogleCalendarSession, GoogleCalendarSessionManager, sessionManager };