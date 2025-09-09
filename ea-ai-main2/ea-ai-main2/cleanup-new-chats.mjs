#!/usr/bin/env node

/**
 * Cleanup script to remove today's "New Chat" sessions
 * This preserves default sessions and only removes empty duplicate sessions created today
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

// Get the deployment URL from environment or use production URL
const deploymentUrl = process.env.CONVEX_URL || "https://peaceful-boar-923.convex.cloud";

async function cleanupTodaysNewChats() {
  const convex = new ConvexHttpClient(deploymentUrl);

  console.log("🧹 Starting cleanup of today's 'New Chat' sessions...");
  console.log(`📡 Connected to: ${deploymentUrl}`);
  
  try {
    // Run the cleanup mutation
    const result = await convex.mutation(api.chatSessions.cleanupTodaysNewChats, {});
    
    console.log(`✅ Successfully cleaned up ${result.deletedSessions} "New Chat" sessions from today`);
    
    if (result.deletedSessions === 0) {
      console.log("ℹ️  No 'New Chat' sessions found from today to clean up");
    }
    
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }

  console.log("🎉 Cleanup completed!");
  process.exit(0);
}

// Run the cleanup
cleanupTodaysNewChats();