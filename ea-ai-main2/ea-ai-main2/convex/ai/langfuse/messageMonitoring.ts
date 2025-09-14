import { langfuse } from "./client";
import { ConvexMessage } from "../simpleMessages";

// Interface for message data
export interface MessageData {
  role: "user" | "assistant" | "tool";
  content?: string;
  sessionId?: string;
  userId?: string;
  timestamp?: number;
}

/**
 * Track a message in the conversation
 * @param data Message data
 * @returns traceId for the message
 */
export function trackMessage(data: MessageData): string {
  try {
    const traceId = `message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a trace for the message
    const trace = langfuse.trace({
      id: traceId,
      name: `Message: ${data.role}`,
      userId: data.userId,
      sessionId: data.sessionId,
      input: {
        role: data.role,
        content: data.content,
      },
      metadata: {
        timestamp: data.timestamp || Date.now(),
      }
    });
    
    // Create a span for the message
    const span = trace.span({
      name: `Message ${data.role}`,
      input: {
        role: data.role,
        content: data.content,
      },
    });
    
    console.log(`[Langfuse] Tracking message from: ${data.role}`);
    return traceId;
  } catch (error) {
    console.error("[Langfuse] Error tracking message:", error);
    // Return a default trace ID in case of error
    return `error-trace-${Date.now()}`;
  }
}

/**
 * Track a conversation (multiple messages)
 * @param messages Array of messages
 * @param sessionId Session ID
 * @param userId User ID
 * @returns traceId for the conversation
 */
export function trackConversation(messages: ConvexMessage[], sessionId?: string, userId?: string): string {
  try {
    const traceId = `conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a trace for the conversation
    const trace = langfuse.trace({
      id: traceId,
      name: "Conversation",
      userId: userId,
      sessionId: sessionId,
      input: messages,
      metadata: {
        messageCount: messages.length,
        timestamp: Date.now(),
      }
    });
    
    console.log(`[Langfuse] Tracking conversation with ${messages.length} messages`);
    return traceId;
  } catch (error) {
    console.error("[Langfuse] Error tracking conversation:", error);
    // Return a default trace ID in case of error
    return `error-trace-${Date.now()}`;
  }
}

/**
 * Track the result of a conversation
 * @param traceId The trace ID from trackConversation
 * @param response The AI response
 * @param metadata Additional metadata
 */
export function trackConversationResult(traceId: string, response: string, metadata?: Record<string, any>): void {
  try {
    // Get the trace
    const trace = langfuse.trace({
      id: traceId,
    });
    
    // Update the trace with output and metadata
    trace.update({
      output: response,
      metadata: {
        ...metadata,
        endTime: Date.now(),
      }
    });
    
    console.log(`[Langfuse] Tracked conversation result`);
  } catch (error) {
    console.error("[Langfuse] Error tracking conversation result:", error);
  }
}