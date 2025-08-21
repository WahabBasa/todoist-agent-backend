import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { 
  parseSmartDate, 
  parseRecurrence, 
  createTimeObject, 
  formatEventSummary, 
  getCurrentTimeWithTimezone 
} from "./utils";

/**
 * Create a Google Calendar event with smart date parsing
 * Handles natural language dates and recurring event patterns
 */
export const createEventWithSmartDates = action({
  args: {
    calendarId: v.optional(v.string()),
    summary: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(), // Can be natural language like "tomorrow at 2pm"
    endDate: v.optional(v.string()), // Can be natural language
    duration: v.optional(v.number()), // Duration in minutes if endDate not provided
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())), // Email addresses
    recurrencePattern: v.optional(v.string()), // Natural language like "every Tuesday"
    timeZone: v.optional(v.string()),
    reminders: v.optional(v.object({
      useDefault: v.boolean(),
      overrides: v.optional(v.array(v.object({
        method: v.string(), // "email" or "popup"
        minutes: v.number(),
      }))),
    })),
  },
  handler: async (ctx, { 
    calendarId = "primary",
    summary,
    description,
    startDate,
    endDate,
    duration = 60, // Default 1 hour
    location,
    attendees,
    recurrencePattern,
    timeZone = "UTC",
    reminders,
  }) => {
    // Parse smart dates
    const parsedStartDate = parseSmartDate(startDate, timeZone);
    
    let parsedEndDate: string;
    if (endDate) {
      parsedEndDate = parseSmartDate(endDate, timeZone);
    } else {
      // Calculate end date from duration
      const startDateTime = new Date(parsedStartDate);
      const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));
      parsedEndDate = endDateTime.toISOString().slice(0, 19);
    }
    
    // Create time objects with timezone support
    const startTimeObject = createTimeObject(parsedStartDate, timeZone);
    const endTimeObject = createTimeObject(parsedEndDate, timeZone);
    
    // Parse recurrence pattern if provided
    const recurrence = recurrencePattern ? parseRecurrence(recurrencePattern) : undefined;
    
    // Convert attendee emails to Google Calendar format
    const formattedAttendees = attendees?.map(email => ({ email }));
    
    try {
      const event = await ctx.runAction(api.googleCalendar.client.createEvent, {
        calendarId,
        summary,
        description,
        start: startTimeObject,
        end: endTimeObject,
        location,
        attendees: formattedAttendees,
        recurrence,
        reminders: reminders || { useDefault: true },
      });
      
      return {
        success: true,
        event,
        summary: formatEventSummary(event),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        parsedDates: {
          start: parsedStartDate,
          end: parsedEndDate,
          recurrence: recurrence,
        },
      };
    }
  },
});

/**
 * Update a Google Calendar event with smart date parsing
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
    reminders: v.optional(v.object({
      useDefault: v.boolean(),
      overrides: v.optional(v.array(v.object({
        method: v.string(),
        minutes: v.number(),
      }))),
    })),
  },
  handler: async (ctx, { 
    calendarId = "primary",
    eventId,
    summary,
    description,
    startDate,
    endDate,
    duration,
    location,
    attendees,
    recurrencePattern,
    timeZone = "UTC",
    reminders,
  }) => {
    try {
      // Get existing event for reference
      const existingEvent = await ctx.runAction(api.googleCalendar.client.getEvent, {
        calendarId,
        eventId,
      });
      
      if (!existingEvent) {
        return {
          success: false,
          error: "Event not found",
        };
      }
      
      // Prepare update data
      const updateData: any = {};
      
      if (summary !== undefined) updateData.summary = summary;
      if (description !== undefined) updateData.description = description;
      if (location !== undefined) updateData.location = location;
      if (reminders !== undefined) updateData.reminders = reminders;
      
      // Handle date updates
      if (startDate) {
        const parsedStartDate = parseSmartDate(startDate, timeZone);
        updateData.start = createTimeObject(parsedStartDate, timeZone);
        
        // If only start date is updated and duration is provided, calculate new end date
        if (!endDate && duration) {
          const startDateTime = new Date(parsedStartDate);
          const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));
          const parsedEndDate = endDateTime.toISOString().slice(0, 19);
          updateData.end = createTimeObject(parsedEndDate, timeZone);
        }
      }
      
      if (endDate) {
        const parsedEndDate = parseSmartDate(endDate, timeZone);
        updateData.end = createTimeObject(parsedEndDate, timeZone);
      }
      
      // Handle attendees
      if (attendees) {
        updateData.attendees = attendees.map(email => ({ email }));
      }
      
      // Handle recurrence updates
      if (recurrencePattern) {
        const recurrence = parseRecurrence(recurrencePattern);
        if (recurrence) {
          updateData.recurrence = recurrence;
        }
      }
      
      const updatedEvent = await ctx.runAction(api.googleCalendar.client.updateEvent, {
        calendarId,
        eventId,
        ...updateData,
      });
      
      return {
        success: true,
        event: updatedEvent,
        summary: formatEventSummary(updatedEvent),
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Delete a Google Calendar event
 */
