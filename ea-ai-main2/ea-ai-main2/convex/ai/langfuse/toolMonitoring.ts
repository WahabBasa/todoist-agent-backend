import { langfuse } from "./client";

// Interface for tool call data
export interface ToolCallData {
  toolName: string;
  input: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

// Interface for tool result data
export interface ToolResultData {
  toolName: string;
  output: any;
  sessionId?: string;
  userId?: string;
  executionTime?: number; // in milliseconds
  success?: boolean;
}

/**
 * Track a tool call initiation
 * @param data Tool call data
 * @returns traceId for correlating with tool result
 */
export function trackToolCall(data: ToolCallData): string {
  try {
    const traceId = `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a trace for the tool call
    const trace = langfuse.trace({
      id: traceId,
      name: `Tool Call: ${data.toolName}`,
      userId: data.userId,
      sessionId: data.sessionId,
      input: data.input,
      metadata: {
        toolName: data.toolName,
        timestamp: new Date().toISOString(),
      }
    });
    
    // Create a span for the tool call
    const span = trace.span({
      name: data.toolName,
      input: data.input,
    });
    
    console.log(`[Langfuse] Tracking tool call: ${data.toolName}`);
    return traceId;
  } catch (error) {
    console.error("[Langfuse] Error tracking tool call:", error);
    // Return a default trace ID in case of error
    return `error-trace-${Date.now()}`;
  }
}

/**
 * Track a tool call result
 * @param traceId The trace ID from trackToolCall
 * @param data Tool result data
 */
export function trackToolResult(traceId: string, data: ToolResultData): void {
  try {
    // Get the trace
    const trace = langfuse.trace({
      id: traceId,
    });
    
    // Update the trace with output and metadata
    trace.update({
      output: data.output,
      metadata: {
        toolName: data.toolName,
        executionTime: data.executionTime,
        success: data.success,
      }
    });
    
    // End the span
    trace.span({
      name: data.toolName,
      endTime: new Date(),
      output: data.output,
      metadata: {
        executionTime: data.executionTime,
        success: data.success,
      }
    });
    
    console.log(`[Langfuse] Tracked tool result for: ${data.toolName}`);
  } catch (error) {
    console.error("[Langfuse] Error tracking tool result:", error);
  }
}

/**
 * Track tool execution with timing
 * @param data Tool call data
 * @param executionFn Function to execute
 */
export async function trackToolExecution<T>(
  data: ToolCallData,
  executionFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const traceId = trackToolCall(data);
  
  try {
    const result = await executionFn();
    const endTime = Date.now();
    
    const resultData: ToolResultData = {
      toolName: data.toolName,
      output: result,
      sessionId: data.sessionId,
      userId: data.userId,
      executionTime: endTime - startTime,
      success: true,
    };
    
    trackToolResult(traceId, resultData);
    return result;
  } catch (error) {
    const endTime = Date.now();
    
    const errorData: ToolResultData = {
      toolName: data.toolName,
      output: error instanceof Error ? error.message : String(error),
      sessionId: data.sessionId,
      userId: data.userId,
      executionTime: endTime - startTime,
      success: false,
    };
    
    trackToolResult(traceId, errorData);
    throw error;
  }
}