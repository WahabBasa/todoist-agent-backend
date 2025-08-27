"use node";

import { v } from "convex/values";
import { action, mutation } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction, requireUserAuth } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, MutationCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";

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

// Simple OAuth client helper (mirrors Calendly pattern exactly)
async function getOAuthClient(clerkUserId: string) {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const token = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    "oauth_google"
  );

  if (token.data.length === 0 || token.data[0].token == null) {
    return undefined; // Simple error handling like Calendly
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  client.setCredentials({ access_token: token.data[0].token });

  return client;
}

/**
 * Check if user has Google Calendar connection via Clerk (simple version)
 */
export const hasGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    return oAuthClient !== undefined;
  },
});

// =================================================================
// CONNECTION MANAGEMENT (Simplified - Clerk handles OAuth)
// =================================================================

/**
 * Test Google Calendar connection using Clerk tokens (simple version)
 */
export const testGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<TestConnectionResult> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.testGoogleCalendarConnection", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        error: "Not authenticated",
        testTimestamp: Date.now()
      };
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      return {
        success: false,
        error: "Google Calendar not connected. Please connect in Settings.",
        testTimestamp: Date.now()
      };
    }

    try {
      // Test by getting calendar list - simple and effective
      const calendars = await google.calendar("v3").calendarList.list({
        auth: oAuthClient,
      });

      return {
        success: true,
        message: `Connected to Google Calendar with ${calendars.data.items?.length || 0} calendars`,
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