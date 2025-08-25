import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUserAuth, requireUserAuthForAction } from "../todoist/userAccess";
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
  args: {},
  handler: async (
    ctx: ActionCtx,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<any> => {
    const tokenIdentifier = await requireUserAuthForAction(ctx);
    await logUserAccess(ctx, "googleCalendar.client.makeGoogleCalendarRequest", { 
      tokenIdentifier,
      method,
      endpoint 
    });

    // Get valid access token (automatically refreshes if needed)
    const accessToken = await ctx.runAction(api.googleCalendar.auth.getValidGoogleCalendarToken, {});
    
    if (!accessToken) {
      throw new Error("No valid Google Calendar access token available. Please reconnect your Google account.");
    }

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
// CONVENIENCE METHODS: Pre-configured API calls
// =================================================================

/**
 * Make a GET request to the Google Calendar API
 */
export const getFromGoogleCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx, endpoint: string, queryParams?: Record<string, string>) => {
    // @ts-ignore - We're using this as a helper function
    return await makeGoogleCalendarRequest.handler(ctx, "GET", endpoint, undefined, queryParams);
  },
});

/**
 * Make a POST request to the Google Calendar API
 */
export const postToGoogleCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx, endpoint: string, body: any, queryParams?: Record<string, string>) => {
    // @ts-ignore - We're using this as a helper function
    return await makeGoogleCalendarRequest.handler(ctx, "POST", endpoint, body, queryParams);
  },
});

/**
 * Make a PUT request to the Google Calendar API
 */
export const putToGoogleCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx, endpoint: string, body: any, queryParams?: Record<string, string>) => {
    // @ts-ignore - We're using this as a helper function
    return await makeGoogleCalendarRequest.handler(ctx, "PUT", endpoint, body, queryParams);
  },
});

/**
 * Make a PATCH request to the Google Calendar API
 */
export const patchToGoogleCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx, endpoint: string, body: any, queryParams?: Record<string, string>) => {
    // @ts-ignore - We're using this as a helper function
    return await makeGoogleCalendarRequest.handler(ctx, "PATCH", endpoint, body, queryParams);
  },
});

/**
 * Make a DELETE request to the Google Calendar API
 */
export const deleteFromGoogleCalendar = action({
  args: {},
  handler: async (ctx: ActionCtx, endpoint: string, queryParams?: Record<string, string>) => {
    // @ts-ignore - We're using this as a helper function
    return await makeGoogleCalendarRequest.handler(ctx, "DELETE", endpoint, undefined, queryParams);
  },
});

// =================================================================
// CONNECTION TESTING
// =================================================================

/**
 * Test the Google Calendar API connection
 * Returns basic information about the user's calendar setup
 */
export const testGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const tokenIdentifier = await requireUserAuthForAction(ctx);
    await logUserAccess(ctx, "googleCalendar.client.testGoogleCalendarConnection", { tokenIdentifier });

    try {
      // Test the connection by fetching the calendar list
      const calendars = await getFromGoogleCalendar.handler(ctx, "/users/me/calendarList");
      
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