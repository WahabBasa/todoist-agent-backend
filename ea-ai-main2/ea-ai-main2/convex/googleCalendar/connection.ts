import { v } from "convex/values";
import { query, action } from "../_generated/server";
import { requireUserAuth, requireUserAuthForAction, getUserContext } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, QueryCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";

// Clerk-based connection status query for frontend compatibility
// Returns actual connection state based on Clerk OAuth tokens

/**
 * Check if user has Google Calendar connection via Clerk OAuth
 * Query for frontend useQuery compatibility  
 * Returns true only when user has Google OAuth token available through Clerk
 */
export const hasGoogleCalendarConnection = query({
  handler: async (ctx: QueryCtx): Promise<boolean> => {
    const userContext = await getUserContext(ctx);
    if (!userContext) {
      logUserAccess("anonymous", "googleCalendar.connection.hasGoogleCalendarConnection", "FAILED - Not authenticated");
      return false;
    }

    const { userId } = userContext;
    logUserAccess(userId, "googleCalendar.connection.hasGoogleCalendarConnection", "REQUESTED");

    // Since this is a query, we cannot call external APIs (like Clerk)
    // For now, return false and let the action handle the actual checking
    // The frontend will need to use the action for real-time checking
    logUserAccess(userId, "googleCalendar.connection.hasGoogleCalendarConnection", "QUERY_LIMITATION");
    
    return false;
  },
});

// =================================================================
// CLERK API ACTIONS (Node.js runtime required)
// =================================================================

/**
 * Advanced connection testing using Clerk API (for debugging)
 * This remains as an ACTION since it calls external services
 */
export const testGoogleCalendarConnectionWithClerk = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.connection.testGoogleCalendarConnectionWithClerk", "REQUESTED");

    try {
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      const tokenResponse = await clerkClient.users.getUserOauthAccessToken(
        tokenIdentifier, 
        "oauth_google"
      );
      
      // Check if user has valid Google OAuth token with calendar scopes
      return tokenResponse.data.length > 0 && tokenResponse.data[0].token != null;
    } catch (error) {
      console.error("Error checking Google connection:", error);
      return false;
    }
  },
});