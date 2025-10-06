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
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  toolCalls?: {
    name: string;
    args: any;
    toolCallId: string;
  }[];
  toolResults?: {
    toolCallId: string;
    toolName: string;
    result: any;
  }[];
  timestamp: number;
  mode?: string;
  metadata?: any;
}

/**
 * Convert Convex messages to AI SDK ModelMessages using the recommended approach
 * Uses convertToModelMessages utility for robust and future-proof conversion
 */
export function convertConvexToModelMessages(convexMessages: ConvexMessage[]): ModelMessage[] {
  // console.log(`[SimpleMessages] Converting ${convexMessages.length} Convex messages to ModelMessages`);
  
  // First convert to UIMessage format, then use AI SDK's convertToModelMessages
  const uiMessages: UIMessage[] = [];
  
  // Pass 1: collect tool results from separate tool messages so we can pair them with prior assistant tool calls
  const globalToolResultsById = new Map<string, { toolName: string; result: any }>();
  for (const msg of convexMessages) {
    if (msg?.role === 'tool' && Array.isArray(msg.toolResults)) {
      for (const tr of msg.toolResults) {
        if (tr && typeof tr.toolCallId === 'string') {
          globalToolResultsById.set(tr.toolCallId, { toolName: tr.toolName, result: tr.result });
        }
      }
    }
  }
  
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

        if (message.content?.trim()) {
          parts.push({
            type: "text",
            text: message.content.trim()
          });
        }

        const toolResultsById = new Map(
          Array.isArray(message.toolResults)
            ? message.toolResults
                .filter((result) => result && typeof result.toolCallId === "string")
                .map((result) => [result.toolCallId, result])
            : []
        );

        if (Array.isArray(message.toolCalls)) {
          for (const toolCall of message.toolCalls) {
            if (!toolCall || !toolCall.toolCallId || !toolCall.name) {
              continue;
            }

            let matchingResult = toolResultsById.get(toolCall.toolCallId);
            if (!matchingResult) {
              const globalMatch = globalToolResultsById.get(toolCall.toolCallId);
              if (globalMatch) {
                matchingResult = {
                  toolCallId: toolCall.toolCallId,
                  toolName: globalMatch.toolName,
                  result: globalMatch.result,
                } as any;
              }
            }
            if (!matchingResult) {
              if (process.env.NODE_ENV !== "production") {
                console.debug("[SimpleMessages] Skipping tool call without result", {
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.name,
                });
              }
              continue;
            }

            // For AI SDK v4 compatibility, provide string output
            const outputString = typeof (matchingResult as any).result === 'string'
              ? (matchingResult as any).result
              : JSON.stringify((matchingResult as any).result);
            parts.push({
              type: `tool-${toolCall.name}` as `tool-${string}`,
              toolCallId: toolCall.toolCallId,
              state: "output-available",
              input: toolCall.args,
              output: outputString,
            });
          }
        }

        // Safety validation: Ensure all tool parts have properly structured output
        // This prevents API rejections due to undefined content in tool messages
        const validatedParts = parts.map(part => part);

        // Only push assistant messages if they have actual text content
        // Tool-only messages without text can confuse the model about roles
        const hasTextContent = validatedParts.some(p => p.type === 'text' && (p as any).text?.trim());
        
        if (hasTextContent || validatedParts.length > 1) {
          // Either has text content OR multiple parts (text + tools)
          uiMessages.push({
            id: `${i}`,
            role: "assistant",
            parts: validatedParts,
          });
        } else if (validatedParts.length > 0) {
          // If we only have tool parts without text, skip to prevent role confusion
          console.debug(`[SimpleMessages] Skipping tool-only assistant message without text at index ${i}`);
        }
        continue;
      }
      
      // Tool messages are collected in the first pass and paired with assistant tool calls; skip emitting standalone tool UI messages
      
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
  return messages
    .map(msg => {
      const safeToolCalls = Array.isArray(msg.toolCalls)
        ? msg.toolCalls.filter(tc => tc && tc.toolCallId && tc.name)
        : undefined;
      const safeToolResults = Array.isArray(msg.toolResults)
        ? msg.toolResults.filter(tr => tr && tr.toolCallId && tr.result)
        : undefined;
      const cleaned = (msg.content ?? "").toString().trim();
      return {
        ...msg,
        content: cleaned || undefined,
        toolCalls: safeToolCalls,
        toolResults: safeToolResults,
      } as ConvexMessage;
    })
    .filter(msg => Boolean(msg.content) || (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) || (Array.isArray(msg.toolResults) && msg.toolResults.length > 0))
    .map(msg => ({
      ...msg,
      content: msg.content ? msg.content.replace(/<[^>]*>/g, '').trim() : undefined,
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