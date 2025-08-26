"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireUserAuth, requireUserAuthForAction } from "../todoist/userAccess";
import { logUserAccess } from "../todoist/userAccess";
import { ActionCtx } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";

// Connection status actions - moved from query to action to support external API calls
// Actions can use Node.js runtime and external services like Clerk SDK

/**
 * Check if user has Google OAuth connection via Clerk
 * Similar to Calendly's getOAuthClient check
 */
export const hasGoogleCalendarConnection = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const { userId: tokenIdentifier } = await requireUserAuthForAction(ctx);
    await logUserAccess(tokenIdentifier, "googleCalendar.connection.hasGoogleCalendarConnection", "REQUESTED");

    // Extract Clerk user ID from tokenIdentifier using correct pipe separator
    // Format: "https://domain|user_id" -> extract "user_id"
    const clerkUserId = tokenIdentifier.split('|').pop() || 
                       tokenIdentifier.split('#').pop() || 
                       tokenIdentifier;

    try {
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