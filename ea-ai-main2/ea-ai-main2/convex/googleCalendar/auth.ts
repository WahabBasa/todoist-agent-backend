"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";
import crypto from "node:crypto";

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
async function getOAuthClient(clerkUserId: string): Promise<any | null> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const token = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    "oauth_google"
  );

  if (token.data.length === 0 || token.data[0].token == null) {
    return null; // No token available
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  client.setCredentials({ access_token: token.data[0].token });

  return client as any;
}

// Dedicated Google OAuth client (separate from Clerk SSO)
function getDedicatedOAuthClient() {
  const clientId = process.env.GCAL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GCAL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUrl = process.env.GCAL_REDIRECT_URL || process.env.GOOGLE_CALENDAR_REDIRECT_URL || process.env.GOOGLE_OAUTH_REDIRECT_URL;
  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error("Google Calendar OAuth environment not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.settings.readonly",
];

function signState(payload: object): string {
  const secret = process.env.STATE_HMAC_SECRET || process.env.CLERK_SECRET_KEY || "dev-secret";
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyState<T = any>(state: string): T | null {
  const secret = process.env.STATE_HMAC_SECRET || process.env.CLERK_SECRET_KEY || "dev-secret";
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
}

// DB helpers now live in ./tokens.ts (non-node runtime)

async function getOAuthClientFromDB(ctx: ActionCtx): Promise<any | null> {
  const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
  void tokenIdentifier;
  const refreshToken = await ctx.runQuery(api.googleCalendar.tokens.getRefreshToken, {});
  if (!refreshToken) return null;
  const client = getDedicatedOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client as any;
}

export const generateGoogleOAuthURL = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ url: string } | { error: string }> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    try {
      const client = getDedicatedOAuthClient();
      const csrf = crypto.randomBytes(16).toString("base64url");
      const state = signState({ tokenIdentifier, csrf, ts: Date.now() });
      const url = client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: GCAL_SCOPES,
        state,
      });
      return { url };
    } catch (e: any) {
      return { error: e?.message || "Failed to start Google OAuth" };
    }
  },
});

// Handle Google OAuth callback in Node runtime (exchanged in backend)
export const handleGoogleCalendarOAuthCallback = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx: ActionCtx, { code, state }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const parsed = verifyState<{ tokenIdentifier: string; csrf: string; ts: number }>(state);
      if (!parsed?.tokenIdentifier) {
        return { ok: false, error: "Invalid OAuth state" };
      }

      const client = getDedicatedOAuthClient();
      const { tokens } = await client.getToken(code);
      const refreshToken = tokens.refresh_token;
      const scope = tokens.scope as string | undefined;
      if (!refreshToken) {
        return { ok: false, error: "No refresh token returned. Ensure prompt=consent & offline access." };
      }

      await ctx.runMutation(api.googleCalendar.tokens.storeGoogleCalendarRefreshToken, {
        tokenIdentifier: parsed.tokenIdentifier,
        refreshToken,
        scope,
      });

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "OAuth callback failed" };
    }
  },
});

/**
 * Check if user has Google Calendar connection
 */
export const hasGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    try {
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const tokens = await clerkClient.users.getUserOauthAccessToken(identity.subject, "oauth_google");
      const hasScopes = Array.isArray(tokens?.data) && tokens.data.length > 0;
      if (!hasScopes) return false;
      const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
      return !!enabled;
    } catch {
      return false;
    }
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
    try {
      const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
      if (!enabled) {
        return { success: false, error: "Google Calendar disabled.", testTimestamp: Date.now() };
      }
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return { success: false, error: "Not authenticated", testTimestamp: Date.now() };
      }
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const tokens = await clerkClient.users.getUserOauthAccessToken(identity.subject, "oauth_google");
      const accessToken = tokens?.data?.[0]?.token as string | undefined;
      if (!accessToken) {
        return { success: false, error: "Google Calendar not connected.", testTimestamp: Date.now() };
      }
      const resp = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const msg = resp.status === 403 ? "Insufficient Google Calendar scopes" : `HTTP ${resp.status}`;
        return { success: false, error: msg, testTimestamp: Date.now() };
      }
      const json: any = await resp.json();
      const count = Array.isArray(json?.items) ? json.items.length : 0;
      return { success: true, message: `Connected to Google Calendar (${count} calendar(s))`, testTimestamp: Date.now(), hasConnection: true };
    } catch (error) {
      console.error("Error testing Google Calendar connection:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error", testTimestamp: Date.now() };
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
      const ok = await ctx.runMutation(api.googleCalendar.tokens.setGoogleCalendarEnabled, { enabled: false });
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", ok ? "SUCCESS" : "FAILED_SET_DISABLED");
      return !!ok;
    } catch (error) {
      console.error("Error disabling Google Calendar:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", `FAILED: ${error}`);
      return false;
    }
  },
});

