import { z } from "zod";
import { tool } from "ai";
import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { TodoistTools } from "./tools/todoist";
import { InternalTools } from "./tools/internal";
import { UtilityTools } from "./tools/utils";
import { GoogleCalendarTools } from "./tools/googleCalendar";
import { SimpleDelegationTools } from "./tools/simpleDelegation";
import { TaskTool } from "./tools/taskTool";

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
  sessionId?: string;
  currentTimeContext?: any;
}

// Simplified tool definition that maps directly to Convex actions
export interface SimpleToolDefinition {
  id: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: any, ctx: SimpleToolContext, actionCtx: ActionCtx) => Promise<string>;
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
    async execute(args: any, ctx: SimpleToolContext, actionCtx: ActionCtx): Promise<string> {
      // Bridge to existing tool format
      const legacyContext = {
        sessionID: ctx.sessionId || "default",
        messageID: `msg-${Date.now()}`,
        callID: `call-${Date.now()}`,
        abort: new AbortController().signal,
        userId: ctx.userId,
        metadata: () => {}, // Simplified metadata - just log
        currentTimeContext: ctx.currentTimeContext
      };

      try {
        const result = await toolDef.execute(args, legacyContext, actionCtx);
        
        // Return just the output string - AI SDK will handle the rest
        return result.output || "Task completed successfully.";
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
        console.error(`[SimpleToolRegistry] Tool ${toolDef.id} failed:`, error);
        
        // Return error as string - let AI SDK handle error presentation
        return `Error: ${errorMessage}`;
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
    currentTimeContext
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
        parameters: simpleTool.inputSchema,
        execute: async (args) => {
          console.log(`[SimpleToolRegistry] Executing tool: ${simpleTool.id}`);
          
          try {
            const result = await simpleTool.execute(args, context, actionCtx);
            console.log(`[SimpleToolRegistry] Tool ${simpleTool.id} completed successfully`);
            return result;
          } catch (error) {
            console.error(`[SimpleToolRegistry] Tool ${simpleTool.id} failed:`, error);
            throw error; // Let AI SDK handle the error
          }
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
  const unavailableTools = new Set(['task']); // Disabled tools
  return !unavailableTools.has(toolName);
}

/**
 * Get tool list for UI/debugging purposes
 */
export async function getAvailableToolList(actionCtx: ActionCtx, userId: string): Promise<string[]> {
  const tools = await createSimpleToolRegistry(actionCtx, userId);
  return Object.keys(tools);
}