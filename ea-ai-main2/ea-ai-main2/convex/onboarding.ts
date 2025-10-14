import { action } from "./_generated/server";

export const completeOnboarding = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get Clerk secret key from environment
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.error("CLERK_SECRET_KEY not configured");
      throw new Error("Clerk configuration missing");
    }

    // Extract user ID from subject (format: user_xxxxx)
    const userId = identity.subject;

    try {
      // Update user's public metadata via Clerk Backend API
      const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_metadata: {
            onboardingComplete: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update Clerk metadata:", errorText);
        throw new Error(`Failed to update user metadata: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Error updating Clerk metadata:", error);
      throw error;
    }
  },
});
