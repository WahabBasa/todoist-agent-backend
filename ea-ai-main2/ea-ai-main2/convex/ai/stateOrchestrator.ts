import { ActionCtx } from "../_generated/server";
import { ToolResult, SideEffect } from "./tools/pureTools";

// =================================================================
// CENTRALIZED STATE ORCHESTRATOR - OpenCode Inspired
// Single point of responsibility for all state changes
// Eliminates circular dependencies by centralizing mutations
// =================================================================

/**
 * Orchestrator context - contains everything needed for state operations
 */
export interface OrchestratorContext {
  actionCtx: ActionCtx;
  streamId: string;
  sessionId: string;
  userId: string;
  messageId: string;
}

/**
 * Side effect execution result
 */
interface SideEffectResult {
  success: boolean;
  data: any;
  error?: string;
  executionTime: number;
}

/**
 * Orchestrator execution result
 */
export interface OrchestrationResult {
  success: boolean;
  toolResults: ToolResult[];
  sideEffectResults: SideEffectResult[];
  finalData: any;
  events: string[]; // Event IDs published
  executionSummary: {
    totalSideEffects: number;
    successfulSideEffects: number;
    failedSideEffects: number;
    totalExecutionTime: number;
  };
  error?: string;
}

/**
 * Centralized State Orchestrator
 * Handles all database operations and state changes
 * Tools are pure functions, this handles the side effects
 */
export class StateOrchestrator {
  private ctx: OrchestratorContext;

  constructor(ctx: OrchestratorContext) {
    this.ctx = ctx;
  }

  /**
   * Main orchestration method - processes tool results and executes side effects
   */
  async orchestrate(toolResults: ToolResult[]): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const sideEffectResults: SideEffectResult[] = [];
    const publishedEvents: string[] = [];
    
