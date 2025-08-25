import { mutation, query, action, internalQuery, internalMutation } from "../_generated/server";
// Clerk authentication handled via ctx.auth.getUserIdentity()
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { 
  requireUserAuth, 
  getUserContext, 
  logUserAccess 
} from "./userAccess";

// Todoist OAuth configuration
const TODOIST_OAUTH_BASE_URL = "https://todoist.com/oauth";

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
  handler: async (ctx, { accessToken }): Promise<any> => {
    // Use big-brain authentication pattern
    const { userId: tokenIdentifier } = await requireUserAuth(ctx);
    logUserAccess(tokenIdentifier, "STORE_TODOIST_TOKEN", "REQUESTED");

    // Check if user already has a Todoist token
    const existingToken = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        accessToken,
        updatedAt: Date.now(),
      });
      logUserAccess(tokenIdentifier, "STORE_TODOIST_TOKEN", "SUCCESS - Updated");
      return existingToken._id;
    } else {
      // Create new token record
      const tokenId = await ctx.db.insert("todoistTokens", {
        tokenIdentifier,
        accessToken,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      logUserAccess(tokenIdentifier, "STORE_TODOIST_TOKEN", "SUCCESS - Created");
      return tokenId;
    }
  },
});

// Store Todoist OAuth tokens for specific user (OAuth callback context)
export const storeTodoistTokenForUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    accessToken: v.string(),
  },
  handler: async (ctx, { tokenIdentifier, accessToken }): Promise<any> => {
    // Check if user already has a Todoist token
    const existingToken = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
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
        tokenIdentifier,
        accessToken,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get Todoist access token for the current user
export const getTodoistToken = query({
  handler: async (ctx): Promise<string | null> => {
    // Use big-brain pattern for consistent authentication
    const userContext = await getUserContext(ctx);
    if (!userContext) {
      return null; // Big-brain pattern: return null instead of throwing
    }

    const { userId: tokenIdentifier } = userContext;
    logUserAccess(tokenIdentifier, "GET_TODOIST_TOKEN", "REQUESTED");

    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    const hasToken = token !== null;
    logUserAccess(tokenIdentifier, "GET_TODOIST_TOKEN", hasToken ? "SUCCESS" : "NO_TOKEN");
    return token ? { accessToken: token.accessToken } : null;
  },
});

// Check if user has Todoist connected (with proper user validation)
export const hasTodoistConnection = query({
  handler: async (ctx): Promise<boolean> => {
    const userContext = await getUserContext(ctx);
    if (!userContext) {
      logUserAccess("anonymous", "TODOIST_CONNECTION_CHECK", "FAILED - Not authenticated");
      return false;
    }

    const { userId } = userContext;
    logUserAccess(userId, "TODOIST_CONNECTION_CHECK", "REQUESTED");

    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
      .unique();

    const hasConnection = token !== null && token.accessToken.length > 0;
    logUserAccess(userId, "TODOIST_CONNECTION_CHECK", hasConnection ? "SUCCESS" : "NO_CONNECTION");
    
    return hasConnection;
  },
});

// Quick fix for tokenIdentifier mismatch
export const fixTokenIdentifierMismatch = mutation({
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    
    const currentTokenIdentifier = identity.tokenIdentifier;
    console.log("🔧 Fixing tokenIdentifier to:", currentTokenIdentifier);
    
    // Find the token with old format (base URL + |user)
    const baseUrl = currentTokenIdentifier.split('|')[0];
    const oldTokenIdentifier = baseUrl + "|user";
    
    const oldToken = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", oldTokenIdentifier))
      .unique();
    
    if (!oldToken) {
      return { success: false, message: "No token found with old format to update" };
    }
    
    console.log("🔧 Updating token from:", oldTokenIdentifier, "to:", currentTokenIdentifier);
    
    // Update the token with current tokenIdentifier
    await ctx.db.patch(oldToken._id, {
      tokenIdentifier: currentTokenIdentifier,
      updatedAt: Date.now()
    });
    
    console.log("✅ Token updated successfully");
    
    return { 
      success: true, 
      message: "TokenIdentifier updated successfully",
      oldTokenIdentifier,
      newTokenIdentifier: currentTokenIdentifier
    };
  },
});