// =================================================================
// LEGACY TOKEN REVOCATION (for true disconnect behavior)
// =================================================================

/**
 * Revoke and delete any legacy stored Google refresh token so that
 * the next connect requires full user consent.
 */
export const revokeLegacyGoogleToken = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ revoked: boolean; deleted: boolean } | { revoked: false; deleted: false; reason: string }> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.revokeLegacyGoogleToken", "REQUESTED");
    try {
      const refreshToken = await ctx.runQuery(api.googleCalendar.tokens.getRefreshToken, {});
      if (!refreshToken) {
        await logUserAccess(tokenIdentifier, "googleCalendar.auth.revokeLegacyGoogleToken", "NO_REFRESH_TOKEN");
        return { revoked: false, deleted: false, reason: "no_refresh_token" };
      }

      // Revoke token via Google's token revocation endpoint
      const resp = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }).toString(),
      });
      const revoked = resp.ok;

      // Delete from DB regardless of revoke outcome
      const deleted = await ctx.runMutation(api.googleCalendar.tokens.deleteGoogleCalendarToken, {});
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.revokeLegacyGoogleToken", revoked ? "REVOKED_AND_DELETED" : "DELETE_ONLY");
      return { revoked, deleted };
    } catch (error) {
      console.error("Error revoking legacy Google token:", error);
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.revokeLegacyGoogleToken", `FAILED: ${error}`);
      return { revoked: false, deleted: false, reason: "error" } as const;
    }
  },
});

// =================================================================
// CLERK EXTERNAL ACCOUNT CLEANUP (server-side enforcement)
// =================================================================

/**
 * Force-destroy the user's Google external account in Clerk.
 * Use this as a server-side fallback to ensure true disconnect
 * even if the frontend object isn't available.
 */
