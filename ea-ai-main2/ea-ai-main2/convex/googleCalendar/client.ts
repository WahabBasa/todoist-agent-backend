import { action } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
// TODO: Re-implement with Clerk authentication
// import { sessionManager } from "./sessionManager";

const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";

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
 * Helper function to make authenticated Google Calendar API requests (for action contexts)
 * Now uses the unified session manager for token handling and automatic refresh
 */
async function googleCalendarRequest(ctx: any, endpoint: string, options: RequestInit = {}): Promise<any> {
  // TODO: Re-implement with Clerk authentication
  throw new GoogleCalendarError("Google Calendar integration needs to be updated for Clerk authentication");
  
  // const userId = await getAuthUserId(ctx);
  // if (!userId) {
  //   throw new GoogleCalendarError("User not authenticated");
  // }

  // // Get session and valid access token (handles refresh automatically)
  // const session = sessionManager.getSessionByUserId(userId);
  // if (!session) {
  //   throw new GoogleCalendarError("Failed to create Google Calendar session");
  // }

  // let accessToken: string;
  // try {
  //   accessToken = await session.getValidAccessToken(ctx);
  // } catch (error) {
  //   // Convert session errors to GoogleCalendarError for consistent error handling
  //   throw new GoogleCalendarError(error instanceof Error ? error.message : "Failed to get access token");
  // }

  const url = endpoint.startsWith('http') ? endpoint : `${GOOGLE_CALENDAR_API_BASE_URL}${endpoint}`;
  
  const response: Response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Handle specific Google API errors
    if (response.status === 401) {
      throw new GoogleCalendarError(
        "Google Calendar authentication expired. Please reconnect your account.",
        401
      );
    }
    
    if (response.status === 403) {
      throw new GoogleCalendarError(
        `Access denied: ${errorData?.error?.message || 'Insufficient permissions for Google Calendar'}`,
        403
      );
    }
    
    if (response.status === 404) {
      throw new GoogleCalendarError(
        `Resource not found: ${errorData?.error?.message || 'The requested calendar or event does not exist'}`,
        404
      );
    }
    
    if (response.status === 429) {
      throw new GoogleCalendarError(
        "Google Calendar API rate limit exceeded. Please try again later.",
        429
      );
    }
    
    if (response.status >= 500) {
      throw new GoogleCalendarError(
        `Google Calendar API server error: ${errorData?.error?.message || response.statusText}`,
        response.status
      );
    }
    
    // Generic Google API error
    throw new GoogleCalendarError(
      `Google Calendar API error: ${errorData?.error?.message || response.statusText}`,
      response.status
    );
  }

  // Handle empty responses (like for DELETE requests)
  const contentLength = response.headers.get("content-length");
  if (contentLength === "0" || response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch (error) {
    // Some successful responses might not be JSON
    return null;
  }
}

/**
 * Get the primary calendar for the user (or a specific calendar by ID)
 */
export const getCalendar = action({
  args: {
    calendarId: v.optional(v.string()), // Default to "primary"
  },
  handler: async (ctx, { calendarId = "primary" }) => {
    return await googleCalendarRequest(ctx, `/calendars/${calendarId}`);
  },
});

/**
 * List calendars accessible to the user
 * Only used for debugging/setup - not part of main AI tools
 */
export const listCalendars = action({
  handler: async (ctx) => {
    return await googleCalendarRequest(ctx, "/users/me/calendarList");
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
    const params = new URLSearchParams();
    
    if (timeMin) params.append("timeMin", timeMin);
    if (timeMax) params.append("timeMax", timeMax);
    if (maxResults) params.append("maxResults", maxResults.toString());
    if (q) params.append("q", q);
    if (timeZone) params.append("timeZone", timeZone);
    
    // Always order by start time
    params.append("orderBy", "startTime");
    params.append("singleEvents", "true");
    
    const endpoint = `/calendars/${calendarId}/events?${params.toString()}`;
    return await googleCalendarRequest(ctx, endpoint);
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
    return await googleCalendarRequest(ctx, `/calendars/${calendarId}/events`, {
      method: "POST",
      body: JSON.stringify(eventData),
    });
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
    // Remove undefined values to avoid overwriting with null
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );
    
    return await googleCalendarRequest(ctx, `/calendars/${calendarId}/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(cleanUpdateData),
    });
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
    const params = new URLSearchParams();
    if (sendUpdates) params.append("sendUpdates", sendUpdates);
    
    const endpoint = `/calendars/${calendarId}/events/${eventId}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    
    await googleCalendarRequest(ctx, endpoint, {
      method: "DELETE",
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
    return await googleCalendarRequest(ctx, `/calendars/${calendarId}/events/${eventId}`);
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
    const params = new URLSearchParams();
    params.append("q", query);
    
    if (timeMin) params.append("timeMin", timeMin);
    if (timeMax) params.append("timeMax", timeMax);
    if (maxResults) params.append("maxResults", maxResults.toString());
    
    params.append("orderBy", "startTime");
    params.append("singleEvents", "true");
    
    const endpoint = `/calendars/${calendarId}/events?${params.toString()}`;
    return await googleCalendarRequest(ctx, endpoint);
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
    return await googleCalendarRequest(ctx, "/freeBusy", {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  },
});