// Remove Todoist connection with proper token revocation
export const removeTodoistConnection = action({
  handler: async (ctx): Promise<any> => {
    // Get current authenticated user using action-compatible method
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new Error("Authentication required to disconnect Todoist account.");
    }

    const tokenIdentifier = identity.tokenIdentifier;
    logUserAccess(tokenIdentifier, "REMOVE_TODOIST_CONNECTION", "REQUESTED");

    // Get user's current token via internal query
    const tokenData = await ctx.runQuery(internal.todoist.auth.getTodoistTokenForUser, {
      tokenIdentifier,
    });

    if (!tokenData?.accessToken) {
      logUserAccess(tokenIdentifier, "REMOVE_TODOIST_CONNECTION", "NO_TOKEN_FOUND");
      return { success: true, message: "No Todoist connection found to disconnect." };
    }

    const clientId = process.env.TODOIST_CLIENT_ID;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logUserAccess(tokenIdentifier, "REMOVE_TODOIST_CONNECTION", "FAILED - Missing credentials");
      throw new Error("Todoist OAuth credentials not configured for token revocation.");
    }

    try {
      // Step 1: Revoke the token with Todoist
      logUserAccess(tokenIdentifier, "TODOIST_TOKEN_REVOCATION", "ATTEMPTING");
      
      const revokeParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        access_token: tokenData.accessToken,
      });

      const revokeResponse = await fetch(`https://api.todoist.com/api/v1/access_tokens?${revokeParams.toString()}`, {
        method: 'DELETE',
      });

      if (!revokeResponse.ok) {
        const errorText = await revokeResponse.text();
        logUserAccess(tokenIdentifier, "TODOIST_TOKEN_REVOCATION", `FAILED - ${revokeResponse.status}: ${errorText}`);
        
        // Continue with local deletion even if revocation fails
        // This prevents users from being stuck with unrevokable tokens
        console.warn(`⚠️ Failed to revoke Todoist token (${revokeResponse.status}), proceeding with local deletion`);
      } else {
        logUserAccess(tokenIdentifier, "TODOIST_TOKEN_REVOCATION", "SUCCESS");
      }

      // Step 2: Remove token from our database
      await ctx.runMutation(internal.todoist.auth.deleteTodoistTokenForUser, {
        tokenIdentifier,
      });

      logUserAccess(tokenIdentifier, "REMOVE_TODOIST_CONNECTION", "SUCCESS - Revoked and deleted");
      
      return { 
        success: true, 
        message: "Todoist account disconnected successfully. You can now connect a different account." 
      };

    } catch (error) {
      logUserAccess(tokenIdentifier, "REMOVE_TODOIST_CONNECTION", `FAILED - ${error}`);
      console.error("Error during Todoist disconnection:", error);
      
      // In case of network/other errors, still attempt local deletion
      try {
        await ctx.runMutation(internal.todoist.auth.deleteTodoistTokenForUser, {
          tokenIdentifier,
        });
        
        return { 
          success: true, 
          message: "Todoist connection removed locally. Please manually revoke access in your Todoist settings if needed." 
        };
      } catch (deleteError) {
        console.error("Failed to delete token locally:", deleteError);
        throw new Error("Failed to disconnect Todoist account. Please try again.");
      }
    }
  },
});

