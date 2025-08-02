import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Chat endpoint removed - using direct Convex actions via ConvexProviderWithClerk pattern

// Custom auth endpoints removed - now using Clerk authentication

// Get today view endpoint
http.route({
  path: "/today-view",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const todayViewText = await ctx.runQuery(api.agents.getUserTodayView);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          todayViewText: todayViewText || "Ask the AI to show your today view" 
        }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error instanceof Error ? error.message : "Failed to get today view" 
        }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response(
      JSON.stringify({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        convex_url: process.env.CONVEX_URL || "not_set"
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }),
});

// Simple test endpoint
http.route({
  path: "/test",
  method: "GET", 
  handler: httpAction(async (ctx, request) => {
    return new Response("OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;