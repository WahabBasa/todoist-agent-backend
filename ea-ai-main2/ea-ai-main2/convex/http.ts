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

      // In tokenIdentifier pattern, we don't need to sync users to database
      // Clerk authentication is handled directly via tokenIdentifier in each function
      switch (result.type) {
        case "user.created":
        case "user.updated":
          const userData = result.data as any;
          console.log(`User ${result.type}: ${userData.id} (${userData.email_addresses?.[0]?.email_address || 'no email'})`);
          break;

        case "user.deleted": {
          const userData = result.data as any;
          console.log(`User deleted: ${userData.id}`);
          // Note: In tokenIdentifier pattern, associated data is automatically inaccessible
          // when the tokenIdentifier becomes invalid, so no cleanup needed
          break;
        }

        case "organizationMembership.created":
        case "organizationMembership.updated":
        case "organizationMembership.deleted":
          // Organization features not currently implemented
          console.log(`Organization membership event: ${result.type}`);
          break;

        default:
          console.log("Ignored Clerk webhook event:", result.type);
      }

      return new Response(null, {
        status: 200,
      });
    } catch (err) {
      console.error("Clerk webhook error:", err);
      return new Response("Webhook Error", {
        status: 400,
      });
    }
  }),
});

export default http;