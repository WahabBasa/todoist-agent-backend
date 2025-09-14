import { Langfuse } from "langfuse";

// Initialize Langfuse client
// In a production environment, these values should be stored in environment variables
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || "pk-lf-1234567890";
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || "sk-lf-1234567890";
const LANGFUSE_HOST = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";

// Create a singleton instance of the Langfuse client
export const langfuse = new Langfuse({
  publicKey: LANGFUSE_PUBLIC_KEY,
  secretKey: LANGFUSE_SECRET_KEY,
  baseUrl: LANGFUSE_HOST,
  flushAt: 1, // Flush events immediately in development
});

// Initialize Langfuse with basic configuration
export function initializeLangfuse(): void {
  console.log("[Langfuse] Initializing Langfuse client");
  
  // Set a session ID for tracking
  langfuse.trace({
    id: "todoist-agent-session",
    name: "Todoist Agent Backend Session",
  });
  
  console.log("[Langfuse] Langfuse client initialized");
}

// Flush and close Langfuse client
export async function shutdownLangfuse(): Promise<void> {
  console.log("[Langfuse] Shutting down Langfuse client");
  await langfuse.flushAsync();
  console.log("[Langfuse] Langfuse client shutdown complete");
}