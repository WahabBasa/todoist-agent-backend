import { trace } from '@opentelemetry/api';

// Simple tracer initialization for serverless environment
let isInitialized = false;

/**
 * Initialize OpenTelemetry tracing for serverless environment
 * Uses API-only approach without NodeSDK
 */
export function initializeTracing() {
  if (isInitialized) {
    console.log('[OpenTelemetry] Tracing already initialized');
    return;
  }

  try {
    // For serverless environments, we just ensure the API is available
    // Actual tracing will be handled by the individual span creation functions
    const tracer = trace.getTracer('ea-ai-backend', '1.0.0');
    isInitialized = true;
    console.log('[OpenTelemetry] Serverless tracing initialized successfully');
    return tracer;
  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize tracing:', error);
  }
}

/**
 * Get the configured tracer instance
 * @returns The tracer instance
 */
export function getTracer() {
  return trace.getTracer('ea-ai-backend', '1.0.0');
}

/**
 * No-op shutdown for serverless environment
 */
export async function shutdownTracing() {
  console.log('[OpenTelemetry] Serverless environment - no shutdown needed');
}