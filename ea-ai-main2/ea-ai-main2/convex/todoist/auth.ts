import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Todoist OAuth configuration
const TODOIST_OAUTH_BASE_URL = "https://todoist.com/oauth";
const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";

// Get the redirect URI for OAuth
function getOAuthRedirectURI(): string {
  // For Convex HTTP routes, we need to use the site URL format
  // Development: Use the Convex site domain
  return "https://peaceful-boar-923.convex.site/auth/todoist/callback";
}

// Store Todoist OAuth tokens for users
export const storeTodoistToken = mutation({
  args: {
    accessToken: v.string(),
  },
  handler: async (ctx, { accessToken }) => {
    const userId = await getAuthUserId(ctx);
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

// Get Todoist access token for the current user
export const getTodoistToken = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
  handler: async () => {
    const clientId = process.env.TODOIST_CLIENT_ID;
    if (!clientId) {
      console.warn("Todoist Client ID not configured in Convex environment");
      return {
        url: null,
        state: null,
        error: "Todoist integration not configured. Please set up Todoist credentials in Convex environment."
      };
    }

    const state = Math.random().toString(36).substring(2, 15);
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
export const exchangeCodeForToken = mutation({
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

    // Store the token for the user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    await ctx.db.insert("todoistTokens", {
      userId,
      accessToken: tokenData.access_token,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});