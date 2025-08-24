import { query, mutation } from "../_generated/server";

// Migration function to update tokenIdentifier for current user
export const fixCurrentUserTokenIdentifier = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    
    const currentTokenIdentifier = identity.tokenIdentifier;
    console.log("🔧 Current user tokenIdentifier:", currentTokenIdentifier);
    
    // Find tokens that might belong to this user (partial match)
    const allTokens = await ctx.db.query("todoistTokens").collect();
    console.log(`🔧 Found ${allTokens.length} total tokens`);
    
    // Look for tokens with matching base URL but different user suffix
    const baseUrl = currentTokenIdentifier.split('|')[0]; // "https://tender-wren-51.clerk.accounts.dev"
    const matchingTokens = allTokens.filter(token => 
      token.tokenIdentifier.startsWith(baseUrl + "|user")
    );
    
    console.log(`🔧 Found ${matchingTokens.length} potentially matching tokens`);
    
    if (matchingTokens.length === 0) {
      return { 
        success: false, 
        message: "No matching tokens found to update",
        currentTokenIdentifier
      };
    }
    
    if (matchingTokens.length > 1) {
      return { 
        success: false, 
        message: `Multiple matching tokens found (${matchingTokens.length}), manual intervention needed`,
        matchingTokens: matchingTokens.map(t => t.tokenIdentifier)
      };
    }
    
    // Update the single matching token
    const tokenToUpdate = matchingTokens[0];
    console.log("🔧 Updating token:", {
      from: tokenToUpdate.tokenIdentifier,
      to: currentTokenIdentifier
    });
    
    await ctx.db.patch(tokenToUpdate._id, {
      tokenIdentifier: currentTokenIdentifier,
      updatedAt: Date.now()
    });
    
    console.log("✅ Token updated successfully");
    
    return {
      success: true,
      message: "Token identifier updated successfully",
      oldTokenIdentifier: tokenToUpdate.tokenIdentifier,
      newTokenIdentifier: currentTokenIdentifier,
      tokenId: tokenToUpdate._id
    };
  },
});

// Test connection after fix
export const testConnectionAfterFix = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User not authenticated");
    
    const tokenIdentifier = identity.tokenIdentifier;
    console.log("🧪 Testing connection with tokenIdentifier:", tokenIdentifier);
    
    const token = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    
    console.log("🧪 Test result:", token ? "✅ CONNECTION FOUND" : "❌ CONNECTION NOT FOUND");
    
    return {
      tokenIdentifier,
      found: !!token,
      tokenData: token ? {
        id: token._id,
        hasAccessToken: !!token.accessToken,
        createdAt: new Date(token.createdAt).toISOString(),
        updatedAt: new Date(token.updatedAt).toISOString()
      } : null
    };
  },
});