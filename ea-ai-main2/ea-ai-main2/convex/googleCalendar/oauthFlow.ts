"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend";

// Get auth user ID using Clerk's getAuth function
async function getAuthUserId(ctx: any): Promise<string | null> {
  return ctx.auth.getUserIdentity()?.subject || null;
}

/**
 * Get detailed OAuth connection status with recommendations
 */
export const getOAuthConnectionStatus = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return {
          isConnected: false,
          hasTokens: false,
          recommendations: ["Please sign in to check Google Calendar connection"],
          error: "User not authenticated"
        };
      }

      // Get Google OAuth token from Clerk
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      const hasTokens = token.data.length > 0 && token.data[0].token != null;
      
      let recommendations = [];
      let tokenInfo = null;

      if (!hasTokens) {
        recommendations.push("Connect your Google account in Settings to enable Google Calendar features");
        recommendations.push("Make sure to grant calendar permissions when prompted");
      } else {
        // Test the token by making a simple API call
        try {
          const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
            headers: {
              Authorization: `Bearer ${token.data[0].token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            recommendations.push("✅ Google Calendar connection is working properly");
            tokenInfo = {
              hasAccessToken: true,
              hasRefreshToken: false, // Clerk doesn't expose refresh tokens
              tokenExpired: false,
              tokenType: "Bearer",
              scope: "calendar"
            };
          } else if (response.status === 401) {
            recommendations.push("⚠️ Google Calendar token has expired");
            recommendations.push("Please reconnect your Google account in Settings");
            tokenInfo = {
              hasAccessToken: true,
              hasRefreshToken: false,
              tokenExpired: true,
              tokenType: "Bearer",
              scope: "calendar"
            };
          } else {
            recommendations.push(`❌ Google Calendar API error: ${response.statusText}`);
            recommendations.push("Try disconnecting and reconnecting your Google account");
          }
        } catch (apiError) {
          recommendations.push("❌ Unable to test Google Calendar connection");
          recommendations.push("Check your internet connection and try again");
        }
      }

      return {
        isConnected: hasTokens,
        hasTokens: hasTokens,
        tokenInfo: tokenInfo,
        recommendations: recommendations,
        debug: {
          userId: userId,
          tokenCount: token.data.length,
          clerkProvider: "oauth_google"
        }
      };
    } catch (error) {
      console.error("Error getting OAuth connection status:", error);
      return {
        isConnected: false,
        hasTokens: false,
        recommendations: [`Error checking connection: ${error instanceof Error ? error.message : String(error)}`],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },
});

/**
 * Force OAuth reconnection (placeholder for user guidance)
 */
export const forceOAuthReconnection = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Since Clerk manages OAuth tokens automatically, we can't directly force a reconnection
      // This function provides guidance to the user
      return {
        success: false,
        action_required: "manual_reconnection",
        message: "To reconnect Google Calendar:",
        steps: [
          "1. Go to your Google Account settings (myaccount.google.com)",
          "2. Navigate to Security > Third-party apps with account access",
          "3. Remove access for this application",
          "4. Return to Settings and connect Google Calendar again",
          "5. Make sure to grant calendar permissions when prompted"
        ],
        alternative: "Or contact support if you continue having issues"
      };
    } catch (error) {
      console.error("Error in force OAuth reconnection:", error);
      throw new Error(`Failed to reconnect: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Migrate legacy tokens (placeholder - not needed with Clerk)
 */
export const migrateLegacyTokens = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // With Clerk, we don't need to migrate legacy tokens
      // Clerk handles OAuth token management automatically
      return {
        migrated: false,
        message: "No legacy token migration needed with Clerk authentication",
        recommendation: "Your Google Calendar connection is managed automatically by Clerk"
      };
    } catch (error) {
      console.error("Error in migrate legacy tokens:", error);
      return {
        migrated: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Migration not required with Clerk authentication"
      };
    }
  },
});