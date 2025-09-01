import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { streamText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "./system";
import { 
  createOrchestratorContext, 
  StateOrchestrator,
  OrchestrationResult 
} from "./stateOrchestrator";
import { 
  executePureTool, 
  PureToolContext, 
  PureToolRegistry 
} from "./tools/pureTools";

// =================================================================
// EVENT-DRIVEN AI PROCESSOR
// OpenCode-inspired streaming with discrete events
// Replaces record-patching with event publishing
// =================================================================

/**
 * Processor context for event-driven streaming
 */
export interface ProcessorContext {
  ctx: ActionCtx;
  sessionId: string;
  userId: string;
  streamId: string;
  userMessage: string;
  modelName: string;
  messageId: string;
  mentalModelContent?: string;
}

/**
 * Processing result with event tracking
 */
export interface ProcessingResult {
  success: boolean;
  finalContent: string;
  toolCallsExecuted: any[];
  toolResultsGenerated: any[];
  eventsPublished: number;
  totalProcessingTime: number;
  error?: string;
}

/**
 * Event-driven AI processor
 * Publishes discrete events instead of updating single record
 */
export class EventDrivenProcessor {
  private ctx: ProcessorContext;
  private orchestrator: StateOrchestrator;
  private eventsPublished: number = 0;
  private startTime: number;

  constructor(ctx: ProcessorContext) {
    this.ctx = ctx;
    this.startTime = Date.now();
    
    // Create orchestrator for centralized state management
    const orchestratorCtx = createOrchestratorContext(
      ctx.ctx,
      ctx.streamId,
      ctx.sessionId,
      ctx.userId,
      ctx.messageId
    );
    this.orchestrator = new StateOrchestrator(orchestratorCtx);
  }

  /**
   * Main processing method - replaces the old streaming loop
   */
  async processAIStream(
    modelMessages: any[],
    availableTools: Record<string, any>
  ): Promise<ProcessingResult> {
    try {
      // Start stream with initial event
      await this.publishEvent('stream-start', {
        userMessage: this.ctx.userMessage,
        modelName: this.ctx.modelName,
        availableTools: Object.keys(availableTools),
        sessionContext: {
          sessionId: this.ctx.sessionId,
          messageId: this.ctx.messageId,
        },
      });

      // Create AI SDK stream
      const result = streamText({
        model: openrouter(this.ctx.modelName),
        system: SystemPrompt.getSystemPrompt(
          this.ctx.modelName, 
          "", // No dynamic instructions for now
          this.ctx.userMessage,
          this.ctx.mentalModelContent
        ),
        messages: modelMessages,
        tools: this.createEventDrivenTools(availableTools),
      });

      // Process stream events
      const streamResult = await this.processStreamEvents(result);
      
      // Finish stream
      await this.publishEvent('stream-finish', {
        totalEvents: this.eventsPublished,
        finalContent: streamResult.finalContent,
        toolCalls: streamResult.toolCallsExecuted,
        toolResults: streamResult.toolResultsGenerated,
        processingTime: Date.now() - this.startTime,
      });

      return {
        success: true,
        finalContent: streamResult.finalContent,
        toolCallsExecuted: streamResult.toolCallsExecuted,
        toolResultsGenerated: streamResult.toolResultsGenerated,
        eventsPublished: this.eventsPublished,
        totalProcessingTime: Date.now() - this.startTime,
      };

    } catch (error) {
      console.error('[EVENT-PROCESSOR] Processing failed:', error);
      
      // Publish error event
      await this.publishEvent('stream-error', {
        error: error instanceof Error ? error.message : 'Unknown processing error',
        errorType: 'ai_processing',
        recoverable: false,
      });

      return {
        success: false,
        finalContent: '',
        toolCallsExecuted: [],
        toolResultsGenerated: [],
        eventsPublished: this.eventsPublished,
        totalProcessingTime: Date.now() - this.startTime,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  /**
   * Process AI SDK stream events and publish discrete events
   */
  private async processStreamEvents(result: any): Promise<{
    finalContent: string;
    toolCallsExecuted: any[];
    toolResultsGenerated: any[];
  }> {
    let accumulatedText = '';
    const toolCallsExecuted: any[] = [];
    const toolResultsGenerated: any[] = [];

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          // Publish individual text delta event (no accumulation)
          await this.publishEvent('text-delta', {
            text: part.text,
            accumulated: accumulatedText + part.text, // For debugging
          });
          
          accumulatedText += part.text;
          break;

        case 'tool-call':
          console.log(`[EVENT-PROCESSOR] Tool call: ${part.toolName}`);
          
          const toolCallData = {
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            args: part.input,
          };
          
          toolCallsExecuted.push(toolCallData);
          
          // Publish tool call event
          await this.publishEvent('tool-call', {
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            input: part.input,
          });
          break;

        case 'tool-result':
          console.log(`[EVENT-PROCESSOR] Tool result: ${part.toolName}`);
          
          const toolResultData = {
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            result: part.output,
          };
          
          toolResultsGenerated.push(toolResultData);
          
          // Publish tool result event
          await this.publishEvent('tool-result', {
            toolName: part.toolName,
            toolCallId: part.toolCallId,
            output: part.output,
            success: true, // AI SDK doesn't provide failure info here
          });
          break;

        case 'finish':
          console.log('[EVENT-PROCESSOR] Stream completed');
          break;

        default:
          console.log(`[EVENT-PROCESSOR] Unhandled event: ${part.type}`);
      }

      // Minimal delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    return {
      finalContent: accumulatedText,
      toolCallsExecuted,
      toolResultsGenerated,
    };
  }

  /**
   * Create event-driven tools that use pure functions + orchestrator
   */
  private createEventDrivenTools(legacyTools: Record<string, any>): Record<string, any> {
    const eventTools: Record<string, any> = {};

    // Add pure tools (clean architecture)
    for (const [toolId, pureTool] of Object.entries(PureToolRegistry)) {
      eventTools[toolId] = {
        description: pureTool.description,
        parameters: pureTool.inputSchema,
        execute: async (args: any, options: any) => {
          // Execute pure tool
          const pureContext: PureToolContext = {
            sessionID: this.ctx.sessionId,
            messageID: this.ctx.messageId,
            callID: options.toolCallId || 'unknown',
            userId: this.ctx.userId,
            abort: new AbortController().signal,
          };

          const toolResult = await executePureTool(toolId, args, pureContext);

          if (!toolResult.success) {
            return {
              output: toolResult.error || 'Tool execution failed',
            };
          }

          // Execute side effects through orchestrator
          if (toolResult.sideEffects && toolResult.sideEffects.length > 0) {
            const orchestrationResult: OrchestrationResult = await this.orchestrator.orchestrate([toolResult]);
            
            if (!orchestrationResult.success) {
              return {
                output: orchestrationResult.error || 'Orchestration failed',
              };
            }
          }

          // Return structured output
          return {
            output: this.formatToolOutput(toolResult),
          };
        },
      };
    }

    // Add legacy tools (for tools not yet migrated)
    for (const [toolId, tool] of Object.entries(legacyTools)) {
      if (!(toolId in eventTools)) {
        eventTools[toolId] = tool; // Use as-is for now
      }
    }

    return eventTools;
  }

  /**
   * Format tool output for AI consumption
   */
  private formatToolOutput(toolResult: any): string {
    const parts: string[] = [];
    
    if (toolResult.metadata?.title) {
      parts.push(`✅ ${toolResult.metadata.title}`);
    }
    
    if (toolResult.metadata?.description) {
      parts.push(toolResult.metadata.description);
    }
    
    // Add data summary if available
    if (toolResult.data) {
      if (toolResult.data.summary) {
        const summary = toolResult.data.summary;
        parts.push(`Status: ${summary.remaining || 0} tasks remaining`);
      }
    }
    
    return parts.join('\n') || 'Tool executed successfully';
  }

  /**
   * Publish a discrete event to the streaming system
   */
  private async publishEvent(eventType: string, payload: any): Promise<void> {
    try {
      await this.ctx.ctx.runMutation(api.streamEvents.publishEvent, {
        streamId: this.ctx.streamId,
        eventType,
        payload,
      });
      
      this.eventsPublished++;
    } catch (error) {
      console.warn(`[EVENT-PROCESSOR] Failed to publish ${eventType} event:`, error);
      // Don't throw - continue processing even if event publishing fails
    }
  }
}

/**
 * Main entry point for event-driven AI processing
 * Replaces the old streaming pattern in ai.ts
 */
export async function processWithEvents(
  ctx: ActionCtx,
  sessionId: string,
  userId: string,
  streamId: string,
  userMessage: string,
  modelName: string,
  messageId: string,
  modelMessages: any[],
  availableTools: Record<string, any>,
  mentalModelContent?: string
): Promise<ProcessingResult> {
  
  const processorContext: ProcessorContext = {
    ctx,
    sessionId,
    userId,
    streamId,
    userMessage,
    modelName,
    messageId,
    mentalModelContent,
  };

  const processor = new EventDrivenProcessor(processorContext);
  return await processor.processAIStream(modelMessages, availableTools);
}

/**
 * Hybrid processing - uses both event system and legacy for migration
 */
export async function processWithHybrid(
  ctx: ActionCtx,
  sessionId: string,
  userId: string,
  streamId: string,
  userMessage: string,
  modelName: string,
  messageId: string,
  modelMessages: any[],
  availableTools: Record<string, any>,
  mentalModelContent?: string
): Promise<ProcessingResult> {
  
  // Start both systems
  await ctx.runMutation(api.streamingCompat.startStreamingHybrid, {
    streamId,
    sessionId,
    userMessage,
    modelName,
    config: {
      useEventSystem: true,
      useLegacySystem: true,
      hybridMode: true,
    },
  });

  // Process with events (primary system)
  const eventResult = await processWithEvents(
    ctx, sessionId, userId, streamId, userMessage, 
    modelName, messageId, modelMessages, availableTools, mentalModelContent
  );

  // Update legacy system for compatibility
  if (eventResult.success) {
    try {
      await ctx.runMutation(api.streamingCompat.finishStreamingHybrid, {
        streamId,
        finalContent: eventResult.finalContent,
        toolCalls: eventResult.toolCallsExecuted,
        toolResults: eventResult.toolResultsGenerated,
      });
    } catch (error) {
      console.warn('[HYBRID-PROCESSOR] Failed to update legacy system:', error);
      // Continue - event system succeeded
    }
  }

  return eventResult;
}