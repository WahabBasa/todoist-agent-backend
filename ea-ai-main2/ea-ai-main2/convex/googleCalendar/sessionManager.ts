"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend";

// Get auth user ID using Clerk's getAuth function
async function getAuthUserId(ctx: any): Promise<string | null> {
  return ctx.auth.getUserIdentity()?.subject || null;
}

/**
 * Check if the user has a connected Google Calendar account
 * This is an action that can use Node.js runtime to check Clerk OAuth tokens
 */
export const hasGoogleCalendarConnection = action({
  handler: async (ctx): Promise<boolean> => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return false;
      }

      // Get Google OAuth token from Clerk using Node.js runtime
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      return token.data.length > 0 && token.data[0].token != null;
    } catch (error) {
      console.error("Error checking Google Calendar connection:", error);
      return false;
    }
  },
});

/**
 * Remove Google Calendar connection (disconnect)
 * This will revoke the OAuth token via Clerk
 */
export const removeGoogleCalendarConnection = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Note: Clerk doesn't have a direct API to revoke OAuth tokens
      // The user would need to revoke access via their Google account settings
      // For now, we'll return a message guiding the user
      
      return {
        success: false,
        message: "To disconnect Google Calendar, please go to your Google Account settings and revoke access to this application.",
        action_required: "manual_revoke"
      };
    } catch (error) {
      console.error("Error removing Google Calendar connection:", error);
      throw new Error(`Failed to disconnect Google Calendar: ${error}`);
    }
  },
});

/**
 * Get detailed connection status for debugging
 */
export const getConnectionStatus = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return {
          connected: false,
          error: "User not authenticated",
          user_id: null
        };
      }

      // Get Google OAuth token from Clerk
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      const hasTokens = token.data.length > 0 && token.data[0].token != null;
      
      return {
        connected: hasTokens,
        user_id: userId,
        token_count: token.data.length,
        has_access_token: hasTokens,
        clerk_provider: "oauth_google",
        debug_info: {
          tokens_available: token.data.length,
          first_token_present: token.data.length > 0 ? token.data[0].token != null : false
        }
      };
    } catch (error) {
      console.error("Error getting connection status:", error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        user_id: null
      };
    }
  },
});

/**
 * Test the Google Calendar connection by making a simple API call
 */
export const testConnection = action({
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Get Google OAuth token from Clerk
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = await clerkClient.users.getUserOauthAccessToken(
        userId,
        "oauth_google"
      );

      if (token.data.length === 0 || token.data[0].token == null) {
        throw new Error("No Google OAuth token found");
      }

      // Test the connection by fetching calendar info
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
        headers: {
          Authorization: `Bearer ${token.data[0].token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}: ${response.statusText}`);
      }

      const calendarData = await response.json();

      return {
        success: true,
        calendar_id: calendarData.id,
        calendar_summary: calendarData.summary,
        access_role: calendarData.accessRole,
        test_time: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error testing Google Calendar connection:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        test_time: new Date().toISOString()
      };
    }
  },
});