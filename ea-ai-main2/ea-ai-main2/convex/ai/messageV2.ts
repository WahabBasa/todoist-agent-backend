import { UIMessage, ModelMessage, convertToModelMessages } from "ai";

// OpenCode-inspired message architecture for proper AI SDK integration
export namespace MessageV2 {
  
  // Convex message format (existing)
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
      result: any;
    }[];
    timestamp?: number;
  }

  // Tool execution states (similar to OpenCode)
  export type ToolState = 
    | { status: "pending" }
    | { status: "running"; input: any; startTime: number }
    | { status: "completed"; input: any; output: string; startTime: number; endTime: number }
    | { status: "error"; input: any; error: string; startTime: number; endTime: number };

  // Message part types (following OpenCode MessageV2 structure)
  export interface TextPart {
    type: "text";
    text: string;
  }

  export interface ToolCallPart {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    input: any;
  }

  export interface ToolResultPart {
    type: "tool-result";
    toolCallId: string;
    toolName: string;
    output: {
      type: "text";
      value: string;
    };
  }

  export interface ToolUsagePart {
    type: `tool-${string}`;
    state: "output-available" | "output-error";
    toolCallId: string;
    input: any;
    output?: string;
    errorText?: string;
  }

  export type MessagePart = TextPart | ToolCallPart | ToolResultPart | ToolUsagePart;

  // Enhanced UIMessage structure
  export interface EnhancedUIMessage extends UIMessage {
    parts: MessagePart[];
  }

  // Conversion functions following OpenCode patterns
  export class MessageConverter {
    
    /**
     * Convert Convex message format to AI SDK UIMessage format
     * This is the key transformation that enables proper AI SDK integration
     */
    static toUIMessages(convexMessages: ConvexMessage[]): UIMessage[] {
      const uiMessages: UIMessage[] = [];
      
      for (let i = 0; i < convexMessages.length; i++) {
        const message = convexMessages[i];
        
        try {
          if (message.role === "user" && message.content) {
            uiMessages.push({
              id: `user-${i}-${Date.now()}`,
              role: "user",
              parts: [{
                type: "text",
                text: message.content
              }] as UIMessage["parts"]
            });
          }
          
          else if (message.role === "assistant") {
            const parts: UIMessage["parts"] = [];
            
            // Add text content if present
            if (message.content) {
              parts.push({
                type: "text",
                text: message.content
              });
            }
            
            // Add tool calls if present
            if (message.toolCalls && message.toolCalls.length > 0) {
              for (const tc of message.toolCalls) {
                if (tc.toolCallId && tc.name) {
                  // Find corresponding tool result in subsequent messages
                  const toolResult = this.findToolResult(convexMessages, i + 1, tc.toolCallId);
                  
                  if (toolResult) {
                    // Create tool usage part with result
                    parts.push({
                      type: `tool-${tc.name}` as `tool-${string}`,
                      state: toolResult.result && !toolResult.result.toString().startsWith("Error:") 
                        ? "output-available" : "output-error",
                      toolCallId: tc.toolCallId,
                      input: tc.args || {},
                      ...(toolResult.result && !toolResult.result.toString().startsWith("Error:")
                        ? { output: this.formatToolOutput(toolResult.result) }
                        : { errorText: this.formatToolOutput(toolResult.result) })
                    });
                  } else {
                    // Tool call without result (pending state)
                    parts.push({
                      type: "tool-call",
                      toolCallId: tc.toolCallId,
                      toolName: tc.name,
                      input: tc.args || {}
                    });
                  }
                }
              }
            }
            
            if (parts.length > 0) {
              uiMessages.push({
                id: `assistant-${i}-${Date.now()}`,
                role: "assistant",
                parts
              });
            }
          }
          
          // Tool messages are handled above with assistant messages
          // This follows OpenCode's approach of grouping tool results with assistant responses
          
        } catch (error) {
          console.warn('[MessageV2] Skipping invalid message at index', i, ':', error);
          continue;
        }
      }
      
      return uiMessages;
    }

    /**
     * Convert UIMessages to ModelMessages using AI SDK's native function
     * This ensures compatibility with the AI SDK's expectations
     */
    static toModelMessages(uiMessages: UIMessage[]): ModelMessage[] {
      try {
        return convertToModelMessages(uiMessages);
      } catch (error) {
        console.error('[MessageV2] Failed to convert UIMessages to ModelMessages:', error);
        
        // Fallback: create minimal valid conversation
        const fallbackMessages: ModelMessage[] = [];
        
        // Find the last user message to preserve context
        for (let i = uiMessages.length - 1; i >= 0; i--) {
          const msg = uiMessages[i];
          if (msg.role === "user") {
            const textPart = msg.parts?.find(p => p.type === "text") as { text: string } | undefined;
            if (textPart) {
              fallbackMessages.unshift({
                role: "user",
                content: textPart.text
              });
              break;
            }
          }
        }
        
        // If no user message found, create a generic one
        if (fallbackMessages.length === 0) {
          fallbackMessages.push({
            role: "user",
            content: "Please help me with my tasks."
          });
        }
        
        return fallbackMessages;
      }
    }

    /**
     * One-step conversion from Convex to ModelMessages
     * This is the main function that should be used in the session orchestrator
     */
    static convexToModelMessages(convexMessages: ConvexMessage[]): ModelMessage[] {
      console.log(`[MessageV2] Converting ${convexMessages.length} Convex messages to ModelMessages`);
      
      const uiMessages = this.toUIMessages(convexMessages);
      const modelMessages = this.toModelMessages(uiMessages);
      
      console.log(`[MessageV2] Conversion result: ${convexMessages.length} → ${uiMessages.length} → ${modelMessages.length}`);
      
      return modelMessages;
    }

    // Helper methods
    private static findToolResult(messages: ConvexMessage[], startIndex: number, toolCallId: string): any {
      for (let i = startIndex; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === "tool" && msg.toolResults) {
          const result = msg.toolResults.find(tr => tr.toolCallId === toolCallId);
          if (result) return result;
        }
      }
      return null;
    }

    private static formatToolOutput(result: any): string {
      if (typeof result === 'string') {
        return result;
      }
      return JSON.stringify(result);
    }
  }

  // Context management for conversation optimization
  export class ContextManager {
    
    /**
     * Intelligent context truncation following OpenCode patterns
     * Preserves conversation structure while staying within token limits
     */
    static optimizeContext(messages: ConvexMessage[], maxMessages: number = 50): ConvexMessage[] {
      if (messages.length <= maxMessages) {
        return messages;
      }

      console.log(`[MessageV2] Optimizing context: ${messages.length} → ${maxMessages} messages`);
      
      // Preserve conversation structure: first few messages + recent context
      const firstMessages = messages.slice(0, 3); // Opening context
      const recentMessages = messages.slice(-(maxMessages - 3)); // Recent conversation
      
      return [...firstMessages, ...recentMessages];
    }

    /**
     * Detect conversation loops and duplicate states
     * Helps prevent infinite tool call iterations
     */
    static detectConversationLoop(messages: ConvexMessage[], windowSize: number = 6): boolean {
      if (messages.length < windowSize * 2) return false;
      
      const recentWindow = messages.slice(-windowSize);
      const previousWindow = messages.slice(-windowSize * 2, -windowSize);
      
      // Simple pattern matching - could be enhanced with semantic similarity
      const recentPattern = recentWindow.map(m => `${m.role}-${m.toolCalls?.length || 0}`).join('|');
      const previousPattern = previousWindow.map(m => `${m.role}-${m.toolCalls?.length || 0}`).join('|');
      
      const isLoop = recentPattern === previousPattern;
      if (isLoop) {
        console.warn('[MessageV2] Conversation loop detected:', recentPattern);
      }
      
      return isLoop;
    }

    /**
     * Extract conversation statistics for monitoring
     */
    static getConversationStats(messages: ConvexMessage[]) {
      const stats = {
        total: messages.length,
        userMessages: 0,
        assistantMessages: 0,
        toolMessages: 0,
        totalToolCalls: 0,
        uniqueTools: new Set<string>(),
        conversationLength: 0
      };

      for (const msg of messages) {
        switch (msg.role) {
          case "user":
            stats.userMessages++;
            if (msg.content) stats.conversationLength += msg.content.length;
            break;
          case "assistant":
            stats.assistantMessages++;
            if (msg.content) stats.conversationLength += msg.content.length;
            if (msg.toolCalls) {
              stats.totalToolCalls += msg.toolCalls.length;
              msg.toolCalls.forEach(tc => stats.uniqueTools.add(tc.name));
            }
            break;
          case "tool":
            stats.toolMessages++;
            break;
        }
      }

      return {
        ...stats,
        uniqueTools: Array.from(stats.uniqueTools),
        avgMessageLength: stats.conversationLength / stats.total || 0
      };
    }
  }

  // Error handling and recovery
  export class ErrorHandler {
    
    /**
     * Handle message conversion errors gracefully
     */
    static handleConversionError(error: Error, originalMessages: ConvexMessage[]): ModelMessage[] {
      console.error('[MessageV2] Message conversion failed:', error);
      
      // Create safe fallback conversation
      const fallbackMessages: ModelMessage[] = [];
      
      // Find the most recent user message
      for (let i = originalMessages.length - 1; i >= 0; i--) {
        const msg = originalMessages[i];
        if (msg.role === "user" && msg.content) {
          fallbackMessages.unshift({
            role: "user",
            content: msg.content
          });
          break;
        }
      }
      
      // If no user message found, create a generic prompt
      if (fallbackMessages.length === 0) {
        fallbackMessages.push({
          role: "user",
          content: "I need help organizing my tasks. Please start by checking my current Todoist workspace."
        });
      }
      
      return fallbackMessages;
    }

    /**
     * Sanitize message content to prevent AI SDK issues
     */
    static sanitizeMessages(messages: ConvexMessage[]): ConvexMessage[] {
      return messages.map(msg => ({
        ...msg,
        content: msg.content?.trim() || undefined,
        toolCalls: msg.toolCalls?.filter(tc => tc.toolCallId && tc.name) || undefined,
        toolResults: msg.toolResults?.filter(tr => tr.toolCallId) || undefined
      })).filter(msg => 
        msg.content || 
        (msg.toolCalls && msg.toolCalls.length > 0) || 
        (msg.toolResults && msg.toolResults.length > 0)
      );
    }
  }

  // Export main conversion function for easy use
  export const convertMessages = MessageConverter.convexToModelMessages;
  export const optimizeContext = ContextManager.optimizeContext;
  export const sanitizeMessages = ErrorHandler.sanitizeMessages;
}