import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserAuth } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { QueryCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";

// Connection status queries - these cannot be in Node.js runtime files
// Moved from clerkIntegration.ts to comply with Convex runtime restrictions

/**
 * Check if user has Google OAuth connection via Clerk
 * Similar to Calendly's getOAuthClient check
 */
export const hasGoogleCalendarConnection = query({
  args: {},
  handler: async (ctx: QueryCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.connection.hasGoogleCalendarConnection", "REQUESTED");

    try {
      // Use Clerk to check if user has Google OAuth token
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      
      const { data: tokens } = await clerkClient.users.getUserOauthAccessToken(tokenIdentifier, "google");
      
      // Check if user has valid Google OAuth token with calendar scopes
      return tokens.length > 0 && tokens[0].token != null;
    } catch (error) {
      console.error("Error checking Google connection:", error);
      return false;
    }
  },
});