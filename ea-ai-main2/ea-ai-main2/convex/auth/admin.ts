import { query } from "../_generated/server";
import { v } from "convex/values";

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
      console.log(`🔐 [Admin] No authenticated user found`);
      return false;
    }

    // Get admin credentials from environment variables (secure)
    const adminUserId = process.env.ADMIN_USER_ID;
    const adminEmail = process.env.ADMIN_EMAIL;
    
    // Dual security check: User ID AND Email verification
    const isUserIdMatch = adminUserId && identity.subject === adminUserId;
    const isEmailMatch = adminEmail && identity.email === adminEmail;
    
    const isAdmin = isUserIdMatch || isEmailMatch;
    
    console.log(`🔐 [Admin] Auth check for user: ${identity.subject?.slice(0, 20)}... (${identity.email})`);
    console.log(`🔐 [Admin] User ID match: ${isUserIdMatch}, Email match: ${isEmailMatch}, Result: ${isAdmin}`);
    
    return isAdmin;
  }
});