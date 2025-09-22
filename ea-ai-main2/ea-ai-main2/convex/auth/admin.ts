"use node";

import { query } from "../_generated/server";
import { v } from "convex/values";

export const isAdminUser = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.tokenIdentifier !== tokenIdentifier) {
      throw new Error("Unauthorized: Can only check own admin status");
    }
    const metadata = identity.publicMetadata as any;
    return metadata?.isAdmin === true;
  }
});