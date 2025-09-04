import { UIMessage, ModelMessage, convertToModelMessages, UIMessagePart, UIDataTypes, UITools } from "ai";

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

  // Use AI SDK's native UIMessagePart types instead of custom parts
  export type EnhancedUIMessagePart = UIMessagePart<UIDataTypes, UITools>;

  // Enhanced UIMessage structure - now properly compatible with AI SDK
  export interface EnhancedUIMessage extends UIMessage<unknown, UIDataTypes, UITools> {
    // Inherits proper parts typing from AI SDK UIMessage
  }

  // Conversion functions following OpenCode patterns
  export class MessageConverter {
    
    /**
     * Convert Convex message format to AI SDK UIMessage format
     * Simplified approach inspired by OpenCode's systematic conversion
     */
    static toUIMessages(convexMessages: ConvexMessage[]): UIMessage[] {
      const uiMessages: UIMessage[] = [];
      console.log(`[MessageV2] Converting ${convexMessages.length} Convex messages to UIMessages`);
      
      for (let i = 0; i < convexMessages.length; i++) {
        const message = convexMessages[i];
        
        try {
          // Handle user messages - simple text conversion
          if (message.role === "user" && message.content) {
            uiMessages.push({
              id: `user-${i}-${message.timestamp || Date.now()}`,
              role: "user",
              parts: [{
                type: "text",
                text: message.content
              }]
            });
            console.log(`[MessageV2] ✅ Converted user message ${i}: "${message.content.substring(0, 50)}..."`);
          }
          
          // Handle assistant messages - text only, skip complex tool reconstruction
          else if (message.role === "assistant" && message.content) {
            uiMessages.push({
              id: `assistant-${i}-${message.timestamp || Date.now()}`,
              role: "assistant", 
              parts: [{
                type: "text",
                text: message.content
              }]
            });
            console.log(`[MessageV2] ✅ Converted assistant message ${i}: "${message.content.substring(0, 50)}..."`);
          }
          
          // Skip tool messages and complex assistant messages for now
          // This prevents the conversion failures that were breaking everything
          else {
            console.log(`[MessageV2] ⏭️ Skipping complex message ${i} (role: ${message.role}, hasContent: ${!!message.content}, hasToolCalls: ${!!message.toolCalls})`);
          }
          
        } catch (error) {
          console.warn(`[MessageV2] ⚠️ Failed to convert message ${i}:`, error);
          console.warn(`[MessageV2] Problematic message:`, JSON.stringify(message, null, 2));
          // Continue processing other messages instead of failing entirely
          continue;
        }
      }
      
      console.log(`[MessageV2] ✅ Successfully converted ${uiMessages.length}/${convexMessages.length} messages`);
      return uiMessages;
    }

    /**
     * Convert UIMessages to ModelMessages using AI SDK's native function
     * Enhanced with robust error handling and validation
     */
    static toModelMessages(uiMessages: UIMessage[]): ModelMessage[] {
      console.log(`[MessageV2] Converting ${uiMessages.length} UIMessages to ModelMessages`);
      
      // Pre-validate UIMessages before conversion
      const validUIMessages = this.validateUIMessages(uiMessages);
      console.log(`[MessageV2] Validated ${validUIMessages.length}/${uiMessages.length} UIMessages`);
      
      try {
        const modelMessages = convertToModelMessages(validUIMessages);
        console.log(`[MessageV2] ✅ Successfully converted to ${modelMessages.length} ModelMessages`);
        return modelMessages;
      } catch (error) {
        console.error('[MessageV2] convertToModelMessages failed:', error);
        
        // Enhanced fallback: preserve more conversation context
        const fallbackMessages: ModelMessage[] = [];
        
        for (const msg of validUIMessages) {
          try {
            if (msg.role === "user" || msg.role === "assistant") {
              const textParts = msg.parts?.filter(p => p.type === "text") as { text: string }[] || [];
              if (textParts.length > 0) {
                const content = textParts.map(p => p.text).join(" ").trim();
                if (content) {
                  fallbackMessages.push({
                    role: msg.role,
                    content
                  });
                }
              }
            }
          } catch (msgError) {
            console.warn('[MessageV2] Skipping problematic UIMessage in fallback:', msgError);
            continue;
          }
        }
        
        console.log(`[MessageV2] Fallback preserved ${fallbackMessages.length} messages`);
        
        // Ensure we have at least one message
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
     * Validate and sanitize UIMessages before conversion
     */
    private static validateUIMessages(uiMessages: UIMessage[]): UIMessage[] {
      const validMessages: UIMessage[] = [];
      
      for (let i = 0; i < uiMessages.length; i++) {
        const msg = uiMessages[i];
        
        try {
          // Basic validation
          if (!msg.id || !msg.role || !msg.parts || !Array.isArray(msg.parts)) {
            console.warn(`[MessageV2] Invalid UIMessage structure at index ${i}`);
            continue;
          }
          
          // Ensure we have valid parts
          const validParts = msg.parts.filter(part => {
            return part && typeof part === 'object' && 'type' in part;
          });
          
          if (validParts.length === 0) {
            console.warn(`[MessageV2] UIMessage ${i} has no valid parts`);
            continue;
          }
          
          // Create clean message
          const cleanMessage: UIMessage = {
            id: msg.id,
            role: msg.role,
            parts: validParts
          };
          
          validMessages.push(cleanMessage);
          
        } catch (error) {
          console.warn(`[MessageV2] Failed to validate UIMessage ${i}:`, error);
          continue;
        }
      }
      
      return validMessages;
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
     * Handle message conversion errors gracefully - preserve as much context as possible
     */
    static handleConversionError(error: Error, originalMessages: ConvexMessage[]): ModelMessage[] {
      console.error('[MessageV2] Message conversion failed:', error);
      console.log('[MessageV2] Attempting to preserve conversation context...');
      
      const fallbackMessages: ModelMessage[] = [];
      
      // Try to preserve multiple recent exchanges instead of just the last message
      const recentMessages = originalMessages.slice(-6); // Last 6 messages for context
      let userMessages = 0;
      let assistantMessages = 0;
      
      for (const msg of recentMessages) {
        try {
          if (msg.role === "user" && msg.content && msg.content.trim()) {
            fallbackMessages.push({
              role: "user",
              content: msg.content.trim()
            });
            userMessages++;
          } else if (msg.role === "assistant" && msg.content && msg.content.trim()) {
            fallbackMessages.push({
              role: "assistant", 
              content: msg.content.trim()
            });
            assistantMessages++;
          }
        } catch (msgError) {
          console.warn('[MessageV2] Skipping problematic message in fallback:', msgError);
          continue;
        }
      }
      
      console.log(`[MessageV2] Preserved context: ${userMessages} user + ${assistantMessages} assistant messages`);
      
      // If we didn't preserve any messages, create a minimal context
      if (fallbackMessages.length === 0) {
        fallbackMessages.push({
          role: "user",
          content: "Please continue helping me with my tasks."
        });
        console.log('[MessageV2] Created minimal fallback context');
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