import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const inspectAuthTables = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { error: "User not authenticated" };
    }

    // Check authAccounts table structure
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    // Check authRefreshTokens table
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .collect();

    return {
      userId,
      authAccounts: authAccounts.map(acc => ({
        ...acc,
        // Hide sensitive data in logs but show structure
        access_token: acc.access_token ? "[REDACTED]" : undefined,
        refresh_token: acc.refresh_token ? "[REDACTED]" : undefined,
        id_token: acc.id_token ? "[REDACTED]" : undefined,
      })),
      refreshTokensCount: refreshTokens.length,
      refreshTokensStructure: refreshTokens[0] ? Object.keys(refreshTokens[0]) : []
    };
  },
});