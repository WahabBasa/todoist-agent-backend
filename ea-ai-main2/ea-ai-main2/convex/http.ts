import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { WebhookEvent } from "@clerk/backend";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const headerPayload = request.headers;

    try {
      const result: WebhookEvent = await ctx.runAction(internal.clerk.fulfill, {
        payload: payloadString,
        headers: {
          "svix-id": headerPayload.get("svix-id")!,
          "svix-timestamp": headerPayload.get("svix-timestamp")!,
          "svix-signature": headerPayload.get("svix-signature")!,
        },
      });

      switch (result.type) {
        case "user.created":
        case "user.updated":
          // Transform raw Clerk ID to tokenIdentifier format for consistency
          const userData = result.data as any;
          const tokenIdentifier = `https://${process.env.CLERK_HOSTNAME}|${userData.id}`;
          await ctx.runMutation(internal.users.upsertFromClerk, {
            data: { ...userData, tokenIdentifier },
          });
          break;

        case "user.deleted": {
          const userData = result.data as any;
          // Transform raw Clerk ID to tokenIdentifier format for consistency
          const tokenIdentifier = `https://${process.env.CLERK_HOSTNAME}|${userData.id}`;
          await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId: tokenIdentifier });
          break;
        }

        case "organizationMembership.created":
        case "organizationMembership.updated":
          await ctx.runMutation(internal.memberships.addUserIdToOrg, {
            userId: `https://${process.env.CLERK_HOSTNAME}|${result.data.public_user_data.user_id}`,
            orgId: result.data.organization.id,
          });
          break;

        case "organizationMembership.deleted":
          await ctx.runMutation(internal.memberships.removeUserIdFromOrg, {
            userId: `https://${process.env.CLERK_HOSTNAME}|${result.data.public_user_data.user_id}`,
            orgId: result.data.organization.id,
          });
          break;

        default:
          console.log("Ignored webhook event", result.type);
      }

      return new Response(null, {
        status: 200,
      });
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response("Webhook Error", {
        status: 400,
      });
    }
  }),
});

export default http;