export const deleteCalendarEvent = action({
  args: {
    calendarId: v.optional(v.string()),
    eventId: v.string(),
    sendUpdates: v.optional(v.string()), // "all", "externalOnly", "none"
  },
  handler: async (ctx, { calendarId = "primary", eventId, sendUpdates = "all" }) => {
    try {
      // Get event details before deletion for confirmation
      const event = await ctx.runAction(api.googleCalendar.client.getEvent, {
        calendarId,
        eventId,
      });
      
      if (!event) {
        return {
          success: false,
          error: "Event not found",
        };
      }
      
      const result = await ctx.runAction(api.googleCalendar.client.deleteEvent, {
        calendarId,
        eventId,
        sendUpdates,
      });
      
      return {
        success: true,
        deletedEvent: {
          id: eventId,
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
        },
        message: `Successfully deleted event: ${event.summary}`,
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * List calendar events with smart date filtering
 */
export const listEventsWithSmartDates = action({
  args: {
    calendarId: v.optional(v.string()),
    timeRange: v.optional(v.string()), // Natural language like "this week", "next month"
    timeMin: v.optional(v.string()), // Override with specific date
    timeMax: v.optional(v.string()), // Override with specific date
    maxResults: v.optional(v.number()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, { 
    calendarId = "primary",
    timeRange,
    timeMin,
    timeMax,
    maxResults = 20,
    timeZone = "UTC",
  }) => {
    try {
      let parsedTimeMin = timeMin;
      let parsedTimeMax = timeMax;
      
      // Parse natural language time ranges
      if (timeRange && !timeMin && !timeMax) {
        const now = new Date();
        const rangeLower = timeRange.toLowerCase();
        
        if (rangeLower.includes('today')) {
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          parsedTimeMin = today.toISOString();
          
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);
          parsedTimeMax = endOfDay.toISOString();
        } else if (rangeLower.includes('tomorrow')) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          parsedTimeMin = tomorrow.toISOString();
          
          const endOfTomorrow = new Date(tomorrow);
          endOfTomorrow.setHours(23, 59, 59, 999);
          parsedTimeMax = endOfTomorrow.toISOString();
        } else if (rangeLower.includes('this week')) {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day;
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0, 0, 0, 0);
          parsedTimeMin = startOfWeek.toISOString();
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          parsedTimeMax = endOfWeek.toISOString();
        } else if (rangeLower.includes('next week')) {
          const nextWeekStart = new Date(now);
          const day = nextWeekStart.getDay();
          const diff = nextWeekStart.getDate() - day + 7;
          nextWeekStart.setDate(diff);
          nextWeekStart.setHours(0, 0, 0, 0);
          parsedTimeMin = nextWeekStart.toISOString();
          
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
          nextWeekEnd.setHours(23, 59, 59, 999);
          parsedTimeMax = nextWeekEnd.toISOString();
        } else if (rangeLower.includes('this month')) {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          parsedTimeMin = startOfMonth.toISOString();
          
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
          parsedTimeMax = endOfMonth.toISOString();
        } else {
          // Default to next 7 days
          parsedTimeMin = now.toISOString();
          const weekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
          parsedTimeMax = weekFromNow.toISOString();
        }
      }
      
      const result = await ctx.runAction(api.googleCalendar.client.listEvents, {
        calendarId,
        timeMin: parsedTimeMin,
        timeMax: parsedTimeMax,
        maxResults,
        timeZone,
      });
      
      return {
        success: true,
        events: result.items || [],
        summary: `Found ${result.items?.length || 0} events${timeRange ? ` for "${timeRange}"` : ''}`,
        timeRange: {
          min: parsedTimeMin,
          max: parsedTimeMax,
        },
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Search calendar events with text query
 */
export const searchCalendarEvents = action({
  args: {
    calendarId: v.optional(v.string()),
    query: v.string(),
    timeRange: v.optional(v.string()),
    maxResults: v.optional(v.number()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, { 
    calendarId = "primary",
    query,
    timeRange,
    maxResults = 20,
    timeZone = "UTC",
  }) => {
    try {
      let timeMin: string | undefined;
      let timeMax: string | undefined;
      
      // Parse time range if provided
      if (timeRange) {
        const now = new Date();
        const rangeLower = timeRange.toLowerCase();
        
        if (rangeLower.includes('this week')) {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day;
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0, 0, 0, 0);
          timeMin = startOfWeek.toISOString();
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          timeMax = endOfWeek.toISOString();
        } else if (rangeLower.includes('next week')) {
          const nextWeekStart = new Date(now);
          const day = nextWeekStart.getDay();
          const diff = nextWeekStart.getDate() - day + 7;
          nextWeekStart.setDate(diff);
          nextWeekStart.setHours(0, 0, 0, 0);
          timeMin = nextWeekStart.toISOString();
          
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
          nextWeekEnd.setHours(23, 59, 59, 999);
          timeMax = nextWeekEnd.toISOString();
        }
      }
      
      const result = await ctx.runAction(api.googleCalendar.client.searchEvents, {
        calendarId,
        query,
        timeMin,
        timeMax,
        maxResults,
      });
      
      return {
        success: true,
        events: result.items || [],
        summary: `Found ${result.items?.length || 0} events matching "${query}"${timeRange ? ` in "${timeRange}"` : ''}`,
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Get current time information (useful for the AI to understand context)
 */
export const getCurrentTime = action({
  args: {
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, { timeZone }) => {
    const timeInfo = getCurrentTimeWithTimezone(timeZone);
    
    return {
      success: true,
      ...timeInfo,
      formatted: `Current time: ${timeInfo.currentTime} (${timeInfo.timezone})`,
    };
  },
});