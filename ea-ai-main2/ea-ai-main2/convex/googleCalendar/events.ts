import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";

// =================================================================
// EVENT OPERATIONS: Full CRUD for Google Calendar events
// =================================================================

/**
 * List events from a calendar with smart filtering and date range support
 */
export const listEvents = action({
  args: {
    calendarId: v.optional(v.string()), // Defaults to 'primary'
    timeMin: v.optional(v.string()), // ISO format
    timeMax: v.optional(v.string()), // ISO format
    maxResults: v.optional(v.number()), // Max 2500
    orderBy: v.optional(v.string()), // 'startTime' or 'updated'
    singleEvents: v.optional(v.boolean()), // Expand recurring events
    showDeleted: v.optional(v.boolean()),
    q: v.optional(v.string()), // Text search query
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<{
    events: Array<{
      id: string;
      summary: string;
      description: string | null;
      location: string | null;
      start: any;
      end: any;
      attendees: any[];
      creator: any;
      organizer: any;
      status: string;
      htmlLink: string;
      created: string;
      updated: string;
      recurringEventId: string | null;
      recurrence: string[] | null;
      etag: string;
    }>;
    totalCount: number;
    nextPageToken: string | null;
    summary: string;
    timeZone: string;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.listEvents", "INITIATED");

    try {
      const calendarId = args.calendarId || "primary";
      const queryParams: Record<string, string> = {};

      // Set default time range to next 30 days if not specified
      if (args.timeMin) {
        queryParams.timeMin = args.timeMin;
      } else {
        queryParams.timeMin = new Date().toISOString();
      }

      if (args.timeMax) {
        queryParams.timeMax = args.timeMax;
      }

      if (args.maxResults) {
        queryParams.maxResults = args.maxResults.toString();
      } else {
        queryParams.maxResults = "50"; // Default limit
      }

      if (args.orderBy) {
        queryParams.orderBy = args.orderBy;
      } else {
        queryParams.orderBy = "startTime";
      }

      if (args.singleEvents !== undefined) {
        queryParams.singleEvents = args.singleEvents.toString();
      } else {
        queryParams.singleEvents = "true"; // Default: expand recurring events
      }

      if (args.showDeleted !== undefined) {
        queryParams.showDeleted = args.showDeleted.toString();
      }

      if (args.q) {
        queryParams.q = args.q;
      }

      if (args.timeZone) {
        queryParams.timeZone = args.timeZone;
      }

      const response: any = await ctx.runAction(api.googleCalendar.client.getFromGoogleCalendar, {
        endpoint: `/calendars/${encodeURIComponent(calendarId)}/events`,
        queryParams,
      });

      // Process events to a consistent format
      const events: any[] = response.items?.map((event: any) => ({
        id: event.id,
        summary: event.summary || "No Title",
        description: event.description || null,
        location: event.location || null,
        start: {
          dateTime: event.start?.dateTime || null,
          date: event.start?.date || null,
          timeZone: event.start?.timeZone || null,
        },
        end: {
          dateTime: event.end?.dateTime || null,
          date: event.end?.date || null,
          timeZone: event.end?.timeZone || null,
        },
        attendees: event.attendees?.map((attendee: any) => ({
          email: attendee.email,
          displayName: attendee.displayName || null,
          responseStatus: attendee.responseStatus || "needsAction",
          organizer: attendee.organizer || false,
        })) || [],
        creator: event.creator ? {
          email: event.creator.email,
          displayName: event.creator.displayName || null,
        } : null,
        organizer: event.organizer ? {
          email: event.organizer.email,
          displayName: event.organizer.displayName || null,
        } : null,
        status: event.status || "confirmed",
        htmlLink: event.htmlLink,
        created: event.created,
        updated: event.updated,
        recurringEventId: event.recurringEventId || null,
        recurrence: event.recurrence || null,
        etag: event.etag,
      })) || [];

      return {
        events,
        totalCount: events.length,
        nextPageToken: response.nextPageToken || null,
        summary: response.summary,
        timeZone: response.timeZone,
      };
    } catch (error) {
      console.error("Failed to list events:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to list events: ${error.message}`
          : "Failed to list events"
      );
    }
  },
});

/**
 * Create a new calendar event with smart date parsing
 */
export const createEventWithSmartDates = action({
  args: {
    calendarId: v.optional(v.string()),
    summary: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(), // Natural language or ISO format
    endDate: v.optional(v.string()), // Natural language or ISO format
    duration: v.optional(v.number()), // Minutes, used if endDate not provided
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())), // Email addresses
    recurrencePattern: v.optional(v.string()), // Natural language recurrence
    timeZone: v.optional(v.string()),
    reminders: v.optional(v.array(v.object({
      method: v.string(), // "email" or "popup"
      minutes: v.number(), // Minutes before event
    }))),
  },
  handler: async (ctx: ActionCtx, args): Promise<{
    id: string;
    summary: string;
    htmlLink: string;
    start: any;
    end: any;
    created: string;
    success: boolean;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.createEventWithSmartDates", "INITIATED");

    try {
      const calendarId = args.calendarId || "primary";

      // Parse start and end dates
      const startDateTime = parseDateTimeString(args.startDate, args.timeZone);
      let endDateTime: Date;

      if (args.endDate) {
        endDateTime = parseDateTimeString(args.endDate, args.timeZone);
      } else if (args.duration) {
        endDateTime = new Date(startDateTime.getTime() + (args.duration * 60 * 1000));
      } else {
        // Default to 1 hour duration
        endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000));
      }

      // Build the event object
      const eventData: any = {
        summary: args.summary,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: args.timeZone || "UTC",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: args.timeZone || "UTC",
        },
      };

      if (args.description) {
        eventData.description = args.description;
      }

      if (args.location) {
        eventData.location = args.location;
      }

      if (args.attendees && args.attendees.length > 0) {
        eventData.attendees = args.attendees.map(email => ({ email }));
      }

      if (args.recurrencePattern) {
        eventData.recurrence = parseRecurrencePattern(args.recurrencePattern);
      }

      if (args.reminders && args.reminders.length > 0) {
        eventData.reminders = {
          useDefault: false,
          overrides: args.reminders.map(reminder => ({
            method: reminder.method,
            minutes: reminder.minutes,
          })),
        };
      }

      const response: any = await ctx.runAction(api.googleCalendar.client.postToGoogleCalendar, {
        endpoint: `/calendars/${encodeURIComponent(calendarId)}/events`,
        body: eventData,
      });

      return {
        id: response.id,
        summary: response.summary,
        htmlLink: response.htmlLink,
        start: response.start,
        end: response.end,
        created: response.created,
        success: true,
      };
    } catch (error) {
      console.error("Failed to create event:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to create event: ${error.message}`
          : "Failed to create event"
      );
    }
  },
});

