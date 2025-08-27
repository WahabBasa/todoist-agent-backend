"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";
import { google } from "googleapis";

// Simple OAuth client helper (mirrors Calendly pattern)
async function getOAuthClient(clerkUserId: string) {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const token = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    "oauth_google"
  );

  if (token.data.length === 0 || token.data[0].token == null) {
    return undefined;
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  client.setCredentials({ access_token: token.data[0].token });

  return client;
}

// =================================================================
// CALENDAR OPERATIONS: List and manage Google Calendars
// =================================================================

/**
 * List all calendars accessible to the user
 * Returns the calendar list with basic information
 */
export const listCalendars = action({
  args: {
    showHidden: v.optional(v.boolean()),
    showDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.listCalendars", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      // Direct googleapis call - simple and clean
      const response = await google.calendar("v3").calendarList.list({
        auth: oAuthClient,
        showHidden: args.showHidden,
        showDeleted: args.showDeleted,
      });

      // Process and return calendar list with useful information
      const calendars: any[] = response.data.items?.map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description || null,
        primary: calendar.primary || false,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor || null,
        foregroundColor: calendar.foregroundColor || null,
        selected: calendar.selected !== false, // Default to true if not specified
        hidden: calendar.hidden || false,
        timeZone: calendar.timeZone || null,
        conferenceProperties: calendar.conferenceProperties || null,
      })) || [];

      return {
        calendars,
        totalCount: calendars.length,
        primaryCalendar: calendars.find((cal: any) => cal.primary),
      };
    } catch (error) {
      console.error("Failed to list Google Calendars:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to list calendars: ${error.message}`
          : "Failed to list calendars"
      );
    }
  },
});

/**
 * Get detailed information about a specific calendar
 */
export const getCalendarDetails = action({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.getCalendarDetails", `REQUESTED - ${args.calendarId}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      // Direct googleapis call
      const response = await google.calendar("v3").calendars.get({
        auth: oAuthClient,
        calendarId: args.calendarId,
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description || null,
        location: response.data.location || null,
        timeZone: response.data.timeZone,
        conferenceProperties: response.data.conferenceProperties || null,
        etag: response.data.etag,
        kind: response.data.kind,
      };
    } catch (error) {
      console.error("Failed to get calendar details:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to get calendar details: ${error.message}`
          : "Failed to get calendar details"
      );
    }
  },
});


/**
 * Create a new calendar
 * Note: This creates a new calendar, not just adds an existing one to the list
 */
export const createCalendar = action({
  args: {
    summary: v.string(),
    description: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.createCalendar", `REQUESTED - ${args.summary}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      const calendarData: any = {
        summary: args.summary,
      };

      if (args.description) {
        calendarData.description = args.description;
      }

      if (args.timeZone) {
        calendarData.timeZone = args.timeZone;
      }

      if (args.location) {
        calendarData.location = args.location;
      }

      // Direct googleapis call
      const response = await google.calendar("v3").calendars.insert({
        auth: oAuthClient,
        requestBody: calendarData,
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description || null,
        timeZone: response.data.timeZone,
        location: response.data.location || null,
        etag: response.data.etag,
        created: true,
      };
    } catch (error) {
      console.error("Failed to create calendar:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to create calendar: ${error.message}`
          : "Failed to create calendar"
      );
    }
  },
});

/**
 * Update an existing calendar
 */
