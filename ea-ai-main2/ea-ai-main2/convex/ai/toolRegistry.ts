import { z } from "zod";
import { tool } from "ai";
import { ActionCtx } from "../_generated/server";
import { TodoistTools } from "./tools/todoist";
import { InternalTools } from "./tools/internal";
import { UtilityTools } from "./tools/utils";
import { GoogleCalendarTools } from "./tools/googleCalendar";
import { ProcessorContext } from "./processor";

// OpenCode-inspired tool definition interface
export interface ToolContext {
  sessionID: string;
  messageID: string;
  callID: string;
  abort: AbortSignal;
  userId: string;
  metadata: (input: { title?: string; metadata?: any }) => void;
}

// Tool definition interface - ActionCtx is guaranteed to be available
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

// ProcessorContext is imported from processor.ts (shared interface)

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
  
  // Google Calendar integration tools
  ...GoogleCalendarTools,
};

// Convex-recommended tool creation pattern (fixes ActionCtx context loss)
export class ToolRegistryManager {
  /**
   * Creates tools with ActionCtx captured in closure (Convex best practice)
   * This ensures ActionCtx is always available and prevents context loss issues
   */
  static async getTools(
    actionCtx: ActionCtx,
    processorContext: Omit<ProcessorContext, 'actionCtx'>,
    providerID: string = "anthropic", 
    modelID: string = "claude-3-5-haiku-20241022"
  ) {
    const tools: Record<string, any> = {};
    
    // Debug: Log available tools from registry
    const registryKeys = Object.keys(ToolRegistry);
    console.log(`[ToolRegistry] Loading ${registryKeys.length} tools:`, registryKeys.join(', '));
    
    // Debug: Check for batch tools specifically
    const batchTools = registryKeys.filter(key => key.includes('Batch') || key.includes('batch'));
    console.log(`[ToolRegistry] Batch tools found:`, batchTools.join(', ') || 'NONE');
    
    for (const [key, toolDef] of Object.entries(ToolRegistry)) {
      // Capture ActionCtx in closure - Convex recommended pattern
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

          // Build ToolContext with processor context
          const context: ToolContext = {
            sessionID: processorContext.sessionID,
            messageID: processorContext.messageID,
            callID: options.toolCallId,
            abort: options.abortSignal!,
            userId: processorContext.userId,
            metadata: (val) => {
              // Metadata callback for real-time updates
              console.log(`[ToolRegistry] Tool ${toolDef.id} metadata:`, val);
            }
          };

          // Add current time context if available
          if (processorContext.currentTimeContext) {
            (context as any).currentTimeContext = processorContext.currentTimeContext;
          }

          try {
            // ActionCtx is captured in closure - guaranteed to be available
            const result = await toolDef.execute(args, context, actionCtx);
            
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
            console.error(`[ToolRegistry] Tool ${toolDef.id} execution failed:`, error);
            throw error;
          }
        }
      });
    }

    console.log(`[ToolRegistry] ✅ Created ${Object.keys(tools).length} tools with ActionCtx bound`);

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

  // Legacy method for backward compatibility - now requires ActionCtx
  static async getLegacyTools(providerID: string = "anthropic", modelID: string = "claude-3-5-haiku-20241022") {
    throw new Error(
      `Legacy getTools() method is deprecated. Use getTools(actionCtx, processorContext, providerID, modelID) instead. ` +
      `This ensures ActionCtx is properly bound to tools and prevents context loss issues.`
    );
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