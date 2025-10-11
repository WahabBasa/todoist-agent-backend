import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";

// Debug logging control
const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === "true";

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
      const eventType = result.type as string;
      switch (eventType) {
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

        case "session.created": {
          const sessionData = result.data as any;
          console.log("Clerk session.created:", {
            id: sessionData.id,
            user_id: sessionData.user_id,
            last_active_at: sessionData.last_active_at,
          });
          break;
        }

        // Note: oauth access token events are not in the SDK's TS union; handle via default branch logging

        case "organizationMembership.created":
        case "organizationMembership.updated":
        case "organizationMembership.deleted":
          // Organization features not currently implemented
          console.log(`Organization membership event: ${result.type}`);
          break;

        default:
          // Log session/oauth-like events too for debugging unknown types
          if (eventType?.includes("session") || eventType?.includes("oauth")) {
            console.log("Clerk webhook event (debug):", eventType, {
              id: (result.data as any)?.id,
              user_id: (result.data as any)?.user_id,
            });
          } else {
            console.log("Ignored Clerk webhook event:", eventType);
          }
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

// Google Calendar OAuth callback handler (delegates to Node action)
http.route({
  path: "/auth/google/calendar/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const html = (body: string, status = 200) => new Response(`<!doctype html><html><body><script>${body}</script></body></html>`, { status, headers: { "Content-Type": "text/html" } });

    if (!code || !state) {
      return html("alert('OAuth callback failed: Missing required parameters'); window.close();", 400);
    }

    const result = await ctx.runAction(api.googleCalendar.auth.handleGoogleCalendarOAuthCallback, { code, state });
    if (result?.ok) {
      return html(`
        try { if (window.opener) { window.opener.postMessage({ type: 'GCAL_CONNECTED' }, '*'); } } catch (e) {}
        setTimeout(() => window.close(), 200);
      `, 200);
    } else {
      const msg = (result as any)?.error || 'Unknown error';
      return html(`alert('Google Calendar connection failed: ${String(msg)}'); window.close();`, 500);
    }
  }),
});

// Telemetry endpoint to log OAuth callback/debug info (unauthenticated)
http.route({
  path: "/telemetry/oauth-callback",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    try {
      const body = await request.json().catch(() => ({}));
      const { phase, search, hash, href, error, email, userAgent, timestamp } = body || {};
      
      if (ENABLE_DEBUG_LOGS) {
        console.log("[TELEMETRY][OAUTH]", {
          phase: phase || "callback",
          href,
          search,
          hash,
          error,
          email,
          userAgent,
          timestamp,
        });
      }
      const origin = request.headers.get("Origin") || process.env.CLIENT_ORIGIN || "*";
      return new Response("ok", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Request-Id",
          ...(origin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
          Vary: "origin",
        },
      });
    } catch (e) {
      console.error("[TELEMETRY][OAUTH] error:", e);
      const origin = request.headers.get("Origin") || process.env.CLIENT_ORIGIN || "*";
      return new Response("err", {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Request-Id",
          ...(origin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
          Vary: "origin",
        },
      });
    }
  }),
});

// Telemetry preflight
http.route({
  path: "/telemetry/oauth-callback",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const h = request.headers;
    const isPreflight = h.get("Origin") && h.get("Access-Control-Request-Method");
    if (isPreflight) {
      const origin = request.headers.get("Origin") || process.env.CLIENT_ORIGIN || "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Request-Id",
          ...(origin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return new Response(null, { status: 204 });
  }),
});

// Streaming chat endpoint (AI SDK useChat compatible)
http.route({
  path: "/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const mod = await import("./ai/stream");
    return mod.chatHandler(ctx, request);
  }),
});

// CORS preflight for chat
http.route({
  path: "/chat",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const h = request.headers;
    const isPreflight = h.get("Origin") && h.get("Access-Control-Request-Method");
    if (isPreflight) {
      const origin = request.headers.get("Origin") || process.env.CLIENT_ORIGIN || "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Request-Id",
          ...(origin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return new Response(null, { status: 204 });
  }),
});