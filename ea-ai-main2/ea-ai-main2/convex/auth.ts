import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { GoogleOIDC } from "@convex-dev/auth/providers/GoogleOIDC";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password,
    GoogleOIDC({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});

// Query to get user profile with auth provider info
export const getUserProfile = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Get auth accounts to determine login provider
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    const isGoogleUser = accounts.some(account => account.provider === "googleoidc");
    
    return {
      ...user,
      isGoogleUser,
      accounts: accounts.map(acc => ({ provider: acc.provider }))
    };
  },
});
