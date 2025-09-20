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
import { createToolCallSpan, createToolResultSpan } from "./langfuse/logger";

// Import mode registry
import { ModeRegistry } from "./modes/registry";

/**
 * Simplified tool registry for direct Convex + AI SDK integration
 * 
 * Key simplifications:
 * - Remove complex agent-aware filtering
 * - Direct tool → Convex action mapping
 * - No circuit breakers or complex error handling
 * - Use Convex's built-in patterns
 * - Remove processor context abstraction
 * - Use mode-based filtering instead of agent-based filtering
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
  sessionId?: string,
  modeName: string = "primary" // New parameter for mode-aware filtering
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
    ...TaskTool, // Now include TaskTool for mode delegation
  };

  console.log(`[SimpleToolRegistry] Including TaskTool for mode delegation`);

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
            
            // Return the full result object for proper AI SDK tool tracking
            return result;
          } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Create tool result span for failed execution
            const toolResultSpan = createToolResultSpan({
              toolName: simpleTool.id,
              output: errorMessage,
              success: false,
              sessionId: context.sessionId || "default",
              userId: context.userId
            });
            
            throw error; // Let AI SDK handle the error
          }
        },
        // Control what the AI model sees while preserving structured tool results
        toModelOutput(result: any) {
          // For the primary mode, keep responses extremely concise
          // Only return the output, not the title or metadata
          // Remove any XML tags from the output to prevent them from being returned to the user
          let output = result.output || "Operation completed";
          output = output.replace(/<[^>]*>/g, '').trim();
          
          return {
            type: "text",
            value: output,
          };
        }
      });
      
    } catch (error) {
      console.warn(`[SimpleToolRegistry] Failed to convert tool ${key}:`, error);
      // Skip problematic tools instead of failing entire registry
      continue;
    }
  }

  console.log(`[TOOL_REGISTRY] Successfully created ${Object.keys(tools).length} tools`);
  
  // Log available tools for debugging
  const toolNames = Object.keys(tools);
  const batchTools = toolNames.filter(name => name.includes('Batch') || name.includes('batch'));
  console.log(`[TOOL_LIST] Available tools: ${toolNames.join(', ')}`);
  console.log(`[TOOL_LIST] Batch tools: ${batchTools.join(', ') || 'NONE'}`);

  return tools;
}

/**
 * Create tool registry filtered for a specific mode
 * Only provides tools that the mode has permission to use
 */
export async function createModeToolRegistry(
  actionCtx: ActionCtx,
  userId: string,
  modeName: string = "primary",
  currentTimeContext?: any,
  sessionId?: string
): Promise<Record<string, any>> {
  try {
    // Create the full tool registry
    const allTools = await createSimpleToolRegistry(actionCtx, userId, currentTimeContext, sessionId, modeName);
    
    // Get mode configuration
    const modeConfig = ModeRegistry.getMode(modeName);
    if (!modeConfig) {
      console.error(`[ModeToolRegistry] Mode ${modeName} not found, using all tools`);
      return allTools; // Fallback to all tools if mode not found
    }
    
    // Get mode's tool permissions
    const modeTools = ModeRegistry.getModeTools(modeName);
    
    // Filter tools based on mode permissions
    const filteredTools: Record<string, any> = {};
    
    for (const [toolName, tool] of Object.entries(allTools)) {
      // Special case: submodes should not have access to task tool to prevent recursion
      if (toolName === "task" && modeConfig.type !== "primary") {
        continue; // Skip task tool for submodes
      }
      
      // Check if mode has permission for this tool
      if (modeTools[toolName] === true) {
        filteredTools[toolName] = tool;
      }
    }
    
    console.log(`[MODE_TOOLS] Filtered tools for mode ${modeName}: ${Object.keys(filteredTools).length}/${Object.keys(allTools).length}`);
    
    return filteredTools;
  } catch (error) {
    console.error(`[ModeToolRegistry] Failed to create filtered tool registry:`, error);
    // Return all tools as fallback
    return await createSimpleToolRegistry(actionCtx, userId, currentTimeContext, sessionId, modeName);
  }
}

/**
 * Create tool registry filtered for the primary mode
 * Only provides tools that the primary mode has permission to use
 */
export async function createPrimaryModeToolRegistry(
  actionCtx: ActionCtx,
  userId: string,
  currentTimeContext?: any,
  sessionId?: string
): Promise<Record<string, any>> {
  return await createModeToolRegistry(actionCtx, userId, "primary", currentTimeContext, sessionId);
}

/**
 * Simple tool availability check - no complex circuit breakers
 */
export function isToolAvailable(toolName: string): boolean {
  // Simple availability check - can be enhanced later if needed
  // Task tool is now enabled for mode delegation
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