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

// Simplified Google Calendar OAuth using Clerk only

// Simple OAuth client helper via Clerk-managed tokens
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

// Required scopes (Clerk-managed external account)
const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.settings.readonly",
];

/**
 * Helper: Fetch Clerk Google access token for current user and discover its scopes.
 */
async function getClerkAccessTokenAndScopes(
  clerkUserId: string,
): Promise<{ accessToken: string; scopes: string[]; provider: string } | null> {
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  async function tryProvider(provider: string) {
    try {
      const tokens = await clerkClient.users.getUserOauthAccessToken(clerkUserId, provider as any);
      const accessToken = tokens?.data?.[0]?.token as string | undefined;
      return accessToken ? { accessToken, count: tokens?.data?.length || 0 } : null;
    } catch (e) {
      // Debug hint only; don't throw to allow fallback
      if (process.env.LOG_LEVEL === 'debug') {
        console.warn(`[ClerkOAuth] getUserOauthAccessToken failed for provider=${provider}:`, e instanceof Error ? e.message : e);
      }
      return null;
    }
  }

  // Try the common provider slugs in order
  const providers = ["oauth_google", "google"];
  let access: { accessToken: string; count: number } | null = null;
  let used: string | null = null;
  for (const p of providers) {
    access = await tryProvider(p);
    if (access) {
      used = p;
      break;
    }
  }
  if (!access || !used) return null;

  // Use Google's tokeninfo endpoint to retrieve scopes for this access token
  try {
    const resp = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(access.accessToken),
    );
    if (!resp.ok) {
      return { accessToken: access.accessToken, scopes: [], provider: used };
    }
    const json: any = await resp.json();
    const scopeStr: string = json?.scope || "";
    const scopes = scopeStr.split(/\s+/).filter(Boolean);
    return { accessToken: access.accessToken, scopes, provider: used };
  } catch {
    return { accessToken: access.accessToken, scopes: [], provider: used };
  }
}

/**
 * Helper: Ensure Clerk token exists and has required scopes; returns an OAuth client
 * configured with that access token. If missing scopes, throws with clear message.
 */
async function getClerkOAuthClientWithScopes(requiredScopes: string[], clerkUserId: string): Promise<any> {
  const tokenInfo = await getClerkAccessTokenAndScopes(clerkUserId);
  if (!tokenInfo) {
    throw new Error("Google Calendar not connected. Please connect in Settings.");
  }
  const missing = requiredScopes.filter((s) => !tokenInfo.scopes.includes(s));
  if (missing.length > 0) {
    throw new Error(`Google Calendar is connected but missing required scope(s): ${missing.join(", ")}. Please reconnect in Settings.`);
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
  client.setCredentials({ access_token: tokenInfo.accessToken });
  return client as any;
}

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
      const hasToken = Array.isArray(tokens?.data) && tokens.data.length > 0 && !!tokens.data[0]?.token;
      if (!hasToken) return false;
      // Consider connected if minimal read scopes are present
      const info = await getClerkAccessTokenAndScopes(identity.subject);
      const have = info?.scopes || [];
      const need = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.settings.readonly",
      ];
      const missing = need.filter(s => !have.includes(s));
      return missing.length === 0;
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
      // Enabled flag removed; rely on Clerk token presence and scopes
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return { success: false, error: "Not authenticated", testTimestamp: Date.now() };
      }

      // Inspect Clerk token scopes for diagnostics
      const tokenInfo = await getClerkAccessTokenAndScopes(identity.subject);
      if (!tokenInfo) {
        return { success: false, error: "Google Calendar not connected.", testTimestamp: Date.now() };
      }
      const have = tokenInfo.scopes;
      const need = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.settings.readonly",
      ];
      const missing = need.filter(s => !have.includes(s));

      // Try a lightweight read using the Clerk token
      const resp = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
        headers: { Authorization: `Bearer ${tokenInfo.accessToken}` },
      });
      if (!resp.ok) {
        const msg = resp.status === 403
          ? `Insufficient Google Calendar scopes (have: ${have.join(" ") || "none"}; need: ${need.join(", ")})`
          : `HTTP ${resp.status}`;
        return { success: false, error: msg, testTimestamp: Date.now() };
      }
      const json: any = await resp.json();
      const count = Array.isArray(json?.items) ? json.items.length : 0;
      return { success: true, message: `Connected to Google Calendar via Clerk token (${count} calendar(s))`, testTimestamp: Date.now(), hasConnection: true };
    } catch (error) {
      console.error("Error testing Google Calendar connection:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error", testTimestamp: Date.now() };
    }
  },
});

// Debug utility: inspect Clerk Google OAuth status for current user
export const debugGoogleOAuthStatus = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

    const providers = ["oauth_google", "google"];
    const attempts: Array<{ provider: string; ok: boolean; count?: number; error?: string }> = [];
    for (const p of providers) {
      try {
        const tokens = await clerkClient.users.getUserOauthAccessToken(identity.subject, p as any);
        const count = tokens?.data?.length || 0;
        attempts.push({ provider: p, ok: count > 0, count });
      } catch (e) {
        attempts.push({ provider: p, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    let tokenInfo: { accessToken: string; scopes: string[]; provider: string } | null = null;
    try {
      tokenInfo = await getClerkAccessTokenAndScopes(identity.subject);
    } catch {}

    const env = {
      CLERK_SECRET_KEY: Boolean(process.env.CLERK_SECRET_KEY),
      GOOGLE_OAUTH_CLIENT_ID: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
      GOOGLE_OAUTH_CLIENT_SECRET: Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
      GOOGLE_OAUTH_REDIRECT_URL: Boolean(process.env.GOOGLE_OAUTH_REDIRECT_URL),
    };

    return {
      success: true,
      identity: identity.subject,
      attempts,
      tokenProvider: tokenInfo?.provider || null,
      scopes: tokenInfo?.scopes || [],
      env,
    };
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
      const ok = true; // soft remove no longer toggles enabled; backend derives from Clerk tokens
      // Ensure any legacy refresh token is revoked and removed so the next connect must re-consent
      try { await ctx.runAction(api.googleCalendar.auth.revokeLegacyGoogleToken, {} as any); } catch {}
      await logUserAccess(tokenIdentifier, "googleCalendar.auth.removeGoogleCalendarConnection", ok ? "SUCCESS" : "FAILED");
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
     } catch (e: any) {
       console.error("forceDestroyGoogleExternalAccount error:", e);
       // Handle specific Clerk errors for missing external account
       if (e?.status === 404 && e?.errors?.[0]?.code === 'external_account_not_found') {
         return { removed: false, reason: "no_external_account" };
       }
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
    // Enabled flag removed; rely on Clerk token scopes to allow access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const oAuthClient = await getClerkOAuthClientWithScopes([
      "https://www.googleapis.com/auth/calendar.readonly",
    ], identity.subject);

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
    // Enabled flag removed; rely on Clerk token scopes to allow access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const oAuthClient = await getClerkOAuthClientWithScopes([
      "https://www.googleapis.com/auth/calendar.events",
    ], identity.subject);

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
    // Enabled flag removed; rely on Clerk token scopes to allow access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const oAuthClient = await getClerkOAuthClientWithScopes([
      "https://www.googleapis.com/auth/calendar.settings.readonly",
    ], identity.subject);

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
    // Enabled flag removed; rely on Clerk token scopes to allow access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const oAuthClient = await getClerkOAuthClientWithScopes([
      "https://www.googleapis.com/auth/calendar.readonly",
    ], identity.subject);

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
