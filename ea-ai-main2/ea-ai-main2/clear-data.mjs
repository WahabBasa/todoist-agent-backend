import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

console.log("Clearing all conversations data...");

// This is just a helper script - actual clearing should be done via dashboard
// since we need admin access to delete all records
console.log("Please clear the conversations table via the Convex dashboard at:");
console.log("https://dashboard.convex.dev");
console.log("Delete all records in the conversations table to resolve schema conflicts");