import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const clearOldConversations = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all conversations to fix schema issues
    const conversations = await ctx.db.query("conversations").collect();
    
    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
    }
    
    return `Deleted ${conversations.length} old conversation records`;
  },
});