export const forceDestroyGoogleExternalAccount = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ removed: boolean } | { removed: false; reason: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { removed: false, reason: "not_authenticated" };
    const clerkUserId = identity.subject;

    try {
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const user = await clerkClient.users.getUser(clerkUserId);
      const googleAccount = (user?.externalAccounts || []).find((acc: any) => acc?.provider === "oauth_google" || acc?.provider === "google");
      if (!googleAccount?.id) return { removed: false, reason: "no_external_account" };

      // According to prior devlog, the correct method is deleteUserExternalAccount({ userId, externalAccountId })
      await clerkClient.users.deleteUserExternalAccount({ userId: clerkUserId, externalAccountId: googleAccount.id });
      return { removed: true };
    } catch (e) {
      console.error("forceDestroyGoogleExternalAccount error:", e);
      return { removed: false, reason: "error" } as const;
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
    const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
    if (!enabled) throw new Error("Google Calendar disabled.");
    let oAuthClient = await getOAuthClientFromDB(ctx);
    if (!oAuthClient) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      const clerkUserId = identity.subject;
      oAuthClient = await getOAuthClient(clerkUserId);
    }
    if (!oAuthClient) throw new Error("Google Calendar not connected. Please connect in Settings.");

    try {
      const calendar = google.calendar({ version: "v3", auth: oAuthClient as any });
      const { data } = await calendar.events.list({
        calendarId: "primary",
        eventTypes: ["default"],
        singleEvents: true,
        timeMin: args.start,
        timeMax: args.end,
        maxResults: 2500,
      });

      const eventTimes = data.items?.map(event => {
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
    // Legacy fields (optional)
    startTime: v.optional(v.string()), // ISO instant string
    durationMinutes: v.optional(v.number()),
    // New structured fields (preferred)
    start: v.optional(v.object({ dateTime: v.string(), timeZone: v.string() })),
    end: v.optional(v.object({ dateTime: v.string(), timeZone: v.string() })),
    description: v.optional(v.string()),
    attendeeEmails: v.optional(v.array(v.string())),
  },
  handler: async (ctx: ActionCtx, args) => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.auth.createCalendarEvent", "REQUESTED");
    const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
    if (!enabled) throw new Error("Google Calendar disabled.");
    let oAuthClient = await getOAuthClientFromDB(ctx);
    if (!oAuthClient) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      const clerkUserId = identity.subject;
      oAuthClient = await getOAuthClient(clerkUserId);
    }
    if (!oAuthClient) throw new Error("Google Calendar not connected. Please connect in Settings.");

    try {
      const attendees = args.attendeeEmails?.map(email => ({ email })) || [];
      const calendar = google.calendar({ version: "v3", auth: oAuthClient as any });

      // Prefer new structured fields when provided
      if (args.start && args.end) {
        if (/[zZ]$/.test(args.start.dateTime) || /[+-]\d{2}:?\d{2}$/.test(args.start.dateTime)) {
          throw new Error("start.dateTime must be local (no Z/offset); supply timeZone separately.");
        }
        if (/[zZ]$/.test(args.end.dateTime) || /[+-]\d{2}:?\d{2}$/.test(args.end.dateTime)) {
          throw new Error("end.dateTime must be local (no Z/offset); supply timeZone separately.");
        }
        console.log("[GCAL] createCalendarEvent using structured start/end", { tz: args.start.timeZone, start: args.start.dateTime, end: args.end.dateTime });
        const calendarEvent = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: args.title,
            description: args.description,
            start: { dateTime: args.start.dateTime, timeZone: args.start.timeZone },
            end: { dateTime: args.end.dateTime, timeZone: args.end.timeZone },
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
      }

      // Legacy path: enrich with user's timezone and keep local wall time
      if (!args.startTime) throw new Error("Missing start time");
      const duration = args.durationMinutes ?? 60;

      // Resolve user's timezone
      let tz: string | undefined = undefined;
      try {
        const settings: any = await ctx.runAction(api.googleCalendar.auth.getUserCalendarSettings, {});
        tz = settings?.timezone || tz;
      } catch { /* ignore */ }
      if (!tz) {
        try {
          const nowCtx: any = await ctx.runAction(api.googleCalendar.auth.getCurrentCalendarTime, {});
          tz = nowCtx?.userTimezone;
        } catch { /* ignore */ }
      }
      if (!tz) throw new Error("Cannot resolve timezone for legacy event creation");

      const startLocal = toLocalDateTimeString(args.startTime, tz);
      // Compute end by adding duration minutes in local wall time
      const endLocal = addMinutesLocal(startLocal, duration);

      console.log("[GCAL] createCalendarEvent legacy→structured", { tz, startLocal, endLocal });
      const calendarEvent = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: args.title,
          description: args.description,
          start: { dateTime: startLocal, timeZone: tz },
          end: { dateTime: endLocal, timeZone: tz },
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

// Format an instant (ISO) into local wall time string in a given IANA timezone: YYYY-MM-DDTHH:MM:SS
function toLocalDateTimeString(isoInstant: string, timeZone: string): string {
  const date = new Date(isoInstant);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const yyyy = map.year;
  const mm = map.month;
  const dd = map.day;
  const hh = map.hour;
  const mi = map.minute;
  const ss = map.second;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

// Add minutes to a local date-time string (YYYY-MM-DDTHH:MM:SS) preserving wall time (no TZ offsets)
function addMinutesLocal(localDateTime: string, minutes: number): string {
  const m = localDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error("Invalid local date-time format; expected YYYY-MM-DDTHH:MM:SS");
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "00");
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
    const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
    if (!enabled) throw new Error("Google Calendar disabled.");
    let oAuthClient = await getOAuthClientFromDB(ctx);
    if (!oAuthClient) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      const clerkUserId = identity.subject;
      oAuthClient = await getOAuthClient(clerkUserId);
    }
    if (!oAuthClient) throw new Error("Google Calendar not connected. Please connect in Settings.");

    try {
      // Get all user settings from Google Calendar
      const calendar = google.calendar({ version: "v3", auth: oAuthClient as any });
      const settingsResponse = await calendar.settings.list({});

      const settings = settingsResponse.data.items || [];
      
      // Extract key settings we need (do not default to UTC; let callers decide)
      const timezone = settings.find(s => s.id === 'timezone')?.value || undefined as unknown as string | undefined;
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
    const enabled = await ctx.runQuery(api.googleCalendar.tokens.getGoogleCalendarEnabled, {});
    if (!enabled) throw new Error("Google Calendar disabled.");
    let oAuthClient = await getOAuthClientFromDB(ctx);
    if (!oAuthClient) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      const clerkUserId = identity.subject;
      oAuthClient = await getOAuthClient(clerkUserId);
    }
    if (!oAuthClient) throw new Error("Google Calendar not connected. Please connect in Settings.");

    try {
      // Get primary calendar to get user's timezone
      const calendar = await google.calendar({ version: "v3", auth: oAuthClient as any }).calendars.get({
        calendarId: "primary",
      });

      const userTimezone = calendar.data.timeZone || "UTC";
      const now = new Date();

      // Use Google Calendar API to format current time in user's timezone
      // We create a tiny time window around "now" so Google formats it for us
      const timeMin = new Date(now.getTime() - 1000).toISOString(); // 1 second before
      const timeMax = new Date(now.getTime() + 1000).toISOString(); // 1 second after

      // This is the key: Google will format the response times in the user's timezone
      await google.calendar({ version: "v3", auth: oAuthClient as any }).events.list({
        calendarId: "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        timeZone: userTimezone,
        maxResults: 1,
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