// Generate OAuth authorization URL
export const generateOAuthURL = query({
  handler: async (ctx): Promise<any> => {
    const clientId = process.env.TODOIST_CLIENT_ID;
    if (!clientId) {
      console.warn("Todoist Client ID not configured in Convex environment");
      return {
        url: null,
        state: null,
        error: "Todoist integration not configured. Please set up Todoist credentials in Convex environment."
      };
    }

    // Get current authenticated user ID using big-brain pattern
    const userContext = await getUserContext(ctx);
    if (!userContext) {
      return {
        url: null,
        state: null,
        error: "User must be authenticated to connect Todoist account."
      };
    }
    
    const { userId: tokenIdentifier } = userContext;
    logUserAccess(tokenIdentifier, "GENERATE_OAUTH_URL", "REQUESTED");

    // Encode tokenIdentifier in state parameter for OAuth callback (Base64 for URL safety)
    const encodedTokenIdentifier = btoa(tokenIdentifier); // Base64 encode for URL safety
    const randomString = Math.random().toString(36).substring(2, 15);
    const state = `${encodedTokenIdentifier}_${randomString}`;
    const scope = "data:read_write,task:add";
    const redirectUri = getOAuthRedirectURI();
    
    const params = new URLSearchParams({
      client_id: clientId,
      scope,
      state,
      redirect_uri: redirectUri,
      // Experimental: Try to force account selection (may not be supported by Todoist)
      prompt: "select_account",
    });

    const oauthUrl = `${TODOIST_OAUTH_BASE_URL}/authorize?${params.toString()}`;
    logUserAccess(tokenIdentifier, "GENERATE_OAUTH_URL", "SUCCESS");
    
    return {
      url: oauthUrl,
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
  handler: async (ctx, { code, state }): Promise<any> => {
    const clientId = process.env.TODOIST_CLIENT_ID;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("Todoist OAuth credentials not configured");
    }

    // Decode tokenIdentifier from state parameter
    const stateParts = state.split('_');
    if (stateParts.length < 2) {
      throw new Error("Invalid state parameter format");
    }
    
    // Decode the Base64 encoded tokenIdentifier
    const encodedTokenIdentifier = stateParts[0]; // First part is the encoded tokenIdentifier
    let tokenIdentifier: string;
    try {
      tokenIdentifier = atob(encodedTokenIdentifier); // Base64 decode
    } catch (error) {
      throw new Error("Invalid Base64 encoded tokenIdentifier in state parameter");
    }
    
    // Validate tokenIdentifier format (Clerk tokenIdentifiers are URLs)
    if (!tokenIdentifier || typeof tokenIdentifier !== 'string' || tokenIdentifier.length < 10) {
      throw new Error("Invalid tokenIdentifier in state parameter");
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

    // Check if this access token is already being used by another user
    const existingTokenUsers = await ctx.runQuery(internal.todoist.auth.findTokenUsers, {
      accessToken: tokenData.access_token,
    });

    if (existingTokenUsers.length > 0) {
      const otherUserIds = existingTokenUsers
        .filter((user: any) => user.tokenIdentifier !== tokenIdentifier)
        .map((user: any) => user.tokenIdentifier.split('|').pop()?.substring(0, 8) + '...')
        .join(', ');
      
      if (otherUserIds) {
        console.warn(`⚠️ Todoist account already connected to other users: ${otherUserIds}`);
        
        return { 
          success: false, 
          errorType: "ACCOUNT_CONFLICT",
          message: "This Todoist account is already connected to another account.",
          instructions: [
            "Disconnect Todoist from your other account or device first",
            "Go to Settings → Connected Apps → Todoist → Disconnect",
            "Return here and try connecting again",
            "The same Todoist account cannot be connected to multiple users"
          ]
        };
      }
    }

    // Store the token using the tokenIdentifier from state parameter
    await ctx.runMutation(api.todoist.auth.storeTodoistTokenForUser, {
      tokenIdentifier: tokenIdentifier,
      accessToken: tokenData.access_token,
    });

    return { success: true };
  },
});

// Internal query to find all users using a specific access token
export const findTokenUsers = internalQuery({
  args: {
    accessToken: v.string(),
  },
  handler: async (ctx, { accessToken }): Promise<any[]> => {
    const tokens: any[] = await ctx.db
      .query("todoistTokens")
      .collect();
    
    return tokens.filter((token: any) => token.accessToken === accessToken);
  },
});

// Internal query to get Todoist token for a specific user (for action contexts)
export const getTodoistTokenForUser = internalQuery({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }): Promise<any> => {
    const tokenRecord = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    return tokenRecord ? { accessToken: tokenRecord.accessToken } : null;
  },
});

// Internal query for actions to check if user has active Todoist connection
export const hasActiveTodoistConnectionQuery = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }): Promise<boolean> => {
    try {
      const tokenRecord = await ctx.db
        .query("todoistTokens")
        .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
        .unique();
      
      return tokenRecord !== null && tokenRecord.accessToken.length > 0;
    } catch (error) {
      console.error("Error checking Todoist connection:", error);
      return false;
    }
  },
});

// Internal query for actions to get user's Todoist token
export const getUserTodoistTokenQuery = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }): Promise<string | null> => {
    try {
      const tokenRecord = await ctx.db
        .query("todoistTokens")
        .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
        .unique();
      
      return tokenRecord?.accessToken || null;
    } catch (error) {
      console.error("Error retrieving Todoist token:", error);
      return null;
    }
  },
});

// Internal mutation to delete Todoist token for a specific user
export const deleteTodoistTokenForUser = internalMutation({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }): Promise<any> => {
    const tokenRecord = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (tokenRecord) {
      await ctx.db.delete(tokenRecord._id);
      return { success: true, deleted: true };
    } else {
      return { success: true, deleted: false, message: "No token found to delete" };
    }
  },
});