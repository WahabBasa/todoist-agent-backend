import { ModelMessage, convertToModelMessages, type UIMessage } from "ai";

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
    output: string;
  }[];
  timestamp?: number;
}

/**
 * Convert Convex messages to AI SDK ModelMessages using the recommended approach
 * Uses convertToModelMessages utility for robust and future-proof conversion
 */
export function convertConvexToModelMessages(convexMessages: ConvexMessage[]): ModelMessage[] {
  // console.log(`[SimpleMessages] Converting ${convexMessages.length} Convex messages to ModelMessages`);
  
  // First convert to UIMessage format, then use AI SDK's convertToModelMessages
  const uiMessages: UIMessage[] = [];
  
  for (let i = 0; i < convexMessages.length; i++) {
    const message = convexMessages[i];
    
    try {
      // Handle user messages
      if (message.role === "user" && message.content?.trim()) {
        uiMessages.push({
          id: `${i}`,
          role: "user",
          parts: [{
            type: "text",
            text: message.content.trim()
          }]
        });
        continue;
      }
      
      // Handle assistant messages
      if (message.role === "assistant") {
        const parts: UIMessage["parts"] = [];
        
        // Add text content if present
        if (message.content?.trim()) {
          parts.push({
            type: "text",
            text: message.content.trim()
          });
        }
        
        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            parts.push({
              type: `tool-${toolCall.name}` as `tool-${string}`,
              toolCallId: toolCall.toolCallId,
              state: "input-available",
              input: toolCall.args
            });
          }
        }
        
        if (parts.length > 0) {
          uiMessages.push({
            id: `${i}`,
            role: "assistant",
            parts
          });
        }
        continue;
      }
      
      // Handle tool results - skip separate tool messages as they should be integrated into conversation flow
      // Tool results are handled by the AI SDK's convertToModelMessages function
      if (message.role === "tool" && message.toolResults && message.toolResults.length > 0) {
        // Skip tool result messages - these will be handled by the conversion process
        console.debug(`[SimpleMessages] Skipping tool result message ${i}: will be handled by convertToModelMessages`);
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
  
  // console.log(`[SimpleMessages] Built ${uiMessages.length} UIMessages from ${convexMessages.length} Convex messages`);
  
  // Use AI SDK's convertToModelMessages for robust conversion
  const modelMessages = convertToModelMessages(uiMessages);
  
  // console.log(`[SimpleMessages] Converted to ${modelMessages.length} ModelMessages`);
  
  // Ensure we have at least one message for the AI SDK
  if (modelMessages.length === 0) {
    // console.log(`[SimpleMessages] No valid messages found, creating fallback user message`);
    return [{
      role: "user",
      content: "Please help me with my tasks."
    }];
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
  
  // console.log(`[SimpleMessages] Truncating conversation: ${messages.length} → ${maxMessages} messages`);
  
  // Simple strategy: keep recent messages
  // More sophisticated strategies can be added later if needed
  return messages.slice(-maxMessages);
}

/**\n * Clean up message content to prevent AI SDK issues\n */
export function sanitizeMessages(messages: ConvexMessage[]): ConvexMessage[] {
  return messages.map(msg => ({
    ...msg,
    content: msg.content?.trim() || undefined,
    toolCalls: msg.toolCalls?.filter(tc => tc.toolCallId && tc.name),
    toolResults: msg.toolResults?.filter(tr => tr.toolCallId && tr.output)
  })).filter(msg => 
    msg.content || 
    (msg.toolCalls && msg.toolCalls.length > 0) || 
    (msg.toolResults && msg.toolResults.length > 0)
  ).map(msg => ({
    ...msg,
    content: msg.content ? msg.content.replace(/<[^>]*>/g, '').trim() : undefined
  }));
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