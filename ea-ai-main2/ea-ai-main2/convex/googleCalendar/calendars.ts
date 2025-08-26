import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { getFromGoogleCalendar, postToGoogleCalendar, patchToGoogleCalendar, deleteFromGoogleCalendar } from "./helpers";

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

    try {
      const queryParams: Record<string, string> = {};
      
      if (args.showHidden !== undefined) {
        queryParams.showHidden = args.showHidden.toString();
      }
      
      if (args.showDeleted !== undefined) {
        queryParams.showDeleted = args.showDeleted.toString();
      }

      const response: any = await getFromGoogleCalendar(ctx, "/users/me/calendarList", queryParams);

      // Process and return calendar list with useful information
      const calendars: any[] = response.items?.map((calendar: any) => ({
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

    try {
      const response: any = await getFromGoogleCalendar(ctx, `/calendars/${encodeURIComponent(args.calendarId)}`);

      return {
        id: response.id,
        summary: response.summary,
        description: response.description || null,
        location: response.location || null,
        timeZone: response.timeZone,
        conferenceProperties: response.conferenceProperties || null,
        etag: response.etag,
        kind: response.kind,
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
 * Get the primary calendar for the user
 * This is a convenience function for the most common use case
 */
export const getPrimaryCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.calendars.getPrimaryCalendar", "REQUESTED");

    try {
      // Call listCalendars logic directly to avoid circular dependency
      const queryParams: Record<string, string> = {};
      const response: any = await getFromGoogleCalendar(ctx, "/users/me/calendarList", queryParams);
      
      const calendars: any[] = response.items?.map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description || null,
        primary: calendar.primary || false,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor || null,
        foregroundColor: calendar.foregroundColor || null,
        selected: calendar.selected !== false,
        hidden: calendar.hidden || false,
        timeZone: calendar.timeZone || null,
        conferenceProperties: calendar.conferenceProperties || null,
      })) || [];

      const primaryCalendar = calendars.find((cal: any) => cal.primary);
      if (!primaryCalendar) {
        throw new Error("No primary calendar found for user");
      }

      // Get detailed information about the primary calendar directly
      const detailResponse: any = await getFromGoogleCalendar(ctx, `/calendars/${encodeURIComponent(primaryCalendar.id)}`);
      
      return {
        id: detailResponse.id,
        summary: detailResponse.summary,
        description: detailResponse.description || null,
        location: detailResponse.location || null,
        timeZone: detailResponse.timeZone,
        conferenceProperties: detailResponse.conferenceProperties || null,
        etag: detailResponse.etag,
        kind: detailResponse.kind,
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

      const response: any = await postToGoogleCalendar(ctx, "/calendars", calendarData);

      return {
        id: response.id,
        summary: response.summary,
        description: response.description || null,
        timeZone: response.timeZone,
        location: response.location || null,
        etag: response.etag,
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

      const response: any = await patchToGoogleCalendar(ctx, `/calendars/${encodeURIComponent(args.calendarId)}`, updateData);

      return {
        id: response.id,
        summary: response.summary,
        description: response.description || null,
        timeZone: response.timeZone,
        location: response.location || null,
        etag: response.etag,
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

    try {
      // Prevent deletion of primary calendar
      if (args.calendarId === "primary") {
        throw new Error("Cannot delete the primary calendar");
      }

      await deleteFromGoogleCalendar(ctx, `/calendars/${encodeURIComponent(args.calendarId)}`);

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

    try {
      const calendarListEntry = {
        id: args.calendarId,
      };

      const queryParams: Record<string, string> = {};
      if (args.colorRgbFormat) {
        queryParams.colorRgbFormat = "true";
      }

      const response: any = await postToGoogleCalendar(ctx, "/users/me/calendarList", calendarListEntry, queryParams);

      return {
        id: response.id,
        summary: response.summary,
        accessRole: response.accessRole,
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

    try {
      await deleteFromGoogleCalendar(ctx, `/users/me/calendarList/${encodeURIComponent(args.calendarId)}`);

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