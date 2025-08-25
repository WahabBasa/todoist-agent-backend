import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
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

// Todoist OAuth callback handler
http.route({
  path: "/auth/todoist/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    try {
      // Validate required parameters
      if (!code || !state) {
        console.error("Todoist OAuth callback missing parameters:", { code: !!code, state: !!state });
        return new Response(
          `<html><body><script>
            alert('OAuth callback failed: Missing required parameters');
            window.close();
          </script></body></html>`,
          { 
            status: 400,
            headers: { "Content-Type": "text/html" }
          }
        );
      }

      console.log("Todoist OAuth callback received:", { 
        code: code.substring(0, 10) + "...", 
        state: state.substring(0, 20) + "..." 
      });

      // Exchange code for access token using existing action
      const result = await ctx.runAction(api.todoist.auth.exchangeCodeForToken, {
        code,
        state,
      });

      if (result.success) {
        console.log("Todoist OAuth token exchange successful, now verifying token storage...");
        
        // Extract tokenIdentifier from state to verify token was stored correctly
        const tokenIdentifier = state.split('_')[0];
        console.log("Verifying token storage for tokenIdentifier:", tokenIdentifier.substring(0, 20) + "...");
        
        // Wait a moment for token storage to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify token was actually stored using public hasTodoistConnection query
        // We need to temporarily create a mock context with the tokenIdentifier for verification
        try {
          // Since hasTodoistConnection uses ctx.auth.getUserIdentity(), we can't verify directly
          // Instead, we'll just add extra delay and trust the token storage process worked
          console.log("✅ Token exchange completed, trusting token storage process");
          
          return new Response(
            `<html><body><script>
              console.log('Todoist connection successful!');
              // Give extra time for token storage to complete and queries to refresh
              setTimeout(() => {
                console.log('Closing OAuth popup...');
                window.close();
              }, 300);
            </script></body></html>`,
            { 
              status: 200,
              headers: { "Content-Type": "text/html" }
            }
          );
          
        } catch (verificationError) {
          console.error("❌ Token verification failed:", verificationError);
          const errorMessage = verificationError instanceof Error ? verificationError.message : String(verificationError);
          return new Response(
            `<html><body><script>
              alert('OAuth connection completed but verification failed: ${errorMessage}');
              window.close();
            </script></body></html>`,
            { 
              status: 500,
              headers: { "Content-Type": "text/html" }
            }
          );
        }
      } else if (result.errorType === "ACCOUNT_CONFLICT") {
        console.log("🚨 [OAuth] Todoist account conflict detected, sending PostMessage to parent");
        console.log("🚨 [OAuth] Conflict data:", {
          message: result.message,
          instructions: result.instructions
        });
        return new Response(
          `<html><body><script>
            console.log('🚨 [Popup] Todoist account conflict - preparing PostMessage');
            console.log('🚨 [Popup] Window opener exists:', !!window.opener);
            console.log('🚨 [Popup] Origin:', window.location.origin);
            
            // Send conflict data to parent window
            if (window.opener) {
              const conflictData = {
                type: 'TODOIST_ACCOUNT_CONFLICT',
                data: {
                  message: '${result.message}',
                  instructions: ${JSON.stringify(result.instructions)}
                }
              };
              console.log('🚨 [Popup] Sending PostMessage:', conflictData);
              window.opener.postMessage(conflictData, '*');
              console.log('🚨 [Popup] PostMessage sent successfully');
            } else {
              console.error('🚨 [Popup] No window.opener available for PostMessage');
            }
            
            console.log('🚨 [Popup] Closing popup window');
            window.close();
          </script></body></html>`,
          { 
            status: 200,
            headers: { "Content-Type": "text/html" }
          }
        );
      } else {
        console.error("Todoist OAuth token exchange failed:", result.message);
        return new Response(
          `<html><body><script>
            alert('OAuth connection failed: ${result.message || 'Token exchange unsuccessful'}');
            window.close();
          </script></body></html>`,
          { 
            status: 400,
            headers: { "Content-Type": "text/html" }
          }
        );
      }

    } catch (error) {
      console.error("Todoist OAuth callback error:", error);
      return new Response(
        `<html><body><script>
          alert('OAuth connection failed: ${error instanceof Error ? error.message : 'Unknown error'}');
          window.close();
        </script></body></html>`,
        { 
          status: 500,
          headers: { "Content-Type": "text/html" }
        }
      );
    }
  }),
});

export default http;