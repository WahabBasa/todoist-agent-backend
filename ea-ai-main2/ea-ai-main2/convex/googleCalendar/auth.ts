"use node";

import { v } from "convex/values";
import { action, mutation } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction, requireUserAuth } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, MutationCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";

// TypeScript interfaces for return types
interface GoogleTokenSuccess {
  success: true;
  token: string;
  hasToken: true;
  message: string;
}

interface GoogleTokenError {
  success: false;
  error: string;
  hasToken: false;
}

type GoogleTokenResult = GoogleTokenSuccess | GoogleTokenError;

interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  testTimestamp: number;
  hasConnection?: boolean;
}

// Simplified Google Calendar OAuth using Clerk (matches Calendly clone pattern)

// =================================================================
// CLERK-BASED GOOGLE CALENDAR OAUTH (Calendly Clone Pattern)
// =================================================================

/**
 * Get Google OAuth access token using Clerk
 * This replaces all custom token storage and refresh logic
 */
export const getGoogleCalendarToken = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<GoogleTokenResult> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getGoogleCalendarToken", "REQUESTED");

    try {
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      // Extract Clerk user ID from tokenIdentifier using correct pipe separator
      const clerkUserId = tokenIdentifier.split('|').pop() || 
                         tokenIdentifier.split('#').pop() || 
                         tokenIdentifier;
      
      const tokenResponse = await clerkClient.users.getUserOauthAccessToken(
        clerkUserId, 
        "oauth_google"
      );
      
      if (tokenResponse.data.length === 0 || !tokenResponse.data[0].token) {
        return { 
          success: false, 
          error: "No Google OAuth token found. Please connect your Google account through your profile settings.",
          hasToken: false
        };
      }
      
      return { 
        success: true,
        token: tokenResponse.data[0].token,
        hasToken: true,
        message: "Google Calendar access token retrieved successfully"
      };
    } catch (error) {
      console.error("Error getting Google OAuth token from Clerk:", error);
      
      return { 
        success: false, 
        error: "Google Calendar not connected. Please connect in Settings.",
        hasToken: false
      };
    }
  },
});

/**
 * Check if user has Google Calendar connection via Clerk
 */
export const hasGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const tokenResult = await ctx.runAction(api.googleCalendar.auth.getGoogleCalendarToken, {});
    return tokenResult.success && tokenResult.hasToken;
  },
});

// =================================================================
// CONNECTION MANAGEMENT (Simplified - Clerk handles OAuth)
// =================================================================

/**
 * Test Google Calendar connection using Clerk tokens
 */
export const testGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<TestConnectionResult> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.testGoogleCalendarConnection", "REQUESTED");

    try {
      const tokenResult: GoogleTokenResult = await ctx.runAction(api.googleCalendar.auth.getGoogleCalendarToken, {});
      
      if (!tokenResult.success) {
        return {
          success: false,
          error: tokenResult.error || "No Google Calendar connection found",
          testTimestamp: Date.now()
        };
      }
      
      if (!tokenResult.token) {
        return {
          success: false,
          error: "No Google Calendar token found",
          testTimestamp: Date.now()
        };
      }

      return {
        success: true,
        message: "Google Calendar connection successful via Clerk OAuth",
        testTimestamp: Date.now(),
        hasConnection: true
      };
    } catch (error) {
      console.error("Error testing Google Calendar connection:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during connection test",
        testTimestamp: Date.now()
      };
    }
  },
});

// =================================================================
// CLERK-BASED CONNECTION MANAGEMENT 
// =================================================================

/**
 * Disconnect Google Calendar by removing Clerk external account
 * This leverages Clerk's built-in OAuth management
 */
export const removeGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", "REQUESTED");

    try {
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      // Extract Clerk user ID from tokenIdentifier using correct pipe separator
      const clerkUserId = tokenIdentifier.split('|').pop() || 
                         tokenIdentifier.split('#').pop() || 
                         tokenIdentifier;

      // Get user's external accounts
      const user = await clerkClient.users.getUser(clerkUserId);
      const googleAccount = user.externalAccounts?.find(account => account.provider === 'oauth_google');
      
      if (!googleAccount) {
        await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", "NO_CONNECTION_FOUND");
        return false;
      }

      // Delete the external account using correct Clerk API method
      await clerkClient.users.deleteUserExternalAccount({
        userId: clerkUserId,
        externalAccountId: googleAccount.id
      });
      
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", "SUCCESS");
      return true;
    } catch (error) {
      console.error("Error removing Google Calendar connection from Clerk:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", `FAILED: ${error}`);
      return false;
    }
  },
});

/**
 * Note: storeGoogleCalendarConnection is not needed when using Clerk OAuth
 * Clerk automatically manages the OAuth token lifecycle when users connect
 * through the frontend createExternalAccount() flow
 */