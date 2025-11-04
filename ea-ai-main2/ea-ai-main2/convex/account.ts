"use node";

import { action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { createClerkClient } from "@clerk/backend";

import { internal, api } from "./_generated/api";

export const deleteMyAccount = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const tokenIdentifier = identity.tokenIdentifier;
    const clerkUserId = identity.subject;
    if (!tokenIdentifier || !clerkUserId) throw new ConvexError("Missing identity");

    // 0) Best-effort: proactively disconnect Google Calendar to avoid stale links
    try {
      await ctx.runAction(api.googleCalendar.auth.forceDestroyGoogleExternalAccount, {} as any);
    } catch {}
    try {
      await ctx.runAction(api.googleCalendar.auth.revokeLegacyGoogleToken, {} as any);
    } catch {}

    // 1) Delete all Convex data for this user
    await ctx.runMutation(internal.accountData.deleteAllUserData, { tokenIdentifier });

    // 2) Delete the Clerk user (revokes external connections too)
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    await clerk.users.deleteUser(clerkUserId);

    return { success: true };
  },
});
