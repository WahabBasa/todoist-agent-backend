import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";

// Google Calendar API configuration
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// =================================================================
// HTTP CLIENT: Authenticated API client with automatic token refresh
// =================================================================

/**
 * Make an authenticated HTTP request to the Google Calendar API
 * Automatically handles token refresh on 401 errors
 */
export const makeGoogleCalendarRequest = action({
  args: {
    method: v.union(v.literal("GET"), v.literal("POST"), v.literal("PUT"), v.literal("PATCH"), v.literal("DELETE")),
    endpoint: v.string(),
    body: v.optional(v.any()),
    queryParams: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx: ActionCtx, args): Promise<any> => {
    const { method, endpoint, body, queryParams } = args;
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.client.makeGoogleCalendarRequest", `REQUESTED - ${method} ${endpoint}`);

    // Get Google OAuth access token from Clerk
    const clerkTokenResult = await ctx.runAction(api.googleCalendar.clerkIntegration.getGoogleOAuthClient, {});
    
    if (clerkTokenResult.error || !clerkTokenResult.token) {
      throw new Error(clerkTokenResult.error || "No valid Google Calendar access token available. Please connect your Google account through your profile settings.");
    }
    
    const accessToken = clerkTokenResult.token;

    // Build the full URL
    let url = `${GOOGLE_CALENDAR_API_BASE}${endpoint}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      console.log(`[Google Calendar API] ${method} ${endpoint}`);
      
      const response = await fetch(url, requestOptions);
      
      // Handle different response status codes
      if (response.status === 401) {
        throw new Error("Google Calendar authentication failed. Please reconnect your Google account.");
      }
      
      if (response.status === 403) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.error?.errors?.[0]?.reason === "quotaExceeded") {
          throw new Error("Google Calendar API quota exceeded. Please try again later.");
        }
        throw new Error("Insufficient permissions for Google Calendar. Please check your account settings.");
      }
      
      if (response.status === 404) {
        throw new Error("The requested calendar or event was not found.");
      }
      
      if (response.status === 429) {
        throw new Error("Google Calendar API rate limit exceeded. Please try again later.");
      }
      
      if (!response.ok) {
        let errorMessage = `Google Calendar API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // If we can't parse the error, use the default message
        }
        throw new Error(errorMessage);
      }

      // Handle empty responses (e.g., DELETE requests)
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return { success: true };
      }

      // Parse and return the JSON response
      const data = await response.json();
      console.log(`[Google Calendar API] ${method} ${endpoint} - Success`);
      return data;
      
    } catch (error) {
      console.error(`[Google Calendar API] ${method} ${endpoint} - Error:`, error);
      
      // Re-throw API errors with context
      if (error instanceof Error) {
        throw new Error(`Google Calendar API request failed: ${error.message}`);
      }
      
      throw new Error("Unknown error occurred while calling Google Calendar API");
    }
  },
});

// =================================================================
// CONVENIENCE METHODS: Moved to helpers.ts to eliminate circular dependencies
// =================================================================

// NOTE: The convenience HTTP methods (getFromGoogleCalendar, postToGoogleCalendar, etc.)
// have been moved to ./helpers.ts as TypeScript helper functions.
// This follows Convex best practices to avoid circular dependencies in the generated API.
// Import and use the helper functions directly instead of ctx.runAction calls.

// =================================================================
// CONNECTION TESTING
// =================================================================

/**
 * Test the Google Calendar API connection
 * Returns basic information about the user's calendar setup
 */
export const testGoogleCalendarConnection: any = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<any> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.client.testGoogleCalendarConnection", "REQUESTED");

    try {
      // Test the connection by fetching the calendar list using helper function
      const { getFromGoogleCalendar } = await import("./helpers");
      const calendars: any = await getFromGoogleCalendar(ctx, "/users/me/calendarList");
      
      return {
        success: true,
        calendarsCount: calendars.items?.length || 0,
        primaryCalendar: calendars.items?.find((cal: any) => cal.primary)?.summary || "Unknown",
        testTimestamp: Date.now(),
      };
    } catch (error) {
      console.error("Google Calendar connection test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        testTimestamp: Date.now(),
      };
    }
  },
});

// =================================================================
// ERROR HANDLING UTILITIES
// =================================================================

/**
 * Check if an error indicates that the user needs to re-authenticate
 */
export function isAuthenticationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("authentication failed") ||
    message.includes("unauthorized") ||
    message.includes("invalid_grant") ||
    message.includes("token") && message.includes("expired")
  );
}

/**
 * Check if an error indicates a rate limit or quota issue
 */
export function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

/**
 * Extract a user-friendly error message from Google Calendar API errors
 */
export function getGoogleCalendarErrorMessage(error: any): string {
  if (error?.error?.message) {
    return error.error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  return "An unknown error occurred with Google Calendar";
}