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
import { evaluateUserResponseTool } from "./tools/evaluateUserResponseTool";
import { createToolCallSpan, createToolResultSpan } from "./langfuse/logger";
import { logStep, logModeSwitch } from "./logger";

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
  sessionId?: string | Id<"chatSessions">,
  modeName: string = "primary" // New parameter for mode-aware filtering
): Promise<Record<string, any>> {
  
  // console.log(`[SimpleToolRegistry] Creating tools for user: ${userId.substring(0, 20)}...`);
  
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
    evaluateUserResponse: evaluateUserResponseTool, // LLM decision-making tool
  };

  // console.log(`[SimpleToolRegistry] Including TaskTool for mode delegation`);

  const tools: Record<string, any> = {};
  
  // console.log(`[SimpleToolRegistry] Converting ${Object.keys(allTools).length} tools`);
  
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
          // Central guard: prevent large/raw JSON from leaking into the model context
          const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

          const redact = (key: string, value: unknown) =>
            /(token|secret|key|password|auth)/i.test(key) ? "[redacted]" : value;

          const summarizeArray = (arr: any[], maxChars: number) => {
            const n = arr.length;
            const sampleCount = Math.min(3, n);
            const pickFields = (obj: Record<string, any>) => {
              const preferred = [
                "name",
                "title",
                "content",
                "id",
                "_id",
                "projectId",
                "project",
                "due",
                "dueDate",
                "status",
                "priority",
              ];
              const out: Record<string, any> = {};
              for (const k of preferred) if (k in obj) out[k] = redact(k, obj[k]);
              if (Object.keys(out).length === 0) {
                // fallback: include first 2 keys
                for (const k of Object.keys(obj).slice(0, 2)) out[k] = redact(k, obj[k]);
              }
              return out;
            };
            const examples = arr
              .slice(0, sampleCount)
              .map((item) => {
                if (item && typeof item === "object") return pickFields(item as any);
                return item;
              });
            let text = `${n} items`;
            if (examples.length) {
              const ex = JSON.stringify(examples);
              text += `; examples: ${ex}`;
            }
            return text.length > maxChars ? text.slice(0, maxChars) + "… (truncated)" : text;
          };

          const summarizeObject = (obj: Record<string, any>, maxChars: number) => {
            const keys = Object.keys(obj);
            const parts: string[] = [];
            parts.push(`${keys.length} keys: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", …" : ""}`);
            for (const k of keys.slice(0, 6)) {
              const v = obj[k];
              if (Array.isArray(v)) {
                parts.push(`${k}: ${v.length} items`);
                // Try to include a couple representative names
                const names = v
                  .slice(0, 2)
                  .map((it) => (it && typeof it === "object" ? (it.name || it.title || it.content || it.id || it._id) : undefined))
                  .filter(Boolean);
                if (names.length) parts.push(`${k} examples: ${names.join(", ")}`);
              } else if (v && typeof v === "object") {
                const subKeys = Object.keys(v);
                parts.push(`${k}: object(${subKeys.slice(0, 3).join(", ")}${subKeys.length > 3 ? ", …" : ""})`);
              } else if (typeof v === "string") {
                const val = String(v);
                parts.push(`${k}: ${val.length > 60 ? val.slice(0, 60) + "…" : val}`);
              } else {
                try {
                  parts.push(`${k}: ${JSON.stringify(redact(k, v))}`);
                } catch {
                  parts.push(`${k}: [unavailable]`);
                }
              }
            }
            const text = parts.join("; ");
            return text.length > maxChars ? text.slice(0, maxChars) + "… (truncated)" : text;
          };

          const MAX = 800;
          let raw = (result?.output ?? "Operation completed");
          if (typeof raw !== "string") {
            try {
              raw = JSON.stringify(raw);
            } catch {
              raw = String(raw);
            }
          }
          raw = stripTags(raw).trim();

          // Try JSON-aware summarization
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return summarizeArray(parsed, MAX);
            if (parsed && typeof parsed === "object") return summarizeObject(parsed as Record<string, any>, MAX);
          } catch {
            // Not JSON, fall through
          }

          // Non-JSON string: length-guard
          return raw.length > MAX ? raw.slice(0, MAX) + "… (truncated)" : raw;
        }
      });
      
    } catch (error) {
      console.warn(`[SimpleToolRegistry] Failed to convert tool ${key}:`, error);
      // Skip problematic tools instead of failing entire registry
      continue;
    }
  }

  // Log available tools for debugging
  const toolNames = Object.keys(tools);
  const batchTools = toolNames.filter(name => name.includes('Batch') || name.includes('batch'));
  
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(`[TOOL_LIST] Available tools: ${toolNames.join(', ')}`);
    console.log(`[TOOL_LIST] Batch tools: ${batchTools.join(', ') || 'NONE'}`);
  } else {
    logStep('Tool Registry Loaded', `${toolNames.length} tools (${batchTools.length} batch)`);
  }

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
  sessionId?: string | Id<"chatSessions">
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
    
    let formattedTodos = '';
    if (sessionId) {
      try {
        const todoResult = await actionCtx.runQuery(api.aiInternalTodos.getInternalTodos, { sessionId: typeof sessionId === 'string' ? sessionId as Id<"chatSessions"> : sessionId });
        if (todoResult && todoResult.todos && todoResult.todos.length > 0) {
          formattedTodos = todoResult.todos.map((t: any) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.content}`).join('\n');
        }
      } catch (err) {
        console.warn(`[MODE_TOOLS] Failed to fetch todos:`, err);
      }
    }
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[MODE_TOOLS] Filtered tools for mode ${modeName}: ${Object.keys(filteredTools).length}/${Object.keys(allTools).length}`);
      console.log(`[MODE_TOOLS] Available tools in ${modeName}: ${Object.keys(filteredTools).join(', ')}`);
    } else {
      logModeSwitch("unknown", modeName, "tool registry loaded", sessionId?.toString());
    }
    
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
  sessionId?: string | Id<"chatSessions">
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