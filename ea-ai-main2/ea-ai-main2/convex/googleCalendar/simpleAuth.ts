"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";

// Direct OAuth client following Calendly clone pattern
// Simple, straightforward approach with minimal complexity

/**
 * Get Google OAuth client using Clerk tokens (exact Calendly pattern)
 * This replaces all the complex HTTP client architecture
 */
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
 * Get calendar event times (mirrors Calendly's getCalendarEventTimes)
 */
export const getCalendarEventTimes = action({
  args: {
    start: v.string(), // ISO string dates
    end: v.string()
  },
  handler: async (ctx: ActionCtx, { start, end }) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.simple.getCalendarEventTimes", "REQUESTED");

    // Extract clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    const events = await google.calendar("v3").events.list({
      calendarId: "primary",
      eventTypes: ["default"],
      singleEvents: true,
      timeMin: start,
      timeMax: end,
      maxResults: 2500,
      auth: oAuthClient,
    });

    return (
      events.data.items
        ?.map(event => {
          if (event.start?.date != null && event.end?.date != null) {
            return {
              start: new Date(event.start.date),
              end: new Date(event.end.date),
            };
          }

          if (event.start?.dateTime != null && event.end?.dateTime != null) {
            return {
              start: new Date(event.start.dateTime),
              end: new Date(event.end.dateTime),
            };
          }
        })
        .filter(date => date != null) || []
    );
  },
});

/**
 * Create calendar event (mirrors Calendly's createCalendarEvent)
 */
export const createCalendarEvent = action({
  args: {
    guestName: v.string(),
    guestEmail: v.string(),
    startTime: v.string(), // ISO string
    guestNotes: v.optional(v.string()),
    durationInMinutes: v.number(),
    eventName: v.string(),
  },
  handler: async (ctx: ActionCtx, { guestName, guestEmail, startTime, guestNotes, durationInMinutes, eventName }) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.simple.createCalendarEvent", "REQUESTED");

    // Extract clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const calendarUser = await clerkClient.users.getUser(clerkUserId);
    
    if (!calendarUser.primaryEmailAddress) {
      throw new Error("User has no email address");
    }

    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + durationInMinutes * 60000);

    const calendarEvent = await google.calendar("v3").events.insert({
      calendarId: "primary",
      auth: oAuthClient,
      sendUpdates: "all",
      requestBody: {
        attendees: [
          { email: guestEmail, displayName: guestName },
          {
            email: calendarUser.primaryEmailAddress.emailAddress,
            displayName: calendarUser.fullName || calendarUser.firstName || "User",
            responseStatus: "accepted",
          },
        ],
        description: guestNotes ? `Additional Details: ${guestNotes}` : undefined,
        start: {
          dateTime: startDate.toISOString(),
        },
        end: {
          dateTime: endDate.toISOString(),
        },
        summary: `${guestName} + ${calendarUser.fullName || "User"}: ${eventName}`,
      },
    });

    return calendarEvent.data;
  },
});

/**
 * Test connection by getting calendar list (simple test)
 */
export const testConnection = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.simple.testConnection", "REQUESTED");

    // Extract clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      return { success: false, error: "Google Calendar not connected" };
    }

    try {
      const calendars = await google.calendar("v3").calendarList.list({
        auth: oAuthClient,
      });

      return {
        success: true,
        calendarsCount: calendars.data.items?.length || 0,
        primaryCalendar: calendars.data.items?.find(cal => cal.primary)?.summary || "Primary Calendar",
        testTimestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        testTimestamp: Date.now(),
      };
    }
  },
});