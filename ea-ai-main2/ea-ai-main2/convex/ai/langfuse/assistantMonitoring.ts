import { langfuse } from "./client";

// Interface for AI assistant step data
export interface AssistantStepData {
  stepName: string;
  input?: Record<string, any>;
  sessionId?: string;
  userId?: string;
  model?: string;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

// Interface for AI assistant step result data
export interface AssistantStepResultData {
  stepName: string;
  output?: any;
  sessionId?: string;
  userId?: string;
  executionTime?: number; // in milliseconds
  success?: boolean;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

/**
 * Track an AI assistant step initiation
 * @param data Assistant step data
 * @returns traceId for correlating with step result
 */
export function trackAssistantStep(data: AssistantStepData): string {
  try {
    const traceId = `assistant-step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a trace for the assistant step
    const trace = langfuse.trace({
      id: traceId,
      name: `Assistant Step: ${data.stepName}`,
      userId: data.userId,
      sessionId: data.sessionId,
      input: data.input,
      metadata: {
        stepName: data.stepName,
        model: data.model,
        tokens: data.tokens,
        timestamp: new Date().toISOString(),
      }
    });
    
    // Create a span for the assistant step
    const span = trace.span({
      name: data.stepName,
      input: data.input,
      metadata: {
        model: data.model,
        tokens: data.tokens,
      }
    });
    
    console.log(`[Langfuse] Tracking assistant step: ${data.stepName}`);
    return traceId;
  } catch (error) {
    console.error("[Langfuse] Error tracking assistant step:", error);
    // Return a default trace ID in case of error
    return `error-trace-${Date.now()}`;
  }
}

/**
 * Track an AI assistant step result
 * @param traceId The trace ID from trackAssistantStep
 * @param data Assistant step result data
 */
export function trackAssistantStepResult(traceId: string, data: AssistantStepResultData): void {
  try {
    // Get the trace
    const trace = langfuse.trace({
      id: traceId,
    });
    
    // Update the trace with output and metadata
    trace.update({
      output: data.output,
      metadata: {
        stepName: data.stepName,
        executionTime: data.executionTime,
        success: data.success,
        tokens: data.tokens,
      }
    });
    
    // End the span
    trace.span({
      name: data.stepName,
      endTime: new Date(),
      output: data.output,
      metadata: {
        executionTime: data.executionTime,
        success: data.success,
        tokens: data.tokens,
      }
    });
    
    console.log(`[Langfuse] Tracked assistant step result for: ${data.stepName}`);
  } catch (error) {
    console.error("[Langfuse] Error tracking assistant step result:", error);
  }
}

/**
 * Track AI assistant step execution with timing
 * @param data Assistant step data
 * @param executionFn Function to execute
 */
export async function trackAssistantStepExecution<T>(
  data: AssistantStepData,
  executionFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const traceId = trackAssistantStep(data);
  
  try {
    const result = await executionFn();
    const endTime = Date.now();
    
    const resultData: AssistantStepResultData = {
      stepName: data.stepName,
      output: result,
      sessionId: data.sessionId,
      userId: data.userId,
      executionTime: endTime - startTime,
      success: true,
      tokens: data.tokens,
    };
    
    trackAssistantStepResult(traceId, resultData);
    return result;
  } catch (error) {
    const endTime = Date.now();
    
    const errorData: AssistantStepResultData = {
      stepName: data.stepName,
      output: error instanceof Error ? error.message : String(error),
      sessionId: data.sessionId,
      userId: data.userId,
      executionTime: endTime - startTime,
      success: false,
      tokens: data.tokens,
    };
    
    trackAssistantStepResult(traceId, errorData);
    throw error;
  }
}