/**
 * Update an existing calendar event
 */
export const updateEventWithSmartDates = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    duration: v.optional(v.number()),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    recurrencePattern: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    reminders: v.optional(v.array(v.object({
      method: v.string(),
      minutes: v.number(),
    }))),
  },
  handler: async (ctx: ActionCtx, args): Promise<{
    id: string;
    summary: string;
    htmlLink: string;
    start: any;
    end: any;
    updated: string;
    success: boolean;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.updateEventWithSmartDates", "INITIATED");

    try {
      const calendarId = args.calendarId || "primary";
      const updateData: any = {};

      if (args.summary !== undefined) {
        updateData.summary = args.summary;
      }

      if (args.description !== undefined) {
        updateData.description = args.description;
      }

      if (args.location !== undefined) {
        updateData.location = args.location;
      }

      // Handle date/time updates
      if (args.startDate) {
        const startDateTime = parseDateTimeString(args.startDate, args.timeZone);
        updateData.start = {
          dateTime: startDateTime.toISOString(),
          timeZone: args.timeZone || "UTC",
        };

        // If start time changes but no end time specified, maintain duration
        if (!args.endDate && !args.duration) {
          // Get existing event to calculate current duration
          const existingEvent = await ctx.runAction(api.googleCalendar.client.getFromGoogleCalendar, {
            endpoint: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
          });

          if (existingEvent.start?.dateTime && existingEvent.end?.dateTime) {
            const currentStart = new Date(existingEvent.start.dateTime);
            const currentEnd = new Date(existingEvent.end.dateTime);
            const currentDuration = currentEnd.getTime() - currentStart.getTime();
            
            const newEndTime = new Date(startDateTime.getTime() + currentDuration);
            updateData.end = {
              dateTime: newEndTime.toISOString(),
              timeZone: args.timeZone || "UTC",
            };
          }
        }
      }

      if (args.endDate) {
        const endDateTime = parseDateTimeString(args.endDate, args.timeZone);
        updateData.end = {
          dateTime: endDateTime.toISOString(),
          timeZone: args.timeZone || "UTC",
        };
      } else if (args.duration && updateData.start) {
        const startTime = new Date(updateData.start.dateTime);
        const endTime = new Date(startTime.getTime() + (args.duration * 60 * 1000));
        updateData.end = {
          dateTime: endTime.toISOString(),
          timeZone: args.timeZone || "UTC",
        };
      }

      if (args.attendees !== undefined) {
        updateData.attendees = args.attendees.map(email => ({ email }));
      }

      if (args.recurrencePattern !== undefined) {
        updateData.recurrence = parseRecurrencePattern(args.recurrencePattern);
      }

      if (args.reminders !== undefined) {
        if (args.reminders.length > 0) {
          updateData.reminders = {
            useDefault: false,
            overrides: args.reminders.map(reminder => ({
              method: reminder.method,
              minutes: reminder.minutes,
            })),
          };
        } else {
          updateData.reminders = { useDefault: true };
        }
      }

      // Only make the API call if there are actual changes
      if (Object.keys(updateData).length === 0) {
        throw new Error("No changes specified for event update");
      }

      const response: any = await ctx.runAction(api.googleCalendar.client.patchToGoogleCalendar, {
        endpoint: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
        body: updateData,
      });

      return {
        id: response.id,
        summary: response.summary,
        htmlLink: response.htmlLink,
        start: response.start,
        end: response.end,
        updated: response.updated,
        success: true,
      };
    } catch (error) {
      console.error("Failed to update event:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to update event: ${error.message}`
          : "Failed to update event"
      );
    }
  },
});

