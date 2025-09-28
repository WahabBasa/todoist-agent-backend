"use node";

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse request body
    const body = await request.json();
    const { message, modelProvider } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Message is required" 
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    try {
      // Map modelProvider to useHaiku boolean (assume 'haiku' for true, else false)
      const useHaiku = modelProvider === 'haiku';
      // Process message with AI agent (Clerk auth is handled within the action)
      const result = await ctx.runAction(api.aiActions.processMessage, {
        message,
        useHaiku,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (error) {
      console.error("Chat endpoint error:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Internal server error" 
        }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }
  }),
});

// Handle CORS preflight requests
http.route({
  path: "/chat",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

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