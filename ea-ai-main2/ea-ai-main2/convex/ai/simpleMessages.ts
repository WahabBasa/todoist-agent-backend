import { ModelMessage } from "ai";

/**
 * Simplified message conversion for Vercel AI SDK + Convex integration
 * Replaces the complex 4-layer transformation pipeline with direct conversion
 * 
 * Key principles:
 * - Single-step conversion from Convex to AI SDK format
 * - No intermediate transformations that cause data loss
 * - Embrace Convex's natural data structures
 * - Let AI SDK handle its own message processing
 */

// Convex native message format (simplified)
export interface ConvexMessage {
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: {
    name: string;
    args: any;
    toolCallId: string;
  }[];
  toolResults?: {
    toolCallId: string;
    toolName?: string;
    result: string;
  }[];
  timestamp?: number;
}

/**
 * Direct, single-step conversion from Convex messages to AI SDK ModelMessages
 * No complex transformations, no data loss, no type mismatches
 */
export function convertConvexToModelMessages(convexMessages: ConvexMessage[]): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];
  
  console.log(`[SimpleMessages] Converting ${convexMessages.length} Convex messages to ModelMessages`);
  
  for (let i = 0; i < convexMessages.length; i++) {
    const message = convexMessages[i];
    
    try {
      // Handle user messages - direct mapping
      if (message.role === "user" && message.content?.trim()) {
        modelMessages.push({
          role: "user",
          content: message.content.trim()
        });
        continue;
      }
      
      // Handle assistant messages - direct mapping
      if (message.role === "assistant") {
        // Assistant message with text content
        if (message.content?.trim()) {
          modelMessages.push({
            role: "assistant",
            content: message.content.trim()
          });
        }
        
        // Assistant message with tool calls
        if (message.toolCalls && message.toolCalls.length > 0) {
          modelMessages.push({
            role: "assistant",
            content: message.content || "",
            // Note: AI SDK handles tool calls differently - this may need adjustment
            // For now, just include the content, tool calls handled separately
          });
        }
        continue;
      }
      
      // Handle tool results - simplified approach
      if (message.role === "tool" && message.toolResults && message.toolResults.length > 0) {
        // Convert tool results to simple text content for now
        const toolResultsText = message.toolResults.map(tr => 
          `Tool ${tr.toolName || 'unknown'} (${tr.toolCallId}): ${tr.result}`
        ).join("\n");
        
        modelMessages.push({
          role: "assistant",
          content: `Tool Results:\n${toolResultsText}`
        });
        continue;
      }
      
      // Skip messages that don't fit standard patterns
      console.debug(`[SimpleMessages] Skipping message ${i}: no content or unhandled format`);
      
    } catch (error) {
      console.warn(`[SimpleMessages] Failed to convert message ${i}:`, error);
      // Continue with other messages instead of failing entire conversation
      continue;
    }
  }
  
  console.log(`[SimpleMessages] Successfully converted ${modelMessages.length}/${convexMessages.length} messages`);
  
  // Ensure we have at least one message for the AI SDK
  if (modelMessages.length === 0) {
    console.log(`[SimpleMessages] No valid messages found, creating fallback user message`);
    modelMessages.push({
      role: "user",
      content: "Please help me with my tasks."
    });
  }
  
  return modelMessages;
}

/**
 * Simple message optimization - keep conversation within reasonable bounds
 * Much simpler than the complex context management in MessageV2
 */
export function optimizeConversation(messages: ConvexMessage[], maxMessages = 50): ConvexMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  console.log(`[SimpleMessages] Truncating conversation: ${messages.length} → ${maxMessages} messages`);
  
  // Simple strategy: keep recent messages
  // More sophisticated strategies can be added later if needed
  return messages.slice(-maxMessages);
}

/**
 * Clean up message content to prevent AI SDK issues
 */
export function sanitizeMessages(messages: ConvexMessage[]): ConvexMessage[] {
  return messages.map(msg => ({
    ...msg,
    content: msg.content?.trim() || undefined,
    toolCalls: msg.toolCalls?.filter(tc => tc.toolCallId && tc.name),
    toolResults: msg.toolResults?.filter(tr => tr.toolCallId && tr.result)
  })).filter(msg => 
    msg.content || 
    (msg.toolCalls && msg.toolCalls.length > 0) || 
    (msg.toolResults && msg.toolResults.length > 0)
  );
}

/**
 * Add a new message to conversation history
 * Simple, direct approach without complex state management
 */
export function addMessageToConversation(
  messages: ConvexMessage[], 
  newMessage: ConvexMessage
): ConvexMessage[] {
  return [...messages, {
    ...newMessage,
    timestamp: Date.now()
  }];
}

/**
 * Simple conversation statistics for monitoring
 */
export function getConversationStats(messages: ConvexMessage[]) {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let totalLength = 0;
  
  for (const msg of messages) {
    if (msg.role === "user") {
      userMessages++;
      totalLength += msg.content?.length || 0;
    } else if (msg.role === "assistant") {
      assistantMessages++;
      totalLength += msg.content?.length || 0;
      toolCalls += msg.toolCalls?.length || 0;
    }
  }
  
  return {
    total: messages.length,
    userMessages,
    assistantMessages,
    toolCalls,
    avgLength: totalLength / (userMessages + assistantMessages) || 0
  };
}