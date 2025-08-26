import { v } from "convex/values";
import { query, action } from "../_generated/server";
import { requireUserAuth, requireUserAuthForAction, getUserContext } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx, QueryCtx } from "../_generated/server";

// Database-based connection status check - follows Todoist pattern
// Pure query - reads from googleCalendarTokens table without external API calls

/**
 * Check if user has Google Calendar connection by reading from database
 * Same pattern as Todoist hasTodoistConnection query
 */
export const hasGoogleCalendarConnection = query({
  handler: async (ctx: QueryCtx): Promise<boolean> => {
    const userContext = await getUserContext(ctx);
    if (!userContext) {
      logUserAccess("anonymous", "GOOGLE_CALENDAR_CONNECTION_CHECK", "FAILED - Not authenticated");
      return false;
    }

    const { userId } = userContext;
    logUserAccess(userId, "GOOGLE_CALENDAR_CONNECTION_CHECK", "REQUESTED");

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
      .unique();

    const hasConnection = token !== null && token.accessToken.length > 0;
    logUserAccess(userId, "GOOGLE_CALENDAR_CONNECTION_CHECK", hasConnection ? "SUCCESS" : "NO_CONNECTION");
    
    return hasConnection;
  },
});

// Advanced connection testing using Clerk API (for debugging)
// This remains as an ACTION since it calls external services
export const testGoogleCalendarConnectionWithClerk = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.connection.testGoogleCalendarConnectionWithClerk", "REQUESTED");

    // Extract Clerk user ID from tokenIdentifier using correct pipe separator
    // Format: "https://domain|user_id" -> extract "user_id"
    const clerkUserId = tokenIdentifier.split('|').pop() || 
                       tokenIdentifier.split('#').pop() || 
                       tokenIdentifier;

    try {
      // Import Clerk only in Node.js runtime - need "use node" for this function
      const { createClerkClient } = await import("@clerk/backend");
      
      // Use Clerk to check if user has Google OAuth token
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      const { data: tokens } = await clerkClient.users.getUserOauthAccessToken(clerkUserId, "google");
      
      // Check if user has valid Google OAuth token with calendar scopes
      return tokens.length > 0 && tokens[0].token != null;
    } catch (error) {
      console.error("Error checking Google connection:", error);
      return false;
    }
  },
});