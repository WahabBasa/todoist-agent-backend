"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";
import { addMinutes } from "date-fns";
import { requireUserAuthForAction } from "../todoist/userAccess";

// Get authenticated user's Clerk subject ID for Google OAuth operations
// Note: Uses subject (Clerk user ID) not tokenIdentifier because Google tokens are stored in Clerk
async function getAuthUserId(ctx: any): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject || null;
}

// Get user context with both tokenIdentifier and Clerk subject ID
async function getFullUserContext(ctx: any): Promise<{ tokenIdentifier: string; clerkUserId: string } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier || !identity?.subject) {
    return null;
  }
  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: identity.subject
  };
}

/**
 * Google Calendar API Error handling
 * Adapted from MCP BaseToolHandler error patterns
 */
class GoogleCalendarError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'GoogleCalendarError';
  }
}

/**
 * Get OAuth client for Google Calendar API using Calendly's exact pattern
 */
async function getOAuthClient(clerkUserId: string) {
  const token = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    .users.getUserOauthAccessToken(clerkUserId, "oauth_google");

  if (token.data.length === 0 || token.data[0].token == null) {
    return null;
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
 * Get calendar event times using Calendly's exact pattern
 */
export async function getCalendarEventTimes(
  clerkUserId: string,
  { start, end }: { start: Date; end: Date }
) {
  const oAuthClient = await getOAuthClient(clerkUserId);

  if (!oAuthClient) {
    throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
  }

  const events = await google.calendar("v3").events.list({
    calendarId: "primary",
    eventTypes: ["default"],
    singleEvents: true,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 2500,
    auth: oAuthClient,
  });

  return (
    events.data.items
      ?.map(event => {
        if (event.start?.date != null && event.end?.date != null) {
          return {
            start: new Date(event.start.date + "T00:00:00"),
            end: new Date(event.end.date + "T23:59:59"),
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
}

/**
 * Create calendar event using Calendly's pattern
 */
export async function createCalendarEvent({
  clerkUserId,
  guestName,
  guestEmail,
  startTime,
  guestNotes,
  durationInMinutes,
  eventName,
}: {
  clerkUserId: string;
  guestName?: string;
  guestEmail?: string;
  startTime: Date;
  guestNotes?: string | null;
  durationInMinutes: number;
  eventName: string;
}) {
  const oAuthClient = await getOAuthClient(clerkUserId);
  
  if (!oAuthClient) {
    throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
  }

  const calendarUser = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    .users.getUser(clerkUserId);
  
  if (calendarUser.primaryEmailAddress == null) {
    throw new Error("Clerk user has no email");
  }

  const attendees = [];
  if (guestEmail && guestName) {
    attendees.push({ email: guestEmail, displayName: guestName });
  }
  attendees.push({
    email: calendarUser.primaryEmailAddress.emailAddress,
    displayName: calendarUser.fullName,
    responseStatus: "accepted",
  });

  const calendarEvent = await google.calendar("v3").events.insert({
    calendarId: "primary",
    auth: oAuthClient,
    sendUpdates: "all",
    requestBody: {
      attendees: attendees,
      description: guestNotes ? `Additional Details: ${guestNotes}` : undefined,
      start: {
        dateTime: startTime.toISOString(),
      },
      end: {
        dateTime: addMinutes(startTime, durationInMinutes).toISOString(),
      },
      summary: guestName ? `${guestName} + ${calendarUser.fullName}: ${eventName}` : eventName,
    },
  });

  return calendarEvent.data;
}

/**
 * Check if the user has a connected Google Calendar account
 */
export const hasGoogleCalendarConnection = action({
  handler: async (ctx) => {
    try {
      // Use our improved authentication helper
      const userContext = await getFullUserContext(ctx);
      if (!userContext) {
        return false;
      }

      const oAuthClient = await getOAuthClient(userContext.clerkUserId);
      return oAuthClient != null;
    } catch (error) {
      console.error("Error checking Google Calendar connection:", error);
      return false;
    }
  },
});

/**
 * Get the primary calendar for the user (or a specific calendar by ID)
 */
export const getCalendar = action({
  args: {
    calendarId: v.optional(v.string()), // Default to "primary"
  },
  handler: async (ctx, { calendarId = "primary" }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const calendar = await google.calendar("v3").calendars.get({
      calendarId,
      auth: oAuthClient,
    });

    return calendar.data;
  },
});

/**
 * List calendars accessible to the user
 * Only used for debugging/setup - not part of main AI tools
 */
export const listCalendars = action({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const calendars = await google.calendar("v3").calendarList.list({
      auth: oAuthClient,
    });

    return calendars.data;
  },
});

/**
 * Get calendar events with optional date filtering
 */
export const listEvents = action({
  args: {
    calendarId: v.optional(v.string()),
    timeMin: v.optional(v.string()),
    timeMax: v.optional(v.string()),
    maxResults: v.optional(v.number()),
    q: v.optional(v.string()), // Search query
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, { 
    calendarId = "primary", 
    timeMin, 
    timeMax, 
    maxResults = 50, 
    q,
    timeZone 
  }) => {
    const userContext = await getFullUserContext(ctx);
    if (!userContext) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userContext.clerkUserId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const events = await google.calendar("v3").events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      q,
      timeZone,
      orderBy: "startTime",
      singleEvents: true,
      auth: oAuthClient,
    });

    return events.data;
  },
});

/**
 * Create a new calendar event
 */
export const createEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    summary: v.string(),
    description: v.optional(v.string()),
    start: v.object({
      dateTime: v.string(),
      timeZone: v.optional(v.string()),
    }),
    end: v.object({
      dateTime: v.string(),
      timeZone: v.optional(v.string()),
    }),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.object({
      email: v.string(),
    }))),
    recurrence: v.optional(v.array(v.string())),
    reminders: v.optional(v.object({
      useDefault: v.boolean(),
      overrides: v.optional(v.array(v.object({
        method: v.string(),
        minutes: v.number(),
      }))),
    })),
  },
  handler: async (ctx, { calendarId = "primary", ...eventData }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const event = await google.calendar("v3").events.insert({
      calendarId,
      auth: oAuthClient,
      sendUpdates: "all",
      requestBody: eventData,
    });

    return event.data;
  },
});

