import { ActionCtx } from "../_generated/server";
import { 
  PureToolRegistry, 
  executePureTool, 
  PureToolContext, 
  ToolResult 
} from "./tools/pureTools";
import { 
  StateOrchestrator, 
  createOrchestratorContext, 
  OrchestrationResult 
} from "./stateOrchestrator";

// =================================================================
// CLEAN TOOL INTEGRATION - No (as any) Workarounds
// Type-safe integration between AI SDK tools and Convex operations
// Eliminates circular dependencies through proper architecture
// =================================================================

/**
 * Tool execution context for AI SDK integration
 */
export interface AIToolContext {
  sessionID: string;
  messageID: string;  
  callID: string;
  userId: string;
  streamId: string;
  abort: AbortSignal;
  actionCtx: ActionCtx;
}

/**
 * Clean tool result for AI SDK
 * No type casting, no workarounds, proper interfaces
 */
export interface CleanToolResult {
  success: boolean;
  output: string; // AI SDK expects string output
  title: string;
  metadata: any;
  events: string[]; // Published event IDs
  executionSummary?: {
    toolsExecuted: number;
    operationsCompleted: number;
    totalTime: number;
  };
}

/**
 * Execute a pure tool with full orchestration
 * This replaces the old ToolDefinition.execute pattern
 * No (as any) casts, no circular dependencies, type-safe
 */
export async function executeCleanTool(
  toolId: string,
  args: any,
  ctx: AIToolContext
): Promise<CleanToolResult> {
  try {
    // Create pure tool context (no ActionCtx, no database access)
    const pureContext: PureToolContext = {
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      callID: ctx.callID,
      userId: ctx.userId,
      abort: ctx.abort,
    };

    // Execute pure tool (no side effects)
    const toolResult: ToolResult = await executePureTool(toolId, args, pureContext);

    if (!toolResult.success) {
      return {
        success: false,
        output: toolResult.error || `Tool execution failed: ${toolId}`,
        title: "Tool Error",
        metadata: { toolId, error: true },
        events: [],
      };
    }

    // Create orchestrator context
    const orchestratorCtx = createOrchestratorContext(
      ctx.actionCtx,
      ctx.streamId,
      ctx.sessionID,
      ctx.userId,
      ctx.messageID
    );

    // Execute side effects through orchestrator
    const orchestrationResult: OrchestrationResult = await new StateOrchestrator(orchestratorCtx)
      .orchestrate([toolResult]);

    if (!orchestrationResult.success) {
      return {
        success: false,
        output: orchestrationResult.error || "Orchestration failed",
        title: "Orchestration Error",
        metadata: { toolId, orchestrationFailed: true },
        events: orchestrationResult.events,
      };
    }

    // Build clean result from orchestrated data
    const output = buildToolOutput(toolResult, orchestrationResult);
    
    return {
      success: true,
      output,
      title: toolResult.metadata?.title || "Tool Executed",
      metadata: {
        ...toolResult.metadata,
        toolId,
        orchestration: {
          sideEffectsExecuted: orchestrationResult.executionSummary.totalSideEffects,
          successfulOperations: orchestrationResult.executionSummary.successfulSideEffects,
          totalTime: orchestrationResult.executionSummary.totalExecutionTime,
        },
      },
      events: orchestrationResult.events,
      executionSummary: {
        toolsExecuted: 1,
        operationsCompleted: orchestrationResult.executionSummary.successfulSideEffects,
        totalTime: orchestrationResult.executionSummary.totalExecutionTime,
      },
    };

  } catch (error) {
    console.error(`[CLEAN-TOOLS] Execution failed for ${toolId}:`, error);
    
    return {
      success: false,
      output: error instanceof Error ? error.message : `Unknown error in tool: ${toolId}`,
      title: "Tool Execution Error",
      metadata: { toolId, error: true },
      events: [],
    };
  }
}

/**
 * Build human-readable output from tool result and orchestration
 */
