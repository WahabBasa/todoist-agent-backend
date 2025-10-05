import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";

// Google Calendar Tools - Extracted from ai.ts.backup and converted to new ToolDefinition format
// These tools provide comprehensive Google Calendar integration for the AI agent

export const GoogleCalendarTools: Record<string, ToolDefinition> = {
  createCalendarEvent: {
    id: "createCalendarEvent",
    description: "Create a new event in your Google Calendar with smart date parsing. Supports natural language dates like 'tomorrow at 2pm', 'next Monday at 9am', and recurring events. Use this when users want to schedule appointments, meetings, or reminders.",
    inputSchema: z.object({
      summary: z.string().describe("The event title (e.g., 'Team Meeting', 'Doctor Appointment', 'Project Deadline')"),
      description: z.string().optional().describe("Optional event description or notes"),
      startDate: z.string().describe("Event start time - supports natural language like 'tomorrow at 2pm', 'next Friday at 10am', '2024-12-25 14:00', or ISO format"),
      endDate: z.string().optional().describe("Event end time - natural language or specific time. If not provided, will default to 1 hour duration"),
      duration: z.number().optional().describe("Event duration in minutes if endDate not specified (default: 60)"),
      location: z.string().optional().describe("Event location or meeting URL"),
      attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
      recurrencePattern: z.string().optional().describe("Recurring pattern like 'every day', 'every Tuesday', 'every week', 'every 2 weeks'"),
      timeZone: z.string().optional().describe("Timezone (e.g., 'America/New_York', 'Europe/London'). Defaults to UTC"),
      reminders: z.object({
        useDefault: z.boolean().describe("Use default calendar reminders"),
        overrides: z.array(z.object({
          method: z.string().describe("Reminder method: 'email' or 'popup'"),
          minutes: z.number().describe("Minutes before event to remind"),
        })).optional(),
      }).optional(),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      // console.log(`[GoogleCalendar] Creating calendar event: ${args.summary}`);
      
      try {
        // Calculate duration from start and end dates
        const startTime = new Date(args.startDate);
        const endTime = args.endDate ? new Date(args.endDate) : new Date(startTime.getTime() + (args.duration || 60) * 60000);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        
        const result = await actionCtx.runAction(api.googleCalendar.auth.createCalendarEvent, {
          title: args.summary,
          startTime: startTime.toISOString(),
          durationMinutes,
          description: args.description,
          attendeeEmails: args.attendees,
        });
        
        return {
          title: `Calendar Event Created: ${args.summary}`,
          metadata: {
            eventId: result.id,
            startTime: startTime.toISOString(),
            duration: durationMinutes,
            attendees: args.attendees?.length || 0
          },
          output: `✅ Successfully created calendar event "${args.summary}" for ${startTime.toLocaleString()}${args.location ? ` at ${args.location}` : ''}${args.attendees?.length ? ` with ${args.attendees.length} attendees` : ''}.`
        };
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error creating calendar event";
        console.error(`[GoogleCalendar] Create event failed:`, errorMessage);
        
        return {
          title: `Calendar Event Creation Failed`,
          metadata: { error: errorMessage },
          output: `❌ Failed to create calendar event: ${errorMessage}. Please check your Google Calendar connection and try again.`
        };
      }
    }
  },

  updateCalendarEvent: {
    id: "updateCalendarEvent", 
    description: "Update an existing event in your Google Calendar with smart date parsing. Supports modifying recurring events with different scopes. Use this when users want to change event details, reschedule, or modify recurring patterns.",
    inputSchema: z.object({
      eventId: z.string().describe("The Google Calendar event ID to update"),
      summary: z.string().optional().describe("New event title"),
      description: z.string().optional().describe("Updated event description"),
      startDate: z.string().optional().describe("New start time - supports natural language like 'move to tomorrow', 'next week at 3pm'"),
      endDate: z.string().optional().describe("New end time - natural language or specific time"),
      duration: z.number().optional().describe("New duration in minutes if endDate not specified"),
      location: z.string().optional().describe("Updated location"),
      attendees: z.array(z.string()).optional().describe("Updated attendee email list"),
      recurrencePattern: z.string().optional().describe("Updated recurrence pattern"),
      timeZone: z.string().optional().describe("Timezone for new times"),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      console.log(`[GoogleCalendar] Updating calendar event: ${args.eventId}`);
      
      // Temporarily disabled - simplified version coming soon
      return {
        title: "Calendar Event Update Temporarily Unavailable",
        metadata: { eventId: args.eventId },
        output: "❌ Update calendar events temporarily unavailable. Please delete and recreate the event for now."
      };
    }
  },

  deleteCalendarEvent: {
    id: "deleteCalendarEvent",
    description: "Delete an event from your Google Calendar. For recurring events, this will delete all instances unless specified otherwise. Use this when users want to cancel or remove events from their calendar.",
    inputSchema: z.object({
      eventId: z.string().describe("The Google Calendar event ID to delete"),
      sendUpdates: z.string().optional().describe("Whether to send cancellation notifications: 'all', 'externalOnly', or 'none' (default: 'all')"),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      console.log(`[GoogleCalendar] Deleting calendar event: ${args.eventId}`);
      
      // Temporarily disabled - simplified version coming soon
      return {
        title: "Calendar Event Deletion Temporarily Unavailable",
        metadata: { eventId: args.eventId },
        output: "❌ Delete calendar events temporarily unavailable. Contact support if urgent."
      };
    }
  },

  listCalendarEvents: {
    id: "listCalendarEvents",
    description: "List upcoming events from your Google Calendar with smart date filtering. Use this when users ask about their schedule, upcoming events, or want to see what they have planned. Supports natural language time ranges.",
    inputSchema: z.object({
      timeRange: z.string().optional().describe("Natural language time range like 'today', 'tomorrow', 'this week', 'next week', 'this month', or 'next 7 days'"),
      timeMin: z.string().optional().describe("Specific start time override (ISO format)"),
      timeMax: z.string().optional().describe("Specific end time override (ISO format)"),
      maxResults: z.number().optional().describe("Maximum number of events to return (default: 20, max: 100)"),
      timeZone: z.string().optional().describe("Timezone for results (default: UTC)"),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      console.log(`[GoogleCalendar] Listing calendar events for range: ${args.timeRange || 'default'}`);
      
      try {
        // Parse time range to specific dates if provided
        let timeMin = args.timeMin;
        let timeMax = args.timeMax;
        
        if (args.timeRange && !timeMin && !timeMax) {
          // Handle natural language time ranges
          const now = new Date();
          const lowerRange = args.timeRange.toLowerCase().trim();
          
          if (lowerRange === "today") {
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            timeMin = startOfDay.toISOString();
            timeMax = endOfDay.toISOString();
          } else if (lowerRange === "this week") {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            timeMin = startOfWeek.toISOString();
            timeMax = endOfWeek.toISOString();
          } else if (lowerRange === "next week") {
            const startOfNextWeek = new Date(now);
            startOfNextWeek.setDate(now.getDate() - now.getDay() + 7);
            startOfNextWeek.setHours(0, 0, 0, 0);
            const endOfNextWeek = new Date(startOfNextWeek);
            endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
            endOfNextWeek.setHours(23, 59, 59, 999);
            timeMin = startOfNextWeek.toISOString();
            timeMax = endOfNextWeek.toISOString();
          } else if (lowerRange === "this month") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            timeMin = startOfMonth.toISOString();
            timeMax = endOfMonth.toISOString();
          }
        }
        
        const result = await actionCtx.runAction(api.googleCalendar.auth.getCalendarEventTimes, {
          start: timeMin || new Date().toISOString(),
          end: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
        });
        
        const eventCount = result?.length || 0;
        const timeRangeDesc = args.timeRange || "next 7 days";
        
        // Return selective summary instead of full list
        if (eventCount === 0) {
          return {
            title: `Calendar Events Listed (0 events)`,
            metadata: { eventCount: 0, timeRange: timeRangeDesc },
            output: `No events found for ${timeRangeDesc}.`
          };
        }
        
        // For many events, provide summary with key highlights
        if (eventCount > 5) {
          // Filter out routine events (sleep, morning routine, etc.) to find highlights
          const routineKeywords = ['sleep', 'morning routine', 'routine', 'daily'];
          const highlights = result?.filter((event: any) => 
            !routineKeywords.some(keyword => 
              event.title?.toLowerCase().includes(keyword)
            )
          ) || [];
          
          if (highlights.length > 0) {
            const keyEvents = highlights.slice(0, 3).map((event: any) => 
              `${event.title} on ${new Date(event.start).toLocaleDateString()}`
            ).join(', ');
            return {
              title: `Calendar Events Listed (${eventCount} events)`,
              metadata: { eventCount, timeRange: timeRangeDesc, highlights: highlights.length },
              output: `${eventCount} events scheduled for ${timeRangeDesc}. Key events: ${keyEvents}.`
            };
          }
        }
        
        // For 5 or fewer events, list them all
        const eventList = result?.slice(0, 5).map((event: any) => 
          `${event.title} on ${new Date(event.start).toLocaleDateString()}${event.isAllDay ? ' (all day)' : ` at ${new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}`
        ).join(', ') || '';
        
        return {
          title: `Calendar Events Listed (${eventCount} events)`,
          metadata: { eventCount, timeRange: timeRangeDesc },
          output: `${eventCount} events for ${timeRangeDesc}: ${eventList}.`
        };
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error listing calendar events";
        console.error(`[GoogleCalendar] List events failed:`, errorMessage);
        
        return {
          title: "Calendar Events List Failed",
          metadata: { error: errorMessage },
          output: `❌ Failed to list calendar events: ${errorMessage}. Please check your Google Calendar connection.`
        };
      }
    }
  },

  searchCalendarEvents: {
    id: "searchCalendarEvents",
    description: "Search your Google Calendar events by text query. Searches across event titles, descriptions, locations, and attendees. Use this when users want to find specific events or meetings.",
    inputSchema: z.object({
      query: z.string().describe("Search query text (e.g., 'team meeting', 'doctor', 'project review', 'John Smith')"),
      timeRange: z.string().optional().describe("Optional time range to limit search: 'this week', 'next week', 'this month'"),
      maxResults: z.number().optional().describe("Maximum number of results (default: 20)"),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      console.log(`[GoogleCalendar] Searching calendar events for: ${args.query}`);
      
      // Temporarily disabled - simplified version coming soon  
      return {
        title: "Calendar Event Search Temporarily Unavailable",
        metadata: { query: args.query },
        output: "❌ Search calendar events temporarily unavailable. Use listCalendarEvents instead."
      };
    }
  },

  getCurrentTime: {
    id: "getCurrentTime",
    description: "Get current time and timezone information from the user's Google Calendar settings. Use this to understand the current context for scheduling and date calculations, especially when users reference relative times like 'tomorrow' or 'next week'. Returns user's actual timezone and time format preferences.",
    inputSchema: z.object({
      timeZone: z.string().optional().describe("Override timezone (e.g., 'America/New_York', 'Europe/London'). If not provided, uses user's Google Calendar timezone setting."),
    }),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      console.log(`[GoogleCalendar] Getting current time context`);
      
      // Use current time provided by user's browser (no calculations needed)
      if ((context as any).currentTimeContext) {
        console.log("[getCurrentTime] Using browser-provided time context");
        const timeContext = (context as any).currentTimeContext;
        
        return {
          title: "Current Time Retrieved",
          metadata: {
            source: timeContext.source || "user_browser",
            timezone: timeContext.userTimezone,
            timestamp: timeContext.timestamp
          },
          output: `${timeContext.localTime} (${timeContext.userTimezone})`
        };
      } else {
        // Fallback to server time if no context provided
        console.warn("[getCurrentTime] No browser context provided, using server time");
        const now = new Date();
        
        return {
          title: "Current Time Retrieved (Server Fallback)",
          metadata: {
            source: "server_fallback",
            timezone: "UTC",
            timestamp: now.getTime()
          },
          output: now.toLocaleString()
        };
      }
    }
  }
};