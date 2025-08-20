import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// Test endpoint to verify HTTP routes are working
http.route({
  path: "/test",
  method: "GET", 
  handler: httpAction(async (ctx, request) => {
    return new Response("HTTP routes are working!", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }),
});

// Todoist OAuth callback endpoint
http.route({
  path: "/auth/todoist/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`
        <html>
          <body>
            <h1>Todoist Connection Failed</h1>
            <p>Error: ${error}</p>
            <p><a href="/">Go back to app</a></p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { "Content-Type": "text/html" }
      });
    }

    if (!code || !state) {
      return new Response(`
        <html>
          <body>
            <h1>Invalid Request</h1>
            <p>Missing authorization code or state parameter.</p>
            <p><a href="/">Go back to app</a></p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { "Content-Type": "text/html" }
      });
    }

    try {
      // Exchange code for token
      await ctx.runMutation(api.todoist.auth.exchangeCodeForToken, {
        code,
        state
      });

      return new Response(`
        <html>
          <body>
            <h1>Todoist Connected Successfully! 🎉</h1>
            <p>Your Todoist account has been linked. You can now close this window.</p>
            <script>
              setTimeout(() => {
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });

    } catch (error: any) {
      return new Response(`
        <html>
          <body>
            <h1>Connection Error</h1>
            <p>Failed to connect Todoist: ${error.message}</p>
            <p><a href="/">Go back to app</a></p>
          </body>
        </html>
      `, {
        status: 500,
        headers: { "Content-Type": "text/html" }
      });
    }
  }),
});

export default http;
