// Quick debug script to test Google OAuth account structure
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://peaceful-boar-923.convex.cloud");

// This won't work without authentication, but it shows the approach
console.log("To debug the Google OAuth account structure:");
console.log("1. First, sign in with Google OAuth in the app");
console.log("2. Then call api.googleCalendar.auth.debugGoogleAuthAccount in the browser console");
console.log("3. Or run api.googleCalendar.auth.syncGoogleCalendarTokens to see detailed logs");

console.log("\nTo run in browser console after signing in:");
console.log(`
// Get the Convex client from the React app context
const result = await convex.action("googleCalendar/auth:debugGoogleAuthAccount", {});
console.log("Debug result:", result);
`);