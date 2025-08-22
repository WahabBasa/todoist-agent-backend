"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend";

// Get auth user ID using Clerk's getAuth function
async function getAuthUserId(ctx: any): Promise<string | null> {
  return ctx.auth.getUserIdentity()?.subject || null;
}

/**
 * Legacy function: Sync Google Calendar tokens
 * With Clerk, tokens are managed automatically, so this provides guidance
 */
export const syncGoogleCalendarTokens = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Check if user has Google OAuth connection
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      if (token.data.length === 0 || token.data[0].token == null) {
        return {
          success: false,
          message: "No Google OAuth connection found. Please connect your Google account in Settings.",
          action_required: "oauth_connection_needed"
        };
      }

      // Test the connection
      try {
        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
          headers: {
            Authorization: `Bearer ${token.data[0].token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          return {
            success: true,
            message: "✅ Google Calendar connection is working properly. No sync needed with Clerk.",
            connection_status: "active"
          };
        } else if (response.status === 401) {
          return {
            success: false,
            message: "⚠️ Google Calendar token has expired. Please reconnect your Google account in Settings.",
            action_required: "reconnection_needed"
          };
        } else {
          return {
            success: false,
            message: `❌ Google Calendar API error: ${response.statusText}. Try reconnecting your account.`,
            action_required: "reconnection_recommended"
          };
        }
      } catch (apiError) {
        return {
          success: false,
          message: "❌ Unable to test Google Calendar connection. Check your internet connection.",
          action_required: "retry_later"
        };
      }
    } catch (error) {
      console.error("Error syncing Google Calendar tokens:", error);
      throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Legacy function: Debug Google auth account
 * Provides debugging information for troubleshooting
 */
export const debugGoogleAuthAccount = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return {
          error: "User not authenticated",
          user_id: null,
          debug_info: null
        };
      }

      // Get Google OAuth token from Clerk
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      return {
        user_id: userId,
        oauth_provider: "oauth_google",
        token_count: token.data.length,
        has_tokens: token.data.length > 0 && token.data[0].token != null,
        debug_info: {
          clerk_user_id: userId,
          oauth_tokens_available: token.data.length,
          first_token_exists: token.data.length > 0 ? token.data[0].token != null : false,
          auth_method: "Clerk OAuth",
          legacy_token_system: false
        },
        recommendations: token.data.length === 0 ? [
          "Connect your Google account in Settings",
          "Make sure to grant calendar permissions"
        ] : [
          "Google OAuth connection found via Clerk",
          "Tokens are managed automatically"
        ]
      };
    } catch (error) {
      console.error("Error debugging Google auth account:", error);
      return {
        error: error instanceof Error ? error.message : String(error),
        user_id: null,
        debug_info: null
      };
    }
  },
});