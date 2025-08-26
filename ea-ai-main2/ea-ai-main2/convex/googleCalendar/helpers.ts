import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";

// Google Calendar API configuration
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * TypeScript helper functions for Google Calendar API calls
 * These are NOT Convex actions - they are direct function calls to eliminate circular dependencies
 * As per Convex best practices: "extract shared logic into a TypeScript helper function"
 */

/**
 * Make a GET request to the Google Calendar API using the main HTTP client action
 */
export async function getFromGoogleCalendar(
  ctx: ActionCtx,
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<any> {
  return await ctx.runAction(api.googleCalendar.client.makeGoogleCalendarRequest, {
    method: "GET",
    endpoint,
    body: undefined,
    queryParams,
  });
}

/**
 * Make a POST request to the Google Calendar API using the main HTTP client action
 */
export async function postToGoogleCalendar(
  ctx: ActionCtx,
  endpoint: string,
  body: any,
  queryParams?: Record<string, string>
): Promise<any> {
  return await ctx.runAction(api.googleCalendar.client.makeGoogleCalendarRequest, {
    method: "POST",
    endpoint,
    body,
    queryParams,
  });
}

/**
 * Make a PUT request to the Google Calendar API using the main HTTP client action
 */
export async function putToGoogleCalendar(
  ctx: ActionCtx,
  endpoint: string,
  body: any,
  queryParams?: Record<string, string>
): Promise<any> {
  return await ctx.runAction(api.googleCalendar.client.makeGoogleCalendarRequest, {
    method: "PUT",
    endpoint,
    body,
    queryParams,
  });
}

/**
 * Make a PATCH request to the Google Calendar API using the main HTTP client action
 */
export async function patchToGoogleCalendar(
  ctx: ActionCtx,
  endpoint: string,
  body: any,
  queryParams?: Record<string, string>
): Promise<any> {
  return await ctx.runAction(api.googleCalendar.client.makeGoogleCalendarRequest, {
    method: "PATCH",
    endpoint,
    body,
    queryParams,
  });
}

/**
 * Make a DELETE request to the Google Calendar API using the main HTTP client action
 */
export async function deleteFromGoogleCalendar(
  ctx: ActionCtx,
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<any> {
  return await ctx.runAction(api.googleCalendar.client.makeGoogleCalendarRequest, {
    method: "DELETE",
    endpoint,
    body: undefined,
    queryParams,
  });
}