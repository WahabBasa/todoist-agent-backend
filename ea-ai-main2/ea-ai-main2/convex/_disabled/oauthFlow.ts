import { mutation, action, internalMutation, internalQuery } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Enhanced OAuth Flow Management
 * 
 * This module handles seamless OAuth token capture and storage,
 * providing automatic token persistence during Google OAuth flow.
 * 
 * Inspired by gdata-provider's OAuth handling but adapted for Convex Auth.
 */

// =================================================================
// INTERNAL FUNCTIONS (No legacy table since it was removed)
// =================================================================

/**
 * Store OAuth tokens directly during OAuth flow
 * This is called after successful OAuth to persist tokens automatically
 */
export const storeOAuthTokensFromFlow = mutation({
  args: {
    userId: v.id("users"),
    providerAccountId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.optional(v.number()), // seconds from now
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    idToken: v.optional(v.string()),
  },
  handler: async (ctx, { 
    userId, 
    providerAccountId, 
    accessToken, 
    refreshToken, 
    expiresIn, 
    tokenType, 
    scope, 
    idToken 
  }) => {
    // Calculate expires_at timestamp
    const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined;

    // Find existing Google account or create new one
    let googleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "google"))
      .unique();

    if (googleAccount) {
      // Update existing account with OAuth tokens
      await ctx.db.patch(googleAccount._id, {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: tokenType || "Bearer",
        scope: scope,
        id_token: idToken,
      });

      console.log(`[OAuth Flow] Updated existing Google account for user: ${userId}`);
    } else {
      // Create new Google account record
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: tokenType || "Bearer",
        scope: scope,
        id_token: idToken,
      });

      console.log(`[OAuth Flow] Created new Google account for user: ${userId}`);
    }

    return {
      success: true,
      message: "OAuth tokens stored successfully",
      hasRefreshToken: !!refreshToken,
      expiresAt,
    };
  },
});

/**
 * Enhanced OAuth completion handler
 * This action should be called from the frontend after successful OAuth
 * to trigger automatic token storage
 */
export const completeOAuthFlow = action({
  args: {
    // These would come from the OAuth callback URL or frontend
    code: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, { code, state }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check if user already has Google account with tokens
    const existingAccount = await ctx.runQuery(internal.googleCalendar.sessionManager.getGoogleOAuthTokens, {
      userId,
    });

    if (existingAccount?.access_token) {
      console.log(`[OAuth Flow] User ${userId} already has valid tokens`);
      return {
        success: true,
        alreadyConnected: true,
        message: "Google Calendar already connected",
      };
    }

    // If no valid tokens, guide user to reconnect
    return {
      success: false,
      requiresReconnection: true,
      message: "Please reconnect your Google account to enable Calendar features",
      instructions: [
        "1. Go to Settings in your app",
        "2. Click 'Connect Google Calendar'", 
        "3. Grant Calendar permissions when prompted",
        "4. Your calendar will be automatically connected"
      ]
    };
  },
});

/**
 * Manual token sync - fallback for when automatic capture doesn't work
 * This is a bridge until we fully transition to automatic capture
 */
export const manualTokenSync = action({
  handler: async (ctx): Promise<{ success: boolean; method?: string; result?: any; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Use the legacy sync function as fallback
    try {
      const result = await ctx.runAction(api.googleCalendar.auth.syncGoogleCalendarTokens);
      
      // Invalidate session cache to pick up new tokens
      await ctx.runAction(api.googleCalendar.sessionManager.invalidateCurrentUserSession);
      
      return {
        success: true,
        method: "legacy_sync",
        result,
      };
    } catch (error) {
      console.error(`[OAuth Flow] Manual sync failed for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during manual sync",
      };
    }
  },
});

/**
 * Check OAuth connection status with detailed information
 */
export const getOAuthConnectionStatus = action({
  handler: async (ctx): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check via session manager
    const sessionStatus = await ctx.runAction(api.googleCalendar.sessionManager.getCurrentUserSession);
    
    // Get detailed token information
    const tokenData = await ctx.runQuery(internal.googleCalendar.sessionManager.getGoogleOAuthTokens, {
      userId,
    });

    const now = Date.now();
    const tokenExpired = tokenData?.expires_at ? (tokenData.expires_at * 1000) < now : true;
    const tokenExpiresIn = tokenData?.expires_at ? Math.max(0, (tokenData.expires_at * 1000) - now) : 0;

    return {
      userId,
      isConnected: sessionStatus.isConnected,
      hasTokens: !!tokenData,
      tokenInfo: tokenData ? {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        tokenExpired,
        expiresIn: Math.floor(tokenExpiresIn / 1000), // Convert to seconds
        expiresAt: tokenData.expires_at,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
      } : null,
      recommendations: sessionStatus.isConnected ? 
        ["Google Calendar is properly connected and ready to use"] :
        [
          "Connect your Google account in Settings",
          "Grant Calendar permissions when prompted", 
          "Calendar features will be automatically enabled"
        ]
    };
  },
});

/**
 * Force OAuth reconnection by clearing existing tokens
 * This is useful when tokens are corrupted or user wants fresh connection
 */
export const forceOAuthReconnection = action({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Remove existing connection
    await ctx.runMutation(api.googleCalendar.sessionManager.removeGoogleCalendarConnection);
    
    console.log(`[OAuth Flow] Forced reconnection for user: ${userId}`);
    
    return {
      success: true,
      message: "Google Calendar connection cleared. Please reconnect in Settings.",
      nextSteps: [
        "Go to Settings → Google Calendar",
        "Click 'Connect Google Calendar'",
        "Grant all requested permissions",
        "Calendar features will be automatically enabled"
      ]
    };
  },
});

/**
 * Migrate from legacy googleCalendarTokens table to authAccounts
 * This helps transition existing users to the new system
 * 
 * Note: Since legacy table was removed, this now just checks for existing tokens
 */
export const migrateLegacyTokens = action({
  handler: async (ctx): Promise<{ success: boolean; migrated: boolean; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Legacy table was removed, so no migration needed
    // Just check if user already has tokens in authAccounts
    const existingAccount = await ctx.runQuery(internal.googleCalendar.sessionManager.getGoogleOAuthTokens, {
      userId,
    });

    if (existingAccount?.access_token) {
      return {
        success: true,
        migrated: false,
        message: "Tokens already exist in new system",
      };
    }

    return {
      success: true,
      migrated: false,
      message: "No legacy tokens found to migrate (legacy table removed)",
    };
  },
});