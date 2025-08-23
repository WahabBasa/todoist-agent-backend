import { internalMutation } from "./_generated/server";

// One-time migration to convert existing users from raw Clerk ID to tokenIdentifier format
export const migrateUserIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const hostname = process.env.CLERK_HOSTNAME;
    
    if (!hostname) {
      throw new Error("CLERK_HOSTNAME environment variable is required");
    }

    let migratedCount = 0;
    
    for (const user of users) {
      // Check if user.externalId is in old format (doesn't contain |)
      if (user.externalId && !user.externalId.includes("|")) {
        const newExternalId = `https://${hostname}|${user.externalId}`;
        await ctx.db.patch(user._id, { externalId: newExternalId });
        migratedCount++;
        console.log(`Migrated user ${user._id}: ${user.externalId} → ${newExternalId}`);
      }
    }
    
    console.log(`Migration complete: ${migratedCount} users migrated`);
    return { migratedUsers: migratedCount };
  },
});