/**
 * Delete a calendar event
 */
export const deleteCalendarEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
    sendUpdates: v.optional(v.string()), // "all", "externalOnly", "none"
  },
  handler: async (ctx: ActionCtx, args): Promise<{
    success: boolean;
    eventId: string;
    deleted: boolean;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.deleteCalendarEvent", "INITIATED");

    try {
      const calendarId = args.calendarId || "primary";
      const queryParams: Record<string, string> = {};

      if (args.sendUpdates) {
        queryParams.sendUpdates = args.sendUpdates;
      } else {
        queryParams.sendUpdates = "all"; // Default: notify all attendees
      }

      await ctx.runAction(api.googleCalendar.client.deleteFromGoogleCalendar, {
        endpoint: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
        queryParams,
      });

      return {
        success: true,
        eventId: args.eventId,
        deleted: true,
      };
    } catch (error) {
      console.error("Failed to delete event:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to delete event: ${error.message}`
          : "Failed to delete event"
      );
    }
  },
});

/**
 * Search for events across calendars
 */
export const searchCalendarEvents = action({
  args: {
    query: v.string(),
    calendarId: v.optional(v.string()),
    timeRange: v.optional(v.string()), // Natural language: "this week", "next month"
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.searchCalendarEvents", "INITIATED");

    try {
      // Parse time range if provided
      const timeRange = parseTimeRange(args.timeRange);

      const searchArgs: any = {
        calendarId: args.calendarId,
        q: args.query,
        maxResults: args.maxResults || 20,
        singleEvents: true,
        orderBy: "startTime",
      };

      if (timeRange.timeMin) {
        searchArgs.timeMin = timeRange.timeMin;
      }

      if (timeRange.timeMax) {
        searchArgs.timeMax = timeRange.timeMax;
      }

      return await ctx.runAction(api.googleCalendar.events.listEvents, searchArgs);
    } catch (error) {
      console.error("Failed to search events:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to search events: ${error.message}`
          : "Failed to search events"
      );
    }
  },
});

/**
 * Get current time with timezone support
 */
