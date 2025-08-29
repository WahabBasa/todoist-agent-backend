import { z } from "zod";
import { tool } from "ai";
import { ActionCtx } from "../_generated/server";
import { TodoistTools } from "./tools/todoist";
import { InternalTools } from "./tools/internal";
import { UtilityTools } from "./tools/utils";

// OpenCode-inspired tool definition interface
export interface ToolContext {
  sessionID: string;
  messageID: string;
  callID: string;
  abort: AbortSignal;
  userId: string;
  metadata: (input: { title?: string; metadata?: any }) => void;
}

export interface ToolDefinition {
  id: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: any, ctx: ToolContext, actionCtx: ActionCtx) => Promise<{
    title: string;
    metadata: any;
    output: string;
  }>;
}

// Circuit breaker for tool failures (similar to OpenCode)
class CircuitBreaker {
  private failures = new Map<string, { count: number; lastFailure: number }>();
  private readonly MAX_FAILURES = 3;
  private readonly RESET_TIME = 5 * 60 * 1000; // 5 minutes

  canExecute(toolName: string): boolean {
    const failure = this.failures.get(toolName);
    if (!failure) return true;
    
    // Reset if enough time has passed
    if (Date.now() - failure.lastFailure > this.RESET_TIME) {
      this.failures.delete(toolName);
      return true;
    }
    
    return failure.count < this.MAX_FAILURES;
  }

  recordFailure(toolName: string): void {
    const failure = this.failures.get(toolName) || { count: 0, lastFailure: 0 };
    failure.count++;
    failure.lastFailure = Date.now();
    this.failures.set(toolName, failure);
  }

  recordSuccess(toolName: string): void {
    this.failures.delete(toolName);
  }
}

const circuitBreaker = new CircuitBreaker();

// Consolidated tool registry using modular tools
export const ToolRegistry = {
  // Todoist task management tools
  ...TodoistTools,
  
  // Internal AI workflow coordination tools
  ...InternalTools,
  
  // Utility tools (time, validation, system status)
  ...UtilityTools,
};

// Provider-specific adaptations (similar to OpenCode)
export class ToolRegistryManager {
  static async getTools(providerID: string = "anthropic", modelID: string = "claude-3-5-haiku-20241022") {
    const tools: Record<string, any> = {};
    
    for (const [key, toolDef] of Object.entries(ToolRegistry)) {
      tools[key] = tool({
        id: toolDef.id as any,
        description: toolDef.description,
        inputSchema: toolDef.inputSchema as any,
        async execute(args, options) {
          // Circuit breaker check
          if (!circuitBreaker.canExecute(toolDef.id)) {
            console.warn(`[ToolRegistry] Circuit breaker active for tool: ${toolDef.id}`);
            throw new Error(`Tool ${toolDef.id} temporarily unavailable due to repeated failures. Please try again later.`);
          }

          const context: ToolContext = {
            sessionID: (options as any).sessionID || "default",
            messageID: (options as any).messageID || "default", 
            callID: options.toolCallId,
            abort: options.abortSignal!,
            userId: (options as any).userId || "unknown",
            metadata: (val) => {
              // Metadata callback for real-time updates
              if ((options as any).onMetadata) {
                (options as any).onMetadata(val);
              }
            }
          };

          // Add current time context if available
          if ((options as any).currentTimeContext) {
            (context as any).currentTimeContext = (options as any).currentTimeContext;
          }

          try {
            const result = await toolDef.execute(args, context, (options as any).actionCtx);
            
            // Record success for circuit breaker
            circuitBreaker.recordSuccess(toolDef.id);
            
            return {
              output: result.output,
              metadata: result.metadata,
              title: result.title
            };
          } catch (error) {
            // Record failure for circuit breaker
            circuitBreaker.recordFailure(toolDef.id);
            throw error;
          }
        }
      });
    }

    // Provider-specific adaptations
    if (providerID === "openai" || providerID === "azure") {
      // Convert optional to nullable for OpenAI compatibility
      return this.optionalToNullable(tools);
    }

    if (providerID === "google") {
      // Sanitize parameters for Gemini compatibility  
      return this.sanitizeGeminiParameters(tools);
    }

    return tools;
  }

  private static optionalToNullable(tools: Record<string, any>): Record<string, any> {
    // Implementation similar to OpenCode's optionalToNullable
    return tools; // Simplified for now - would implement full conversion
  }

  private static sanitizeGeminiParameters(tools: Record<string, any>): Record<string, any> {
    // Implementation similar to OpenCode's sanitizeGeminiParameters  
    return tools; // Simplified for now - would implement full sanitization
  }

  // Get enabled tools based on provider/model restrictions (OpenCode pattern)
  static async getEnabledTools(providerID: string, modelID: string): Promise<Record<string, boolean>> {
    const enabled: Record<string, boolean> = {};
    
    // Model-specific restrictions
    if (modelID.toLowerCase().includes("qwen")) {
      enabled["internalTodoWrite"] = false;
      enabled["internalTodoRead"] = false;
    }
    
    // Provider-specific restrictions could be added here
    
    return enabled;
  }
}