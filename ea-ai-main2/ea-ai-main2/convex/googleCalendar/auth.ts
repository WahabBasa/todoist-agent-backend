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

// =================================================================
// CALENDAR EVENT OPERATIONS (Calendly Clone Pattern)  
// =================================================================

/**
 * Get calendar events in a date range (AI-friendly format)
 */
export const getCalendarEventTimes = action({
  args: {
    start: v.string(), // ISO date string
    end: v.string(),   // ISO date string
  },
  handler: async (ctx: ActionCtx, args) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCalendarEventTimes", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please sign in again.");
    }

    try {
      const events = await google.calendar("v3").events.list({
        calendarId: "primary",
        eventTypes: ["default"],
        singleEvents: true,
        timeMin: args.start,
        timeMax: args.end,
        maxResults: 2500,
        auth: oAuthClient,
      });

      const eventTimes = events.data.items?.map(event => {
        // Handle all-day events
        if (event.start?.date && event.end?.date) {
          return {
            start: new Date(event.start.date).toISOString(), // ✅ Return ISO string for Convex compatibility
            end: new Date(event.end.date).toISOString(),     // ✅ Return ISO string for Convex compatibility
            title: event.summary || "Untitled Event",
            isAllDay: true
          };
        }

        // Handle timed events
        if (event.start?.dateTime && event.end?.dateTime) {
          return {
            start: new Date(event.start.dateTime).toISOString(), // ✅ Return ISO string for Convex compatibility
            end: new Date(event.end.dateTime).toISOString(),     // ✅ Return ISO string for Convex compatibility
            title: event.summary || "Untitled Event",
            isAllDay: false
          };
        }

        return null;
      }).filter(Boolean) || [];

      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCalendarEventTimes", "SUCCESS");
      return eventTimes;
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCalendarEventTimes", `FAILED: ${error}`);
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : error}`);
    }
  },
});

/**
 * Create a new calendar event (AI-friendly)
 */
export const createCalendarEvent = action({
  args: {
    title: v.string(),
    startTime: v.string(), // ISO date string
    durationMinutes: v.number(),
    description: v.optional(v.string()),
    attendeeEmails: v.optional(v.array(v.string())),
  },
  handler: async (ctx: ActionCtx, args) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.createCalendarEvent", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please sign in again.");
    }

    try {
      const startTime = new Date(args.startTime);
      const endTime = new Date(startTime.getTime() + args.durationMinutes * 60000);

      const attendees = args.attendeeEmails?.map(email => ({ email })) || [];

      const calendarEvent = await google.calendar("v3").events.insert({
        calendarId: "primary",
        auth: oAuthClient,
        requestBody: {
          summary: args.title,
          description: args.description,
          start: {
            dateTime: startTime.toISOString(),
          },
          end: {
            dateTime: endTime.toISOString(),
          },
          attendees,
        },
      });

      await logUserAccess(tokenIdentifier, "googleCalendar.auth.createCalendarEvent", "SUCCESS");
      return {
        id: calendarEvent.data.id,
        title: calendarEvent.data.summary,
        start: calendarEvent.data.start?.dateTime,
        end: calendarEvent.data.end?.dateTime,
        htmlLink: calendarEvent.data.htmlLink,
      };
    } catch (error) {
      console.error("Error creating calendar event:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.createCalendarEvent", `FAILED: ${error}`);
      throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : error}`);
    }
  },
});

// =================================================================
// USER SETTINGS API (Google Calendar Settings Integration)
// =================================================================

/**
 * Get user's Google Calendar settings (timezone, format preferences, etc.)
 * Now enabled with proper OAuth scope: https://www.googleapis.com/auth/calendar.settings.readonly
 */
export const getUserCalendarSettings = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getUserCalendarSettings", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please sign in again.");
    }

    try {
      // Get all user settings from Google Calendar
      const settingsResponse = await google.calendar("v3").settings.list({
        auth: oAuthClient,
      });

      const settings = settingsResponse.data.items || [];
      
      // Extract key settings we need
      const timezone = settings.find(s => s.id === 'timezone')?.value || 'UTC';
      const format24Hour = settings.find(s => s.id === 'format24HourTime')?.value === 'true';
      const dateFieldOrder = settings.find(s => s.id === 'dateFieldOrder')?.value || 'MDY';
      const weekStart = parseInt(settings.find(s => s.id === 'weekStart')?.value || '0');
      const locale = settings.find(s => s.id === 'locale')?.value || 'en';

      const result = {
        timezone,
        format24Hour,
        dateFieldOrder,
        weekStart,
        locale,
        rawSettings: settings.map(s => ({ id: s.id, value: s.value })) // For debugging
      };

      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getUserCalendarSettings", "SUCCESS");
      return result;
    } catch (error) {
      console.error("Error fetching Google Calendar settings:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getUserCalendarSettings", `FAILED: ${error}`);
      throw new Error(`Failed to fetch calendar settings: ${error instanceof Error ? error.message : error}`);
    }
  },
});

// =================================================================
// CURRENT TIME FROM CALENDAR (No timezone calculations needed)
// =================================================================

/**
 * Get current time and date exactly as displayed in user's Google Calendar
 * Uses Google's timezone formatting - no manual calculations required
 */
export const getCurrentCalendarTime = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCurrentCalendarTime", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please sign in again.");
    }

    try {
      // Get primary calendar to get user's timezone
      const calendar = await google.calendar("v3").calendars.get({
        calendarId: "primary",
        auth: oAuthClient,
      });

      const userTimezone = calendar.data.timeZone || "UTC";
      const now = new Date();

      // Use Google Calendar API to format current time in user's timezone
      // We create a tiny time window around "now" so Google formats it for us
      const timeMin = new Date(now.getTime() - 1000).toISOString(); // 1 second before
      const timeMax = new Date(now.getTime() + 1000).toISOString(); // 1 second after

      // This is the key: Google will format the response times in the user's timezone
      const response = await google.calendar("v3").events.list({
        calendarId: "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        timeZone: userTimezone,
        maxResults: 1,
        auth: oAuthClient,
      });

      // Extract timezone and create formatted time using Google's timezone handling
      const currentTime = now.toISOString();
      
      // Create localized time string using the calendar's timezone
      const localTimeOptions: Intl.DateTimeFormatOptions = {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        weekday: 'long'
      };

      const localTime = now.toLocaleString('en-US', localTimeOptions);

      const result = {
        currentTime: currentTime,
        userTimezone: userTimezone,
        localTime: localTime,
        timestamp: now.getTime(),
        source: "google_calendar_timezone",
        calendarName: calendar.data.summary || "Primary Calendar"
      };

      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCurrentCalendarTime", "SUCCESS");
      return result;
    } catch (error) {
      console.error("Error getting current calendar time:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.getCurrentCalendarTime", `FAILED: ${error}`);
      throw new Error(`Failed to get current calendar time: ${error instanceof Error ? error.message : error}`);
    }
  },
});

/**
 * Note: storeGoogleCalendarConnection is not needed when using Clerk OAuth
 * Clerk automatically manages the OAuth token lifecycle when users connect
 * through the frontend createExternalAccount() flow
 */