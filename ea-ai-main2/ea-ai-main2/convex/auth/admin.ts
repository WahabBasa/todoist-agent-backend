import { query } from "../_generated/server";
import { v } from "convex/values";

// Debug logging control
const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === "true";

// Secure admin authentication using environment variables
// No hardcoded secrets, supports multiple verification methods
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

// New secure admin check - no tokenIdentifier needed, uses environment variables
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      if (ENABLE_DEBUG_LOGS) {
        console.log(`🔐 [Admin] No authenticated user found`);
      }
      return false;
    }

    // Get admin credentials from environment variables (secure)
    const adminUserId = process.env.ADMIN_USER_ID;
    const adminEmail = process.env.ADMIN_EMAIL;
    
    // Dual security check: User ID AND Email verification
    const isUserIdMatch = identity.subject === adminUserId;
    const isEmailMatch = identity.email === adminEmail;
    const isPublicMetadataAdmin = (identity.publicMetadata as any)?.isAdmin === true;
    
    const isAdmin = !!(isUserIdMatch || isEmailMatch || isPublicMetadataAdmin);
    
    if (ENABLE_DEBUG_LOGS) {
      console.log(`🔐 [Admin] Check: ${identity.subject?.slice(0, 20)}... (${identity.email}) → ${isAdmin}`);
    }
    
    return isAdmin;
  }
});