function buildToolOutput(toolResult: ToolResult, orchestrationResult: OrchestrationResult): string {
  const parts: string[] = [];

  // Add main tool result
  if (toolResult.metadata?.description) {
    parts.push(toolResult.metadata.description);
  }

  // Add operation results
  if (orchestrationResult.sideEffectResults.length > 0) {
    const successful = orchestrationResult.sideEffectResults.filter(r => r.success).length;
    const total = orchestrationResult.sideEffectResults.length;
    
    if (successful === total) {
      parts.push(`✅ All ${total} operations completed successfully.`);
    } else {
      parts.push(`⚠️ ${successful}/${total} operations completed successfully.`);
    }
  }

  // Add specific data if available
  if (orchestrationResult.finalData) {
    const summary = orchestrationResult.finalData.summary;
    if (summary?.overallSuccess) {
      parts.push("All system operations completed.");
    }
  }

  return parts.join("\n\n") || "Tool executed successfully.";
}

/**
 * Create AI SDK tool definition from pure tool
 * This replaces the old ToolDefinition pattern with clean, type-safe code
 */
export function createAISDKTool(toolId: string) {
  const pureTool = PureToolRegistry[toolId];
  if (!pureTool) {
    throw new Error(`Pure tool not found: ${toolId}`);
  }

  return {
    description: pureTool.description,
    parameters: pureTool.inputSchema,
    execute: async (args: any, options: any) => {
      // Map AI SDK context to our clean context
      const ctx: AIToolContext = {
        sessionID: options.sessionID || 'unknown',
        messageID: options.messageID || 'unknown',
        callID: options.toolCallId || 'unknown',
        userId: options.userId || 'unknown',
        streamId: options.streamId || 'unknown',
        abort: options.abortSignal || new AbortController().signal,
        actionCtx: options.actionCtx,
      };

      const result = await executeCleanTool(toolId, args, ctx);
      
      // Return in format expected by AI SDK
      return {
        output: result.output,
        // Additional metadata for debugging
        metadata: result.metadata,
        events: result.events,
      };
    },
  };
}

/**
 * Get all available clean tools for AI SDK registration
 * No circular dependencies, no type casting
 */
export function getCleanToolsForAISDK(): Record<string, any> {
  const tools: Record<string, any> = {};
  
  for (const toolId in PureToolRegistry) {
    try {
      tools[toolId] = createAISDKTool(toolId);
    } catch (error) {
      console.warn(`Failed to create AI SDK tool for ${toolId}:`, error);
    }
  }
  
  return tools;
}

/**
 * Batch execute multiple tools with orchestration
 * Useful for complex operations requiring multiple tools
 */
export async function executeBatchTools(
  toolExecutions: Array<{ toolId: string; args: any }>,
  ctx: AIToolContext
): Promise<CleanToolResult[]> {
  const results: CleanToolResult[] = [];
  
  for (const execution of toolExecutions) {
    const result = await executeCleanTool(execution.toolId, execution.args, ctx);
    results.push(result);
  }
  
  return results;
}

/**
 * Health check for clean tool system
 * Ensures all pure tools are properly configured
 */
export function validateCleanToolSystem(): {
  valid: boolean;
  issues: string[];
  availableTools: string[];
} {
  const issues: string[] = [];
  const availableTools: string[] = [];
  
  for (const [toolId, tool] of Object.entries(PureToolRegistry)) {
    availableTools.push(toolId);
    
    // Validate tool structure
    if (!tool.description) {
      issues.push(`Tool ${toolId}: Missing description`);
    }
    
    if (!tool.inputSchema) {
      issues.push(`Tool ${toolId}: Missing input schema`);
    }
    
    if (!tool.execute || typeof tool.execute !== 'function') {
      issues.push(`Tool ${toolId}: Missing or invalid execute function`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    availableTools,
  };
}

// =================================================================
// MIGRATION HELPERS
// Utilities to help migrate from old ToolDefinition to clean tools
// =================================================================

/**
 * Check if a tool has been migrated to clean architecture
 */
export function isToolMigrated(toolId: string): boolean {
  return toolId in PureToolRegistry;
}

/**
 * Get migration status for all tools
 */
export function getToolMigrationStatus(): {
  migrated: string[];
  needsMigration: string[];
  migrationProgress: number;
} {
  // This would be populated by scanning the old tool registry
  const oldToolIds = ['internalTodoWrite', 'internalTodoRead', 'mentalModelRead', 'mentalModelEdit'];
  const migratedTools = Object.keys(PureToolRegistry);
  const needsMigration = oldToolIds.filter(id => !migratedTools.includes(id));
  
  return {
    migrated: migratedTools,
    needsMigration,
    migrationProgress: migratedTools.length / oldToolIds.length,
  };
}