/**
 * Update an existing calendar event
 */
export const updateEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    start: v.optional(v.object({
      dateTime: v.string(),
      timeZone: v.optional(v.string()),
    })),
    end: v.optional(v.object({
      dateTime: v.string(),
      timeZone: v.optional(v.string()),
    })),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.object({
      email: v.string(),
    }))),
    recurrence: v.optional(v.array(v.string())),
    reminders: v.optional(v.object({
      useDefault: v.boolean(),
      overrides: v.optional(v.array(v.object({
        method: v.string(),
        minutes: v.number(),
      }))),
    })),
  },
  handler: async (ctx, { calendarId = "primary", eventId, ...updateData }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    // Remove undefined values to avoid overwriting with null
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );
    
    const event = await google.calendar("v3").events.patch({
      calendarId,
      eventId,
      auth: oAuthClient,
      sendUpdates: "all",
      requestBody: cleanUpdateData,
    });

    return event.data;
  },
});

/**
 * Delete a calendar event
 */
export const deleteEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
    sendUpdates: v.optional(v.string()), // "all", "externalOnly", "none"
  },
  handler: async (ctx, { calendarId = "primary", eventId, sendUpdates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }
    
    await google.calendar("v3").events.delete({
      calendarId,
      eventId,
      auth: oAuthClient,
      sendUpdates: sendUpdates || "all",
    });
    
    return { success: true, eventId };
  },
});

/**
 * Get a specific calendar event by ID
 */
export const getEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
  },
  handler: async (ctx, { calendarId = "primary", eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const event = await google.calendar("v3").events.get({
      calendarId,
      eventId,
      auth: oAuthClient,
    });

    return event.data;
  },
});

/**
 * Search for events by text query
 */
export const searchEvents = action({
  args: {
    calendarId: v.optional(v.string()),
    query: v.string(),
    timeMin: v.optional(v.string()),
    timeMax: v.optional(v.string()),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, { 
    calendarId = "primary", 
    query, 
    timeMin, 
    timeMax, 
    maxResults = 20 
  }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const events = await google.calendar("v3").events.list({
      calendarId,
      q: query,
      timeMin,
      timeMax,
      maxResults,
      orderBy: "startTime",
      singleEvents: true,
      auth: oAuthClient,
    });

    return events.data;
  },
});

/**
 * Get free/busy information for calendars
 */
export const getFreeBusy = action({
  args: {
    timeMin: v.string(),
    timeMax: v.string(),
    calendars: v.array(v.object({
      id: v.string(),
    })),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, requestData) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new GoogleCalendarError("User not authenticated");
    }

    const oAuthClient = await getOAuthClient(userId);
    if (!oAuthClient) {
      throw new GoogleCalendarError("Google Calendar not connected. Please connect your Google account in settings.", 401);
    }

    const freeBusy = await google.calendar("v3").freebusy.query({
      auth: oAuthClient,
      requestBody: requestData,
    });

    return freeBusy.data;
  },
});