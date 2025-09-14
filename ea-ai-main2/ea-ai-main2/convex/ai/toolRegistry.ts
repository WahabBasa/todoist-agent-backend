import { z } from "zod";
import { tool } from "ai";
import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { TodoistTools } from "./tools/todoist";
import { InternalTools } from "./tools/internal";
import { UtilityTools } from "./tools/utils";
import { GoogleCalendarTools } from "./tools/googleCalendar";
import { SimpleDelegationTools } from "./tools/simpleDelegation";
import { TaskTool } from "./tools/taskTool";
import { createToolCallSpan, createToolResultSpan, endSpan } from "./tracing";

/**
 * Simplified tool registry for direct Convex + AI SDK integration
 * 
 * Key simplifications:
 * - Remove complex agent-aware filtering
 * - Direct tool → Convex action mapping
 * - No circuit breakers or complex error handling
 * - Use Convex's built-in patterns
 * - Remove processor context abstraction
 */

// Simple tool context for essential information
export interface SimpleToolContext {
  userId: string;
  sessionId?: string | Id<"chatSessions">;
  currentTimeContext?: any;
  metadata: (input: { title?: string; metadata?: any }) => void;
}

// Simplified tool definition that maps directly to Convex actions
export interface SimpleToolDefinition {
  id: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: any, ctx: SimpleToolContext, actionCtx: ActionCtx) => Promise<{
    title: string;
    metadata: any;
    output: string;
  }>;
}

// Aliases for backward compatibility with existing tools
export type ToolContext = SimpleToolContext;
export type ToolDefinition = SimpleToolDefinition;

/**
 * Convert existing tool definitions to simplified format
 * This bridges the old complex system with the new simple system
 */
function convertToSimpleTool(toolDef: any): SimpleToolDefinition {
  return {
    id: toolDef.id,
    description: toolDef.description,
    inputSchema: toolDef.inputSchema,
    async execute(args: any, ctx: SimpleToolContext, actionCtx: ActionCtx): Promise<{
      title: string;
      metadata: any;
      output: string;
    }> {
      // Bridge to existing tool format
      const legacyContext = {
        sessionId: ctx.sessionId || "default",
        messageID: `msg-${Date.now()}`,
        callID: `call-${Date.now()}`,
        abort: new AbortController().signal,
        userId: ctx.userId,
        metadata: ctx.metadata, // Use the context's metadata function
        currentTimeContext: ctx.currentTimeContext
      };

      try {
        const result = await toolDef.execute(args, legacyContext, actionCtx);
        
        // Return the full result object
        return {
          title: result.title || "Task completed",
          metadata: result.metadata || {},
          output: result.output || "Task completed successfully."
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
        console.error(`[SimpleToolRegistry] Tool ${toolDef.id} failed:`, error);
        
        // Return error in expected format
        return {
          title: "Tool Error",
          metadata: { error: errorMessage },
          output: `Error: ${errorMessage}`
        };
      }
    }
  };
}

/**
 * Create simplified tool registry with direct AI SDK integration
 * No complex filtering, no agent modes, just direct tool access
 */
export async function createSimpleToolRegistry(
  actionCtx: ActionCtx,
  userId: string,
  currentTimeContext?: any,
  sessionId?: string
): Promise<Record<string, any>> {
  
  console.log(`[SimpleToolRegistry] Creating tools for user: ${userId.substring(0, 20)}...`);
  
  const context: SimpleToolContext = {
    userId,
    sessionId,
    currentTimeContext,
    metadata: () => {} // No-op since metadata is handled by the tool registry bridge
  };

  // Collect all tools from existing modules
  const allTools = {
    ...TodoistTools,
    ...InternalTools,
    ...UtilityTools,
    ...GoogleCalendarTools,
    ...SimpleDelegationTools,
    ...TaskTool, // Now include TaskTool for agent delegation
  };

  console.log(`[SimpleToolRegistry] Including TaskTool for agent delegation`);

  const tools: Record<string, any> = {};
  
  console.log(`[SimpleToolRegistry] Converting ${Object.keys(allTools).length} tools`);
  
  // Convert each tool to simple AI SDK format
  for (const [key, toolDef] of Object.entries(allTools)) {
    try {
      const simpleTool = convertToSimpleTool(toolDef);
      
      // Create AI SDK tool with direct execution
      tools[key] = tool({
        description: simpleTool.description,
        inputSchema: simpleTool.inputSchema,
        execute: async (args: any) => {
          const startTime = Date.now();
          
          // Create OpenTelemetry span for tool call
          const toolCallSpan = createToolCallSpan({
            toolName: simpleTool.id,
            input: args,
            sessionId: context.sessionId || "default",
            userId: context.userId
          });
          
          try {
            const result = await simpleTool.execute(args, context, actionCtx);
            const executionTime = Date.now() - startTime;
            
            // Create OpenTelemetry span for successful tool result
            const toolResultSpan = createToolResultSpan({
              toolName: simpleTool.id,
              output: result,
              success: true,
              sessionId: context.sessionId || "default",
              userId: context.userId
            });
            endSpan(toolResultSpan, `TOOL RESULT (${simpleTool.id})`);
            endSpan(toolCallSpan, `TOOL CALL (${simpleTool.id})`);
            
            // Return the full result object for proper AI SDK tool tracking
            return result;
          } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Create OpenTelemetry span for failed tool result
            const errorResult = error instanceof Error ? error.message : String(error);
            const toolResultSpan = createToolResultSpan({
              toolName: simpleTool.id,
              output: errorResult,
              success: false,
              sessionId: context.sessionId || "default",
              userId: context.userId
            });
            const err = error instanceof Error ? error : new Error(errorResult);
            endSpan(toolResultSpan, `TOOL RESULT (${simpleTool.id})`, err);
            endSpan(toolCallSpan, `TOOL CALL (${simpleTool.id})`, err);
            
            throw error; // Let AI SDK handle the error
          }
        },
        // Control what the AI model sees while preserving structured tool results
        toModelOutput(result: any) {
          return {
            type: "text",
            value: result.output,
          };
        }
      });
      
    } catch (error) {
      console.warn(`[SimpleToolRegistry] Failed to convert tool ${key}:`, error);
      // Skip problematic tools instead of failing entire registry
      continue;
    }
  }

  console.log(`[SimpleToolRegistry] Successfully created ${Object.keys(tools).length} tools`);
  
  // Log available tools for debugging
  const toolNames = Object.keys(tools);
  const batchTools = toolNames.filter(name => name.includes('Batch') || name.includes('batch'));
  console.log(`[SimpleToolRegistry] Available tools: ${toolNames.join(', ')}`);
  console.log(`[SimpleToolRegistry] Batch tools: ${batchTools.join(', ') || 'NONE'}`);

  return tools;
}

/**
 * Simple tool availability check - no complex circuit breakers
 */
export function isToolAvailable(toolName: string): boolean {
  // Simple availability check - can be enhanced later if needed
  // Task tool is now enabled for agent delegation
  const unavailableTools = new Set<string>(); // No disabled tools
  return !unavailableTools.has(toolName);
}

/**
 * Get tool list for UI/debugging purposes
 */
export async function getAvailableToolList(actionCtx: ActionCtx, userId: string): Promise<string[]> {
  const tools = await createSimpleToolRegistry(actionCtx, userId);
  return Object.keys(tools);
}