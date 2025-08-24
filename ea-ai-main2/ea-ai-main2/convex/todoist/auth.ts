import { mutation, query, action, internalQuery } from "../_generated/server";
// Clerk authentication handled via ctx.auth.getUserIdentity()
import { v } from "convex/values";
import { api } from "../_generated/api";

// Todoist OAuth configuration
const TODOIST_OAUTH_BASE_URL = "https://todoist.com/oauth";
const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";

// Get the redirect URI for OAuth
function getOAuthRedirectURI(): string {
  // For Convex HTTP routes, we need to use the site URL format
  // Development: Use the Convex site domain
  return "https://peaceful-boar-923.convex.site/auth/todoist/callback";
}

// Store Todoist OAuth tokens for users (authenticated context)
export const storeTodoistToken = mutation({
  args: {
    accessToken: v.string(),
  },
  handler: async (ctx, { accessToken }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check if user already has a Todoist token
    const existingToken = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        accessToken,
        updatedAt: Date.now(),
      });
      return existingToken._id;
    } else {
      // Create new token record
      return await ctx.db.insert("todoistTokens", {
        userId,
        accessToken,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Store Todoist OAuth tokens for specific user (OAuth callback context)
export const storeTodoistTokenForUser = mutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
  },
  handler: async (ctx, { userId, accessToken }) => {
    // Check if user already has a Todoist token
    const existingToken = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        accessToken,
        updatedAt: Date.now(),
      });
      return existingToken._id;
    } else {
      // Create new token record
      return await ctx.db.insert("todoistTokens", {
        userId,
        accessToken,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get Todoist access token for the current user
export const getTodoistToken = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      return null;
    }

    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return token ? { accessToken: token.accessToken } : null;
  },
});

// Check if user has Todoist connected
export const hasTodoistConnection = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      return false;
    }

    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return token !== null;
  },
});

// Remove Todoist connection
export const removeTodoistConnection = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (token) {
      await ctx.db.delete(token._id);
    }
  },
});

// Generate OAuth authorization URL
export const generateOAuthURL = query({
  handler: async (ctx) => {
    const clientId = process.env.TODOIST_CLIENT_ID;
    if (!clientId) {
      console.warn("Todoist Client ID not configured in Convex environment");
      return {
        url: null,
        state: null,
        error: "Todoist integration not configured. Please set up Todoist credentials in Convex environment."
      };
    }

    // Get current authenticated user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    const userId = identity.tokenIdentifier;
    if (!userId) {
      return {
        url: null,
        state: null,
        error: "User must be authenticated to connect Todoist account."
      };
    }

    // Encode userId in state parameter for OAuth callback
    const randomString = Math.random().toString(36).substring(2, 15);
    const state = `${userId}_${randomString}`;
    const scope = "data:read_write,task:add";
    const redirectUri = getOAuthRedirectURI();
    
    const params = new URLSearchParams({
      client_id: clientId,
      scope,
      state,
      redirect_uri: redirectUri,
    });

    return {
      url: `${TODOIST_OAUTH_BASE_URL}/authorize?${params.toString()}`,
      state,
      error: null
    };
  },
});

// Exchange authorization code for access token
export const exchangeCodeForToken = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, { code, state }) => {
    const clientId = process.env.TODOIST_CLIENT_ID;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("Todoist OAuth credentials not configured");
    }

    // Decode userId from state parameter
    const stateParts = state.split('_');
    if (stateParts.length < 2) {
      throw new Error("Invalid state parameter format");
    }
    
    const userId = stateParts[0]; // First part is the userId
    
    // Validate userId format (Convex IDs start with a letter)
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      throw new Error("Invalid user ID in state parameter");
    }

    // Exchange authorization code for access token
    const response = await fetch(`${TODOIST_OAUTH_BASE_URL}/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getOAuthRedirectURI(),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error("No access token received from Todoist");
    }

    // Store the token using the userId from state parameter
    await ctx.runMutation(api.todoist.auth.storeTodoistTokenForUser, {
      userId: userId as any, // Cast to Id<"users"> type
      accessToken: tokenData.access_token,
    });

    return { success: true };
  },
});

// Internal query to get Todoist token for a specific user (for action contexts)
export const getTodoistTokenForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const tokenRecord = await ctx.db
      .query("todoistTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return tokenRecord ? { accessToken: tokenRecord.accessToken } : null;
  },
});