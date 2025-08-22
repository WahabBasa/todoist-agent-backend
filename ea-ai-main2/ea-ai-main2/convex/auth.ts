import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password,
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline", // Required for refresh tokens
          prompt: "consent",
          response_type: "code"
        }
      },
      profile(profile, tokens) {
        console.log("[OAUTH] Google profile received:", { 
          profileId: profile.sub,
          hasTokens: !!tokens,
          tokenKeys: tokens ? Object.keys(tokens) : [],
          accessToken: tokens?.access_token ? "[PRESENT]" : "[MISSING]",
          refreshToken: tokens?.refresh_token ? "[PRESENT]" : "[MISSING]",
          expiresIn: tokens?.expires_in,
          scope: tokens?.scope
        });
        
        // Note: We can see the tokens here but Convex Auth doesn't provide
        // a direct callback mechanism to store them automatically.
        // The tokens will be available in the authAccounts table after OAuth
        // completion, and our session manager will handle them.
        
        if (tokens?.access_token) {
          console.log("[OAUTH] OAuth tokens captured during flow - will be available in authAccounts");
        } else {
          console.warn("[OAUTH] No access token in profile callback - this may indicate an OAuth issue");
        }
        
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      }
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
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    const isGoogleUser = accounts.some(account => account.provider === "google");
    
    return {
      ...user,
      isGoogleUser,
      accounts: accounts.map(acc => ({ provider: acc.provider }))
    };
  },
});

/**
 * Post-OAuth initialization hook
 * 
 * This action should be called from the frontend after successful OAuth
 * to ensure tokens are properly captured and the session is initialized.
 */
export const initializeGoogleCalendarAfterOAuth = action({
  handler: async (ctx): Promise<{
    success: boolean;
    connected: boolean;
    message: string;
    hasRefreshToken?: boolean;
    expiresAt?: number;
    migrated?: boolean;
    instructions?: string[];
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    console.log(`[OAuth Init] Initializing Google Calendar for user: ${userId}`);

    // Use session manager to check connection status
    const sessionStatus = await ctx.runAction(api.googleCalendar.sessionManager.getCurrentUserSession);
    
    if (sessionStatus.isConnected) {
      console.log(`[OAuth Init] User ${userId} already has active session`);
      
      // Get detailed status for response
      const connectionStatus = await ctx.runAction(api.googleCalendar.oauthFlow.getOAuthConnectionStatus);
      
      return {
        success: true,
        connected: true,
        message: "Google Calendar is already connected and ready",
        hasRefreshToken: connectionStatus.tokenInfo?.hasRefreshToken,
        expiresAt: connectionStatus.tokenInfo?.expiresAt,
      };
    }

    // If not connected, try legacy migration first
    console.log(`[OAuth Init] No active session, attempting legacy migration for user: ${userId}`);
    
    try {
      const migrationResult = await ctx.runAction(api.googleCalendar.oauthFlow.migrateLegacyTokens);
      
      if (migrationResult.migrated) {
        console.log(`[OAuth Init] Successfully migrated legacy tokens for user: ${userId}`);
        return {
          success: true,
          connected: true,
          message: "Google Calendar tokens migrated from legacy system",
          migrated: true,
        };
      }
    } catch (error) {
      console.log(`[OAuth Init] Migration failed for user ${userId}:`, error);
    }

    // Check if user has Google OAuth account but no calendar access
    const googleAccount = await ctx.runQuery(internal.googleCalendar.sessionManager.getGoogleOAuthTokens, {
      userId,
    });

    if (!googleAccount) {
      return {
        success: false,
        connected: false,
        message: "No Google account found. Please sign in with Google first.",
        instructions: [
          "1. Sign in with your Google account",
          "2. Grant Calendar permissions when prompted",
          "3. Calendar features will be automatically enabled"
        ]
      };
    }

    // Has Google account but no calendar tokens - need to grant permissions
    return {
      success: false,
      connected: false,
      message: "Google account connected but Calendar access not granted",
      instructions: [
        "1. Go to Settings → Google Calendar",
        "2. Click 'Refresh Connection' to grant Calendar permissions",
        "3. Follow the OAuth prompts to enable Calendar access"
      ]
    };
  },
});
