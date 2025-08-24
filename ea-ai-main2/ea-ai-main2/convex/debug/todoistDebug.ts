import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Debug function to inspect todoistTokens table and connection status
export const debugTodoistTokens = query({
  handler: async (ctx) => {
    console.log("🔍 DEBUG: Starting Todoist token debugging...");
    
    // Get current user's tokenIdentifier
    const identity = await ctx.auth.getUserIdentity();
    const currentTokenIdentifier = identity?.tokenIdentifier;
    
    console.log("🔍 Current user tokenIdentifier:", currentTokenIdentifier);
    
    // Get all records in todoistTokens table
    const allTokens = await ctx.db.query("todoistTokens").collect();
    console.log(`🔍 Found ${allTokens.length} total records in todoistTokens table`);
    
    const debugInfo = {
      currentUser: {
        authenticated: !!identity,
        tokenIdentifier: currentTokenIdentifier,
        tokenIdentifierLength: currentTokenIdentifier?.length || 0,
        tokenIdentifierPreview: currentTokenIdentifier?.substring(0, 50) + "..." || null
      },
      database: {
        totalRecords: allTokens.length,
        records: allTokens.map((token, index) => ({
          index,
          id: token._id,
          tokenIdentifier: token.tokenIdentifier,
          tokenIdentifierLength: token.tokenIdentifier.length,
          tokenIdentifierPreview: token.tokenIdentifier.substring(0, 50) + "...",
          hasAccessToken: !!token.accessToken,
          accessTokenPreview: token.accessToken ? token.accessToken.substring(0, 10) + "..." : null,
          createdAt: new Date(token.createdAt).toISOString(),
          updatedAt: new Date(token.updatedAt).toISOString()
        }))
      },
      comparison: {
        exactMatch: allTokens.some(token => token.tokenIdentifier === currentTokenIdentifier),
        possibleMatches: allTokens.filter(token => 
          token.tokenIdentifier.includes(currentTokenIdentifier?.split('/')[0] || '') ||
          currentTokenIdentifier?.includes(token.tokenIdentifier.split('/')[0] || '')
        ).length
      }
    };
    
    console.log("🔍 DEBUG INFO:", JSON.stringify(debugInfo, null, 2));
    
    return debugInfo;
  },
});

// Test the hasTodoistConnection query with debug info
export const debugConnectionCheck = query({
  handler: async (ctx) => {
    console.log("🔍 DEBUG: Testing hasTodoistConnection logic...");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.log("❌ No identity found");
      return { error: "No identity found" };
    }
    
    const tokenIdentifier = identity.tokenIdentifier;
    console.log("🔍 Searching for tokenIdentifier:", tokenIdentifier);
    
    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    
    console.log("🔍 Query result:", token ? "FOUND" : "NOT FOUND");
    if (token) {
      console.log("🔍 Found token:", {
        id: token._id,
        tokenIdentifier: token.tokenIdentifier,
        hasAccessToken: !!token.accessToken
      });
    }
    
    return {
      searchingFor: tokenIdentifier,
      found: !!token,
      tokenData: token ? {
        id: token._id,
        tokenIdentifier: token.tokenIdentifier,
        hasAccessToken: !!token.accessToken
      } : null
    };
  },
});

// Debug query to see all tokens (requires auth but shows more info)
export const debugAllTokensRaw = query({
  handler: async (ctx) => {
    // Skip auth check for debugging
    try {
      const allTokens = await ctx.db.query("todoistTokens").collect();
      return {
        success: true,
        tokens: allTokens.map(token => ({
          id: token._id,
          tokenIdentifier: token.tokenIdentifier,
          tokenIdentifierPreview: token.tokenIdentifier.substring(0, 100),
          hasAccessToken: !!token.accessToken,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt
        }))
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});