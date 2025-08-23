import { internalMutation } from "./_generated/server";

// Delete all existing users - clean slate approach
export const deleteAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    let deletedCount = 0;
    for (const user of users) {
      await ctx.db.delete(user._id);
      deletedCount++;
      console.log(`Deleted user: ${user._id} (${user.name})`);
    }
    
    console.log(`Deleted ${deletedCount} users`);
    return { deletedUsers: deletedCount };
  },
});

// Delete only users with old format IDs (safer)
export const deleteOldFormatUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    let deletedCount = 0;
    for (const user of users) {
      // Delete users with old format (no | in externalId)
      if (user.externalId && !user.externalId.includes("|")) {
        await ctx.db.delete(user._id);
        deletedCount++;
        console.log(`Deleted old format user: ${user._id} (${user.externalId})`);
      }
    }
    
    console.log(`Deleted ${deletedCount} old format users`);
    return { deletedUsers: deletedCount };
  },
});

// List all users for inspection
export const listUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    console.log(`Found ${users.length} users:`);
    for (const user of users) {
      console.log(`- ${user._id}: ${user.name} (${user.externalId})`);
    }
    
    return users.map(u => ({ 
      id: u._id, 
      name: u.name, 
      externalId: u.externalId,
      hasTokenFormat: u.externalId?.includes("|") || false
    }));
  },
});