    try {
      // Collect all side effects from all tool results
      const allSideEffects: (SideEffect & { toolId: string })[] = [];
      
      for (const toolResult of toolResults) {
        if (toolResult.sideEffects) {
          for (const sideEffect of toolResult.sideEffects) {
            allSideEffects.push({
              ...sideEffect,
              toolId: `tool-${toolResults.indexOf(toolResult)}`,
            });
          }
        }
      }

      // Sort side effects by priority and dependencies
      const orderedSideEffects = this.resolveDependencies(allSideEffects);

      // Publish tool execution start event
      const toolStartEvent = await this.publishEvent('tool-call', {
        toolNames: toolResults.map((_, i) => `tool-${i}`),
        totalSideEffects: allSideEffects.length,
      });
      publishedEvents.push(toolStartEvent);

      // Execute side effects in order
      for (const sideEffect of orderedSideEffects) {
        const result = await this.executeSideEffect(sideEffect);
        sideEffectResults.push(result);

        // Publish progress event for significant operations
        if (sideEffect.type === 'mutation' || sideEffect.priority === 'high') {
          const progressEvent = await this.publishEvent('tool-result', {
            operation: sideEffect.operation,
            success: result.success,
            data: result.data,
            error: result.error,
            executionTime: result.executionTime,
          });
          publishedEvents.push(progressEvent);
        }
      }

      // Aggregate final data from all tool results and side effect results
      const finalData = this.aggregateResults(toolResults, sideEffectResults);

      // Publish completion event
      const completionEvent = await this.publishEvent('tool-result', {
        summary: 'All tool operations completed',
        totalOperations: allSideEffects.length,
        successfulOperations: sideEffectResults.filter(r => r.success).length,
        finalData,
      });
      publishedEvents.push(completionEvent);

      const totalExecutionTime = Date.now() - startTime;

      return {
        success: true,
        toolResults,
        sideEffectResults,
        finalData,
        events: publishedEvents,
        executionSummary: {
          totalSideEffects: allSideEffects.length,
          successfulSideEffects: sideEffectResults.filter(r => r.success).length,
          failedSideEffects: sideEffectResults.filter(r => !r.success).length,
          totalExecutionTime,
        },
      };

    } catch (error) {
      // Publish error event
      const errorEvent = await this.publishEvent('stream-error', {
        error: error instanceof Error ? error.message : 'Unknown orchestration error',
        errorType: 'orchestrator',
        context: 'tool-execution',
      });
      publishedEvents.push(errorEvent);

      return {
        success: false,
        toolResults,
        sideEffectResults,
        finalData: null,
        events: publishedEvents,
        executionSummary: {
          totalSideEffects: 0,
          successfulSideEffects: 0,
          failedSideEffects: sideEffectResults.length,
          totalExecutionTime: Date.now() - startTime,
        },
        error: error instanceof Error ? error.message : 'Orchestration failed',
      };
    }
  }

  /**
   * Execute a single side effect (mutation, query, or external API call)
   */
  private async executeSideEffect(sideEffect: SideEffect & { toolId: string }): Promise<SideEffectResult> {
    const startTime = Date.now();

    try {
      let data: any = null;

      switch (sideEffect.type) {
        case 'mutation':
          data = await this.executeMutation(sideEffect.operation, sideEffect.args);
          break;
          
        case 'query':
          data = await this.executeQuery(sideEffect.operation, sideEffect.args);
          break;
          
        case 'external_api':
          data = await this.executeExternalAPI(sideEffect.operation, sideEffect.args);
          break;
          
        default:
          throw new Error(`Unknown side effect type: ${(sideEffect as any).type}`);
      }

      return {
        success: true,
        data,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Side effect execution failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a Convex mutation
   */
  private async executeMutation(operation: string, args: any): Promise<any> {
    // Direct function call without (as any) workarounds
    // This is safe because the orchestrator is the single point of mutation access
    
    try {
      switch (operation) {
        case 'aiInternalTodos.updateInternalTodos':
          return await this.ctx.actionCtx.runMutation("aiInternalTodos.updateInternalTodos", args);
          
        case 'mentalModels.editMentalModel':
          return await this.ctx.actionCtx.runMutation("mentalModels.editMentalModel", args);
          
        case 'streamEvents.publishEvent':
          return await this.ctx.actionCtx.runMutation("streamEvents.publishEvent", args);
          
        case 'streamingCompat.updateStreamingTextHybrid':
          return await this.ctx.actionCtx.runMutation("streamingCompat.updateStreamingTextHybrid", args);
          
        case 'streamingCompat.updateStreamingToolCallHybrid':
          return await this.ctx.actionCtx.runMutation("streamingCompat.updateStreamingToolCallHybrid", args);
          
        case 'streamingCompat.updateStreamingToolResultHybrid':
          return await this.ctx.actionCtx.runMutation("streamingCompat.updateStreamingToolResultHybrid", args);
          
        default:
          throw new Error(`Unknown mutation operation: ${operation}`);
      }
    } catch (error) {
      console.error(`[ORCHESTRATOR] Mutation failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute a Convex query
   */
  private async executeQuery(operation: string, args: any): Promise<any> {
    try {
      switch (operation) {
        case 'aiInternalTodos.getInternalTodos':
          return await this.ctx.actionCtx.runQuery("aiInternalTodos.getInternalTodos", args);
          
        case 'mentalModels.getUserMentalModel':
          return await this.ctx.actionCtx.runQuery("mentalModels.getUserMentalModel", args);
          
        case 'streamEvents.getStreamState':
          return await this.ctx.actionCtx.runQuery("streamEvents.getStreamState", args);
          
        case 'streamEvents.getStreamEvents':
          return await this.ctx.actionCtx.runQuery("streamEvents.getStreamEvents", args);
          
        default:
          throw new Error(`Unknown query operation: ${operation}`);
      }
    } catch (error) {
      console.error(`[ORCHESTRATOR] Query failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute external API calls (future extension point)
   */
  private async executeExternalAPI(operation: string, args: any): Promise<any> {
    // Future: Handle external API calls like Todoist, Google Calendar, etc.
    // For now, these are handled by existing Todoist tools
    throw new Error(`External API operations not yet supported: ${operation}`);
  }

  /**
   * Resolve dependencies and return properly ordered side effects
   */
  private resolveDependencies(sideEffects: (SideEffect & { toolId: string })[]): (SideEffect & { toolId: string })[] {
    // Simple priority-based ordering for now
    // Future: Implement proper dependency graph resolution
    
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    
    return sideEffects.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Mutations before queries
      if (a.type !== b.type) {
        if (a.type === 'mutation') return -1;
        if (b.type === 'mutation') return 1;
      }
      
      return 0;
    });
  }

  /**
   * Aggregate results from tool executions and side effects
   */
  private aggregateResults(toolResults: ToolResult[], sideEffectResults: SideEffectResult[]): any {
    const aggregated = {
      tools: {},
      mutations: {},
      queries: {},
      summary: {
        toolsExecuted: toolResults.length,
        sideEffectsExecuted: sideEffectResults.length,
        overallSuccess: toolResults.every(tr => tr.success) && sideEffectResults.every(sr => sr.success),
      },
    };

    // Aggregate tool data
    for (let i = 0; i < toolResults.length; i++) {
      const toolResult = toolResults[i];
      (aggregated.tools as any)[`tool-${i}`] = {
        success: toolResult.success,
        data: toolResult.data,
        metadata: toolResult.metadata,
        error: toolResult.error,
      };
    }

    // Aggregate side effect data
    for (let i = 0; i < sideEffectResults.length; i++) {
      const sideEffectResult = sideEffectResults[i];
      (aggregated.mutations as any)[`effect-${i}`] = {
        success: sideEffectResult.success,
        data: sideEffectResult.data,
        executionTime: sideEffectResult.executionTime,
        error: sideEffectResult.error,
      };
    }

    return aggregated;
  }

  /**
   * Publish an event to the streaming system
   */
  private async publishEvent(eventType: string, payload: any): Promise<string> {
    try {
      const result = await this.ctx.actionCtx.runMutation("streamEvents.publishEvent", {
        streamId: this.ctx.streamId,
        eventType,
        payload,
      });
      
      return result.streamId + '-' + result.order;
    } catch (error) {
      console.warn('[ORCHESTRATOR] Failed to publish event:', error);
      return 'event-failed-' + Date.now();
    }
  }
}

/**
 * Convenience function to create and run orchestrator
 */
export async function orchestrateToolResults(
  toolResults: ToolResult[],
  ctx: OrchestratorContext
): Promise<OrchestrationResult> {
  const orchestrator = new StateOrchestrator(ctx);
  return await orchestrator.orchestrate(toolResults);
}

/**
 * Helper to create orchestrator context from common parameters
 */
export function createOrchestratorContext(
  actionCtx: ActionCtx,
  streamId: string,
  sessionId: string,
  userId: string,
  messageId: string
): OrchestratorContext {
  return {
    actionCtx,
    streamId,
    sessionId,
    userId,
    messageId,
  };
}