"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";
import { api } from "../_generated/api";

// Mirror Calendly's approach - use Clerk's OAuth tokens instead of custom storage
// This eliminates the "Google Calendar integration is not properly configured" error


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
      // Use Clerk to get Google OAuth token
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      const { data: tokens } = await clerkClient.users.getUserOauthAccessToken(tokenIdentifier, "google");
      
      if (tokens.length === 0 || tokens[0].token == null) {
        return { error: "No Google OAuth token found. Please connect your Google account through your profile settings." };
      }
      
      // Return the OAuth access token for the HTTP client to use
      return { 
        success: true, 
        hasToken: true,
        token: tokens[0].token,
        message: "Google Calendar access token retrieved successfully"
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

    // For Clerk-based OAuth, users need to connect via their profile
    // This provides direct instructions for Clerk's OAuth flow
    
    return {
      success: true,
      requiresManualConnection: true,
      redirectUrl: "/user-profile?focusSection=connectedAccounts",
      message: "Connect your Google account to enable Calendar integration.",
      instructions: [
        "1. Click your profile picture or UserButton",
        "2. Navigate to 'Connected accounts'", 
        "3. Click 'Connect' next to Google",
        "4. Grant Calendar permissions when prompted",
        "5. Return to this page - the integration will work automatically"
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

      // Test the connection by trying to get the primary calendar
      // This will be handled by the HTTP client using the Clerk token
      const testResult = await ctx.runAction(api.googleCalendar.calendars.getPrimaryCalendar, {});
      
      return {
        success: true,
        calendarsCount: 1, // We successfully got the primary calendar
        primaryCalendar: testResult.summary || "Primary Calendar",
        testTimestamp: Date.now(),
        message: "Google Calendar connection successful via Clerk OAuth"
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

