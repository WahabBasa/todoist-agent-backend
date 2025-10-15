import { Langfuse } from "langfuse";

/**
 * Langfuse Cloud Client for TaskAI
 * Provides comprehensive AI workflow tracing and analytics
 */

let langfuseClient: Langfuse | null = null;

/**
 * Initialize Langfuse client with environment variables
 */
export function initializeLangfuse(): Langfuse {
  if (langfuseClient) {
    return langfuseClient;
  }

  try {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });

    // console.log("✅ Langfuse Cloud client initialized successfully");
    return langfuseClient;
  } catch (error) {
    console.error("❌ Failed to initialize Langfuse client:", error);
    throw error;
  }
}

/**
 * Get the current Langfuse client instance
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    return initializeLangfuse();
  }
  return langfuseClient;
}

/**
 * Test connection to Langfuse Cloud
 */
export async function testLangfuseConnection(): Promise<boolean> {
  try {
    const client = getLangfuseClient();
    
    // Create a test trace to verify connectivity
    client.trace({
      name: "connection-test",
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });

    await client.flushAsync();
    console.log("✅ Langfuse Cloud connection test successful");
    return true;
  } catch (error) {
    console.error("❌ Langfuse Cloud connection test failed:", error);
    return false;
  }
}