export const getCurrentTime = action({
  args: {
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<{
    timestamp: number;
    iso: string;
    timeZone: string;
    formatted: string;
  }> => {
    const { userId } = await requireUserAuthForAction(ctx);
    logUserAccess(userId, "googleCalendar.events.getCurrentTime", "SUCCESS");

    const now = new Date();
    
    return {
      timestamp: now.getTime(),
      iso: now.toISOString(),
      timeZone: args.timeZone || "UTC",
      formatted: args.timeZone 
        ? now.toLocaleString("en-US", { timeZone: args.timeZone })
        : now.toUTCString(),
    };
  },
});

// =================================================================
// HELPER FUNCTIONS: Date parsing and formatting
// =================================================================

/**
 * Parse a date/time string that could be natural language or ISO format
 */
function parseDateTimeString(dateString: string, timeZone?: string): Date {
  // First, try parsing as ISO format
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // For natural language parsing, we'll implement basic patterns
  // In a production app, you might want to use a library like chrono-node
  const now = new Date();
  const lowerStr = dateString.toLowerCase().trim();

  // Handle relative dates
  if (lowerStr.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return parseTimeInString(dateString, tomorrow);
  }

  if (lowerStr.includes("today")) {
    return parseTimeInString(dateString, now);
  }

  if (lowerStr.includes("next week")) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return parseTimeInString(dateString, nextWeek);
  }

  // Handle day names (next Monday, Tuesday, etc.)
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (lowerStr.includes(dayNames[i])) {
      const targetDay = new Date(now);
      const currentDay = targetDay.getDay();
      const daysUntilTarget = (i - currentDay + 7) % 7 || 7; // Next occurrence
      targetDay.setDate(targetDay.getDate() + daysUntilTarget);
      return parseTimeInString(dateString, targetDay);
    }
  }

  // If all else fails, return current time
  console.warn(`Could not parse date string: ${dateString}, using current time`);
  return now;
}

/**
 * Extract time information from a string and apply it to a date
 */
function parseTimeInString(str: string, baseDate: Date): Date {
  const timeRegex = /(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i;
  const match = str.match(timeRegex);
  
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();

    if (period === "pm" && hours !== 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  // Default to 9 AM if no time specified
  const result = new Date(baseDate);
  result.setHours(9, 0, 0, 0);
  return result;
}

/**
 * Parse recurrence pattern from natural language
 */
function parseRecurrencePattern(pattern: string): string[] {
  const lowerPattern = pattern.toLowerCase().trim();
  
  if (lowerPattern.includes("daily") || lowerPattern === "every day") {
    return ["RRULE:FREQ=DAILY"];
  }
  
  if (lowerPattern.includes("weekly") || lowerPattern === "every week") {
    return ["RRULE:FREQ=WEEKLY"];
  }
  
  if (lowerPattern.includes("monthly") || lowerPattern === "every month") {
    return ["RRULE:FREQ=MONTHLY"];
  }
  
  if (lowerPattern.includes("every tuesday")) {
    return ["RRULE:FREQ=WEEKLY;BYDAY=TU"];
  }
  
  if (lowerPattern.includes("every 2 weeks")) {
    return ["RRULE:FREQ=WEEKLY;INTERVAL=2"];
  }

  // Return empty array if pattern not recognized
  console.warn(`Could not parse recurrence pattern: ${pattern}`);
  return [];
}

/**
 * Parse time range from natural language
 */
function parseTimeRange(timeRange?: string): { timeMin?: string; timeMax?: string } {
  if (!timeRange) {
    return {};
  }

  const now = new Date();
  const lowerRange = timeRange.toLowerCase().trim();

  if (lowerRange === "today") {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    };
  }

  if (lowerRange === "this week") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfWeek.toISOString(),
    };
  }

  if (lowerRange === "next week") {
    const startOfNextWeek = new Date(now);
    startOfNextWeek.setDate(now.getDate() - now.getDay() + 7);
    startOfNextWeek.setHours(0, 0, 0, 0);
    
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
    endOfNextWeek.setHours(23, 59, 59, 999);
    
    return {
      timeMin: startOfNextWeek.toISOString(),
      timeMax: endOfNextWeek.toISOString(),
    };
  }

  if (lowerRange === "this month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return {
      timeMin: startOfMonth.toISOString(),
      timeMax: endOfMonth.toISOString(),
    };
  }

  return {};
}