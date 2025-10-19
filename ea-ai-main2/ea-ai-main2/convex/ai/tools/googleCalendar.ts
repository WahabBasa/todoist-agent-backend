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
      startDate: z.string().describe("Local date-time string (YYYY-MM-DDTHH:MM:SS), no Z or offsets. Preserve exact user time."),
      endDate: z.string().optional().describe("Local end date-time (YYYY-MM-DDTHH:MM:SS). If not provided, duration is required or defaults to 60 minutes."),
      duration: z.number().optional().describe("Event duration in minutes if endDate not specified (default: 60)"),
      location: z.string().optional().describe("Event location or meeting URL"),
      attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
      recurrencePattern: z.string().optional().describe("Recurring pattern like 'every day', 'every Tuesday', 'every week', 'every 2 weeks'"),
      timeZone: z.string().optional().describe("IANA timezone (e.g., 'America/New_York'). If omitted, will be resolved from Google Calendar settings."),
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
      void context;
      
      try {
        // Resolve timezone (prefer provided, then user calendar settings, then current calendar time)
        let tz: string | undefined = args.timeZone;
        let tzSource: string = tz ? 'args' : 'settings';
        if (!tz) {
          try {
            const settings: any = await actionCtx.runAction(api.googleCalendar.auth.getUserCalendarSettings, {});
            tz = settings?.timezone;
            tzSource = 'settings';
          } catch { /* ignore */ }
        }
        if (!tz) {
          try {
            const nowCtx: any = await actionCtx.runAction(api.googleCalendar.auth.getCurrentCalendarTime, {});
            tz = nowCtx?.userTimezone;
            tzSource = 'calendarTime';
          } catch { /* ignore */ }
        }
        if (!tz) throw new Error("Cannot resolve user timezone. Provide timeZone or connect Google Calendar.");

        // Validate start/end local strings (do not convert to UTC)
        const startLocal: string = String(args.startDate);
        if (hasOffsetOrZ(startLocal)) throw new Error("startDate must be local (no Z or offset). Provide YYYY-MM-DDTHH:MM:SS and a separate timeZone.");
        const endLocal: string = args.endDate ? String(args.endDate) : addMinutesLocal(startLocal, args.duration ?? 60);
        if (args.endDate && hasOffsetOrZ(endLocal)) throw new Error("endDate must be local (no Z or offset). Provide YYYY-MM-DDTHH:MM:SS and a separate timeZone.");

        // Preflight: verify connection
        const hasConn = await actionCtx.runAction(api.googleCalendar.auth.hasGoogleCalendarConnection as any, {});
        if (!hasConn?.success) {
          throw new Error(hasConn?.error || "Google Calendar not connected. Please connect in Settings.");
        }

        const result = await actionCtx.runAction(api.googleCalendar.auth.createCalendarEvent as any, {
          title: args.summary,
          start: { dateTime: startLocal, timeZone: tz },
          end: { dateTime: endLocal, timeZone: tz },
          description: args.description,
          attendeeEmails: args.attendees,
        } as any);
        
        return {
          title: `Calendar Event Created: ${args.summary}`,
          metadata: {
            eventId: result.id,
            startTime: startLocal,
            endTime: endLocal,
            timeZone: tz,
            timeZoneSource: tzSource,
            attendees: args.attendees?.length || 0
          },
          output: `✅ Created calendar event "${args.summary}" for ${startLocal} (${tz})${args.location ? ` at ${args.location}` : ''}${args.attendees?.length ? ` with ${args.attendees.length} attendees` : ''}.`
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
      void context; void actionCtx;
      
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
      void context; void actionCtx;
      
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
    description: "List calendar events for an arbitrary date window. Provide explicit ISO boundaries so the model can request ANY range. Always compute a concrete window before calling (e.g., using current time + user timezone). Returns raw JSON events, not prose.",
    inputSchema: z.union([
      z.object({
        timeMin: z.string().describe("Start (ISO 8601) of the desired window, e.g. '2025-10-19T00:00:00Z'"),
        timeMax: z.string().describe("End (ISO 8601) of the desired window, e.g. '2025-10-19T23:59:59Z'"),
        timeZone: z.string().optional().describe("IANA timezone used to compute this window (e.g., 'Europe/London'). Optional metadata."),
        maxResults: z.number().optional().describe("Max events (server may cap)."),
        calendarIds: z.array(z.string()).optional().describe("Optional set of calendar IDs. Not yet supported; primary is used if omitted."),
      }),
      z.object({
        nlRange: z.string().describe("Natural language range resolved by the model (e.g., 'next 3 days', 'tomorrow 9-5'). If provided alone, the tool will request explicit timeMin/timeMax instead of guessing."),
        referenceTime: z.string().optional().describe("Reference time (ISO) used by the model to resolve nlRange."),
        timeZone: z.string().optional().describe("IANA timezone used to resolve nlRange."),
        maxResults: z.number().optional(),
        calendarIds: z.array(z.string()).optional(),
      })
    ]),
    async execute(args: any, context: ToolContext, actionCtx: ActionCtx) {
      // Expect explicit ISO boundaries for full flexibility
      const hasExplicitRange = typeof args?.timeMin === 'string' && typeof args?.timeMax === 'string';
      const tz = typeof args?.timeZone === 'string' ? args.timeZone : undefined;
      if (!hasExplicitRange) {
        // Do not guess ranges in the tool. Ask the model to compute and supply explicit timeMin/timeMax.
        return {
          title: "Calendar Events (range required)",
          metadata: { error: "missing_range" },
          output: JSON.stringify({
            error: "missing_range",
            message: "Provide explicit timeMin and timeMax (ISO) based on the user's timezone (use getCurrentTime() or calendar settings). Example: { timeMin: '2025-10-19T00:00:00Z', timeMax: '2025-10-19T23:59:59Z' }.",
          }),
        };
      }
      console.log(`[GoogleCalendar] Listing calendar events for explicit window`, { timeMin: args.timeMin, timeMax: args.timeMax, timeZone: tz });
      void context;
      
      try {
        const timeMin: string = args.timeMin;
        const timeMax: string = args.timeMax;

        const result = await actionCtx.runAction(api.googleCalendar.auth.getCalendarEventTimes, {
          start: timeMin,
          end: timeMax,
        });

        const events = Array.isArray(result) ? result.map((e: any) => ({
          title: e.title,
          start: e.start,
          end: e.end,
          isAllDay: !!e.isAllDay,
        })) : [];

        const meta = { count: events.length, start: timeMin, end: timeMax, timeZone: tz };
        console.log(`[GoogleCalendar] Window result`, meta);

        return {
          title: `Calendar Events (${events.length})`,
          metadata: { eventCount: events.length, start: timeMin, end: timeMax, timeZone: tz },
          output: JSON.stringify({ events, meta }),
        };
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error listing calendar events";
        console.error(`[GoogleCalendar] List events failed:`, errorMessage);
        return {
          title: "Calendar Events List Failed",
          metadata: { error: errorMessage },
          output: JSON.stringify({ error: true, message: errorMessage }),
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
      void context; void actionCtx;
      
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
      void args;
      // Prefer Google Calendar-based timezone
      try {
        const calNow: any = await actionCtx.runAction(api.googleCalendar.auth.getCurrentCalendarTime, {});
        return {
          title: "Current Time Retrieved",
          metadata: {
            source: calNow.source || "google_calendar_timezone",
            timezone: calNow.userTimezone,
            timestamp: calNow.timestamp
          },
          output: `${calNow.localTime} (${calNow.userTimezone})`
        };
      } catch {
        // Use browser-provided time context if available
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
        }
        // Fallback to server time if no other context provided
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

// Helper: add minutes to a local date-time string (YYYY-MM-DDTHH:MM:SS), no timezone math
function addMinutesLocal(localDateTime: string, minutes: number): string {
  // minimal validation and parsing
  const m = localDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error("Invalid local date-time format; expected YYYY-MM-DDTHH:MM:SS");
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "00");
  // Use UTC container to avoid host-local TZ effects; treat values as floating time
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  const ss = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

// Helper: detect Z or numeric timezone offset in a datetime string
function hasOffsetOrZ(localDateTime: string): boolean {
  return /Z$/i.test(localDateTime) || /[+-]\d{2}:?\d{2}$/.test(localDateTime);
}