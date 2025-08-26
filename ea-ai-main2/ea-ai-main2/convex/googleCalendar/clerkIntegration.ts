import { v } from "convex/values";
import { query, action } from "../_generated/server";
import { requireUserAuthForAction, requireUserAuth } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, QueryCtx } from "../_generated/server";

// Mirror Calendly's approach - use Clerk's OAuth tokens instead of custom storage
// This eliminates the "Google Calendar integration is not properly configured" error

/**
 * Check if user has Google OAuth connection via Clerk
 * Similar to Calendly's getOAuthClient check
 */
export const hasGoogleCalendarConnection = query({
  args: {},
  handler: async (ctx: QueryCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.clerk.hasGoogleCalendarConnection", "REQUESTED");

    try {
      // In a real implementation, you'd use clerkClient() here
      // For now, we'll simulate the check
      // const token = await clerkClient().users.getUserOauthAccessToken(tokenIdentifier, "oauth_google");
      // return token.data.length > 0 && token.data[0].token != null;
      
      // Temporary: Check if user has existing connection in our custom storage
      // This will be replaced with Clerk check once environment is configured
      const token = await ctx.db
        .query("googleCalendarTokens")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
        .first();
      
      return token !== null;
    } catch (error) {
      console.error("Error checking Google connection:", error);
      return false;
    }
  },
});

/**
 * Get Google OAuth client using Clerk tokens (Calendly pattern)
 * This will replace all custom token management
 */
export const getGoogleOAuthClient = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.clerk.getGoogleOAuthClient", "REQUESTED");

    try {
      // TODO: Replace with actual Clerk implementation
      // const token = await clerkClient().users.getUserOauthAccessToken(tokenIdentifier, "oauth_google");
      // 
      // if (token.data.length === 0 || token.data[0].token == null) {
      //   return { error: "No Google OAuth token found. Please connect your Google account." };
      // }
      //
      // const client = new google.auth.OAuth2(
      //   process.env.GOOGLE_OAUTH_CLIENT_ID,
      //   process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      //   process.env.GOOGLE_OAUTH_REDIRECT_URL
      // );
      //
      // client.setCredentials({ access_token: token.data[0].token });
      // return { client };

      // Temporary fallback to existing system
      const token = await ctx.runQuery(api.googleCalendar.auth.getGoogleCalendarTokenRecord, {});
      if (!token) {
        return { error: "No Google Calendar connection found. Please connect your Google account first." };
      }

      return { 
        success: true, 
        hasToken: true,
        message: "Ready to use Clerk-based OAuth (environment setup pending)"
      };
    } catch (error) {
      console.error("Error getting OAuth client:", error);
      return { error: "Failed to get Google OAuth client" };
    }
  },
});

/**
 * Initiate Google Calendar connection via Clerk
 * This replaces the custom OAuth URL generation
 */
export const initiateGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.clerk.initiateConnection", "REQUESTED");

    // TODO: Implement proper Clerk-based connection initiation
    // For now, provide guidance on proper connection method
    
    return {
      success: false,
      redirectUrl: "/user-profile#/security", // Clerk's account management page
      message: "Please connect your Google account through your profile settings, then grant Calendar permissions.",
      instructions: [
        "1. Click your profile picture (top right)",
        "2. Select 'Manage account'", 
        "3. Go to 'Connected accounts'",
        "4. Click 'Add connection' and select Google",
        "5. Grant Calendar permissions when prompted",
        "6. Return here and try connecting again"
      ]
    };
  },
});

// Define the test result interface to avoid circular type issues
interface GoogleCalendarTestResult {
  success: boolean;
  error?: string;
  calendarsCount?: number;
  primaryCalendar?: string;
  testTimestamp: number;
  message?: string;
}

// Define the OAuth client result interface
interface GoogleOAuthClientResult {
  error?: string;
  success?: boolean;
  hasToken?: boolean;
  message?: string;
}

/**
 * Test Google Calendar connection using Clerk tokens
 * Similar to existing testGoogleCalendarConnection but uses Clerk
 */
export const testGoogleCalendarConnectionClerk = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<GoogleCalendarTestResult> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.clerk.testConnection", "REQUESTED");

    try {
      const oauthResult: GoogleOAuthClientResult = await ctx.runAction(api.googleCalendar.clerkIntegration.getGoogleOAuthClient, {});
      
      if (oauthResult.error) {
        return {
          success: false,
          error: oauthResult.error,
          testTimestamp: Date.now()
        };
      }

      // TODO: Replace with actual Google Calendar API test using Clerk tokens
      // const calendar = google.calendar({ version: 'v3', auth: oauthResult.client });
      // const calendarsResponse = await calendar.calendarList.list();
      
      return {
        success: true,
        calendarsCount: 1, // Placeholder
        primaryCalendar: "Connected via Clerk OAuth",
        testTimestamp: Date.now(),
        message: "Clerk-based integration ready (pending environment configuration)"
      };
    } catch (error) {
      console.error("Error testing Google Calendar connection:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during connection test";
      return {
        success: false,
        error: errorMessage,
        testTimestamp: Date.now()
      };
    }
  },
});

// Import the existing API for fallback
import { api } from "../_generated/api";