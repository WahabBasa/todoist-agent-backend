import { query, action } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "../_generated/api";
import { sessionManager } from "./sessionManager";

/**
 * Google Calendar Authentication (Simplified)
 * 
 * This file now provides a clean interface to the new session manager.
 * All token management is handled by sessionManager.ts and authAccounts table.
 * 
 * Legacy functions have been removed in favor of the unified session approach.
 */

/**
 * Check if user has Google Calendar connected
 * Now uses the session manager for consistent checking
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
 * Remove Google Calendar connection
 * Now uses the session manager for clean removal
 */
export const removeGoogleCalendarConnection = action({
  handler: async (ctx): Promise<{ success: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Use session manager to remove connection
    return await ctx.runMutation(api.googleCalendar.sessionManager.removeGoogleCalendarConnection);
  },
});

/**
 * Debug Google auth account - simplified version
 * Now uses session manager for accurate status
 */
export const debugGoogleAuthAccount = action({
  handler: async (ctx): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Get detailed status from OAuth flow
    return await ctx.runAction(api.googleCalendar.oauthFlow.getOAuthConnectionStatus);
  },
});

/**
 * Sync Google Calendar tokens - now a simple wrapper
 * This provides backward compatibility while using the new system
 */
export const syncGoogleCalendarTokens = action({
  handler: async (ctx): Promise<{ success: boolean; message: string; method: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Try initialization first
    try {
      const initResult = await ctx.runAction(api.auth.initializeGoogleCalendarAfterOAuth);
      if (initResult.success) {
        return {
          success: true,
          message: "Google Calendar initialized successfully",
          method: "initialization"
        };
      }
    } catch (error) {
      console.log("Initialization failed, trying migration...", error);
    }

    // Try legacy migration
    try {
      const migrationResult = await ctx.runAction(api.googleCalendar.oauthFlow.migrateLegacyTokens);
      if (migrationResult.migrated) {
        return {
          success: true,
          message: "Legacy tokens migrated successfully",
          method: "migration"
        };
      }
    } catch (error) {
      console.log("Migration failed", error);
    }

    // If nothing worked, provide guidance
    throw new Error(
      "No OAuth tokens found. Please connect Google Calendar:\n" +
      "1. Go to Settings in your app\n" +
      "2. Click 'Connect Google Calendar'\n" +
      "3. Grant all requested permissions\n" +
      "4. Try your calendar request again"
    );
  },
});

/**
 * Get Google Calendar token - simplified version  
 * Returns token data using session manager
 */
export const getGoogleCalendarToken = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = sessionManager.getSessionByUserId(userId, false);
    if (!session) {
      return null;
    }

    const tokenData = await session.getTokenData(ctx);
    return tokenData ? {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiryDate: tokenData.expiresAt
    } : null;
  },
});

// =================================================================
// BACKWARD COMPATIBILITY LAYER - DEPRECATED FUNCTIONS
// These functions are kept for backward compatibility but should not be used
// in new code. Use sessionManager or oauthFlow functions instead.
// =================================================================

// Note: Deprecated function aliases removed to avoid circular references.
// Use the sessionManager functions directly:
// - api.googleCalendar.sessionManager.getGoogleOAuthTokens
// - api.googleCalendar.sessionManager.updateOAuthTokens  
// - api.googleCalendar.sessionManager.hasGoogleCalendarConnection