export const updateCalendar = action({
  args: {
    calendarId: v.string(),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.updateCalendar", `REQUESTED - ${args.calendarId}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      const updateData: any = {};

      if (args.summary !== undefined) {
        updateData.summary = args.summary;
      }

      if (args.description !== undefined) {
        updateData.description = args.description;
      }

      if (args.timeZone !== undefined) {
        updateData.timeZone = args.timeZone;
      }

      if (args.location !== undefined) {
        updateData.location = args.location;
      }

      // Only make the API call if there are actual changes
      if (Object.keys(updateData).length === 0) {
        throw new Error("No changes specified for calendar update");
      }

      // Direct googleapis call
      const response = await google.calendar("v3").calendars.patch({
        auth: oAuthClient,
        calendarId: args.calendarId,
        requestBody: updateData,
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description || null,
        timeZone: response.data.timeZone,
        location: response.data.location || null,
        etag: response.data.etag,
        updated: true,
      };
    } catch (error) {
      console.error("Failed to update calendar:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to update calendar: ${error.message}`
          : "Failed to update calendar"
      );
    }
  },
});

/**
 * Delete a calendar
 * WARNING: This permanently deletes the calendar and all its events
 */
export const deleteCalendar = action({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.deleteCalendar", `REQUESTED - ${args.calendarId}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      // Prevent deletion of primary calendar
      if (args.calendarId === "primary") {
        throw new Error("Cannot delete the primary calendar");
      }

      // Direct googleapis call
      await google.calendar("v3").calendars.delete({
        auth: oAuthClient,
        calendarId: args.calendarId,
      });

      return {
        success: true,
        calendarId: args.calendarId,
        deleted: true,
      };
    } catch (error) {
      console.error("Failed to delete calendar:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to delete calendar: ${error.message}`
          : "Failed to delete calendar"
      );
    }
  },
});

// =================================================================
// CALENDAR LIST MANAGEMENT: Add/remove calendars from user's list
// =================================================================

/**
 * Add an existing calendar to the user's calendar list
 * This is different from creating a new calendar - it adds a shared calendar
 */
export const addCalendarToList = action({
  args: {
    calendarId: v.string(),
    colorRgbFormat: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.addCalendarToList", `REQUESTED - ${args.calendarId}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      const calendarListEntry = {
        id: args.calendarId,
      };

      // Direct googleapis call
      const response = await google.calendar("v3").calendarList.insert({
        auth: oAuthClient,
        requestBody: calendarListEntry,
        colorRgbFormat: args.colorRgbFormat,
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        accessRole: response.data.accessRole,
        added: true,
      };
    } catch (error) {
      console.error("Failed to add calendar to list:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to add calendar to list: ${error.message}`
          : "Failed to add calendar to list"
      );
    }
  },
});

/**
 * Remove a calendar from the user's calendar list
 * This doesn't delete the calendar, just removes it from the user's view
 */
export const removeCalendarFromList = action({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.removeCalendarFromList", `REQUESTED - ${args.calendarId}`);

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      // Direct googleapis call
      await google.calendar("v3").calendarList.delete({
        auth: oAuthClient,
        calendarId: args.calendarId,
      });

      return {
        success: true,
        calendarId: args.calendarId,
        removed: true,
      };
    } catch (error) {
      console.error("Failed to remove calendar from list:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to remove calendar from list: ${error.message}`
          : "Failed to remove calendar from list"
      );
    }
  },
});

/**
 * Get primary calendar (simple helper function)
 */
export const getPrimaryCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.getPrimaryCalendar", "REQUESTED");

    // Get clean Clerk user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clerkUserId = identity.subject;

    const oAuthClient = await getOAuthClient(clerkUserId);
    if (!oAuthClient) {
      throw new Error("Google Calendar not connected. Please connect in Settings.");
    }

    try {
      // Direct googleapis call to get primary calendar
      const response = await google.calendar("v3").calendarList.get({
        auth: oAuthClient,
        calendarId: "primary",
      });

      return {
        id: response.data.id,
        summary: response.data.summary || "Primary Calendar",
        description: response.data.description || null,
        primary: true,
        accessRole: response.data.accessRole,
        timeZone: response.data.timeZone,
      };
    } catch (error) {
      console.error("Failed to get primary calendar:", error);
      throw new Error(
        error instanceof Error 
          ? `Failed to get primary calendar: ${error.message}`
          : "Failed to get primary calendar"
      );
    }
  },
});