import { StreamTextResult } from "ai";
import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { ToolRegistryManager, ToolContext } from "./toolRegistry";

// OpenCode-inspired session processor for handling streamText results
export interface ProcessorContext {
  sessionID: string;
  messageID: string;
  userId: string;
  actionCtx: ActionCtx;
  currentTimeContext?: any;
}

export interface ProcessorResult {
  text: string;
  toolCalls: any[];
  toolResults: any[];
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  cost?: number;
  completed: boolean;
  error?: string;
}

// Circuit breaker for preventing infinite tool iterations
class IterationManager {
  private static readonly MAX_STEPS = 3; // Reduced from 6 to prevent rate limits
  private stepCount = 0;
  private toolCallCount = new Map<string, number>();
  private conversationState = new Set<string>();

  shouldStop(steps: number): boolean {
    if (steps >= IterationManager.MAX_STEPS) {
      console.log(`[Processor] Stopping at step ${steps} (max: ${IterationManager.MAX_STEPS})`);
      return true;
    }

    // Detect tool call oscillation
    for (const [toolName, count] of Array.from(this.toolCallCount)) {
      if (count >= 2) {
        console.warn(`[Processor] Tool oscillation detected: ${toolName} called ${count} times`);
        return true;
      }
    }

    return false;
  }

  trackToolCall(toolName: string): void {
    const count = this.toolCallCount.get(toolName) || 0;
    this.toolCallCount.set(toolName, count + 1);
  }

  trackConversationState(stateKey: string): boolean {
    if (this.conversationState.has(stateKey)) {
      console.warn(`[Processor] Conversation loop detected: ${stateKey.slice(0, 100)}...`);
      return true; // Loop detected
    }
    this.conversationState.add(stateKey);
    return false;
  }

  reset(): void {
    this.stepCount = 0;
    this.toolCallCount.clear();
    this.conversationState.clear();
  }
}

export class StreamProcessor {
  private iterationManager = new IterationManager();
  private toolCalls: Record<string, any> = {};
  private currentText = "";
  private allToolResults: any[] = [];
  private totalTokens = {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 }
  };
  private totalCost = 0;

  constructor(private context: ProcessorContext) {}

  async process(stream: StreamTextResult<Record<string, any>, never>): Promise<ProcessorResult> {
    this.iterationManager.reset();
    
    try {
      console.log('[Processor] Starting stream processing...');
      
      for await (const value of stream.fullStream) {
        console.log(`[Processor] Processing stream event: ${value.type}`);
        
        switch (value.type) {
          case "start":
            break;

          case "start-step":
            console.log('[Processor] Starting new step...');
            break;

          case "text-start":
            this.currentText = "";
            break;

          case "text-delta":
            if (value.text) {
              this.currentText += value.text;
            }
            break;

          case "text-end":
            this.currentText = this.currentText.trimEnd();
            break;

          case "tool-input-start":
            // Initialize tool call tracking
            this.toolCalls[value.id] = {
              toolCallId: value.id,
              toolName: value.toolName,
              status: "pending",
              startTime: Date.now()
            };
            
            // Track tool call for oscillation detection
            this.iterationManager.trackToolCall(value.toolName);
            break;

          case "tool-input-end":
            if (this.toolCalls[value.id]) {
              this.toolCalls[value.id].status = "ready";
              // Note: AI SDK v5 tool-input-end events don't have 'input' property
              // The input is provided in the tool-call event instead
            }
            break;

          case "tool-call":
            console.log(`[Processor] Executing tool: ${value.toolName}`);
            
            if (this.toolCalls[value.toolCallId]) {
              this.toolCalls[value.toolCallId].status = "running";
              
              try {
                // Execute tool using our registry
                const tools = await ToolRegistryManager.getTools("anthropic", "claude-3-5-haiku-20241022");
                const tool = tools[value.toolName];
                
                if (!tool) {
                  throw new Error(`Tool not found: ${value.toolName}`);
                }

                // Create tool execution context
                const toolResult = await tool.execute(value.input, {
                  toolCallId: value.toolCallId,
                  abortSignal: new AbortController().signal,
                  sessionID: this.context.sessionID,
                  messageID: this.context.messageID,
                  userId: this.context.userId,
                  actionCtx: this.context.actionCtx,
                  currentTimeContext: this.context.currentTimeContext,
                  onMetadata: (metadata: any) => {
                    console.log(`[Processor] Tool metadata: ${value.toolName}:`, metadata);
                  }
                });

                this.toolCalls[value.toolCallId].status = "completed";
                this.toolCalls[value.toolCallId].result = toolResult;
                this.toolCalls[value.toolCallId].endTime = Date.now();

                // Add to results array for conversation history
                this.allToolResults.push({
                  toolCallId: value.toolCallId,
                  toolName: value.toolName,
                  result: toolResult.output
                });

                console.log(`[Processor] ✅ Tool ${value.toolName} completed successfully`);
                
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown tool execution error";
                console.error(`[Processor] ❌ Tool ${value.toolName} failed:`, errorMessage);
                
                this.toolCalls[value.toolCallId].status = "error";
                this.toolCalls[value.toolCallId].error = errorMessage;
                this.toolCalls[value.toolCallId].endTime = Date.now();

                // Add error result to conversation
                this.allToolResults.push({
                  toolCallId: value.toolCallId,
                  toolName: value.toolName,
                  result: `Error: ${errorMessage}`
                });
              }
            }
            break;

          case "tool-result":
            // Tool result is handled in tool-call case above
            break;

          case "finish-step":
            // Accumulate token usage and costs
            if (value.usage) {
              this.totalTokens.input += value.usage.inputTokens || 0;
              this.totalTokens.output += value.usage.outputTokens || 0;
              this.totalTokens.reasoning += value.usage.reasoningTokens || 0;
              this.totalTokens.cache.read += value.usage.cachedInputTokens || 0;
            }

            // Calculate cost (simplified, should use model-specific pricing)
            const stepCost = this.calculateStepCost(value.usage);
            this.totalCost += stepCost;

            console.log(`[Processor] Step finished - Tokens: ${JSON.stringify(this.totalTokens)}, Cost: $${this.totalCost.toFixed(4)}`);
            break;

          case "finish":
            console.log('[Processor] Stream processing completed');
            break;

          case "error":
            console.error('[Processor] Stream error:', value.error);
            throw value.error;

          default:
            console.log(`[Processor] Unhandled stream event: ${value.type}`);
        }
      }

      // Extract completed tool calls for conversation history
      const completedToolCalls = Object.values(this.toolCalls)
        .filter(tc => tc.status === "completed" || tc.status === "error")
        .map(tc => ({
          name: tc.toolName,
          args: tc.input || {},
          toolCallId: tc.toolCallId
        }));

      return {
        text: this.currentText,
        toolCalls: completedToolCalls,
        toolResults: this.allToolResults,
        tokens: this.totalTokens,
        cost: this.totalCost,
        completed: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Stream processing failed";
      console.error('[Processor] Stream processing error:', error);
      
      // Save conversation state even on error for debugging
      const partialToolCalls = Object.values(this.toolCalls).map(tc => ({
        name: tc.toolName,
        args: tc.input || {},
        toolCallId: tc.toolCallId
      }));

      return {
        text: this.currentText || `Error: ${errorMessage}`,
        toolCalls: partialToolCalls,
        toolResults: this.allToolResults,
        tokens: this.totalTokens,
        cost: this.totalCost,
        completed: false,
        error: errorMessage
      };
    }
  }

  private calculateStepCost(usage: any): number {
    if (!usage) return 0;
    
    // Claude 3.5 Haiku pricing (approximate)
    const INPUT_COST_PER_TOKEN = 0.00000025; // $0.25 per million input tokens
    const OUTPUT_COST_PER_TOKEN = 0.00000125; // $1.25 per million output tokens
    const CACHE_READ_COST_PER_TOKEN = 0.00000003; // $0.03 per million cache read tokens
    const CACHE_WRITE_COST_PER_TOKEN = 0.00000031; // $0.31 per million cache write tokens
    
    let cost = 0;
    cost += (usage.inputTokens || 0) * INPUT_COST_PER_TOKEN;
    cost += (usage.outputTokens || 0) * OUTPUT_COST_PER_TOKEN;
    cost += (usage.cachedInputTokens || 0) * CACHE_READ_COST_PER_TOKEN;
    // Note: cache write tokens would need to be tracked separately
    
    return cost;
  }

  // Helper method to check if we should stop processing
  checkStoppingConditions(steps: number, conversationState: string): boolean {
    // Check iteration limits
    if (this.iterationManager.shouldStop(steps)) {
      return true;
    }

    // Check for conversation loops
    if (this.iterationManager.trackConversationState(conversationState)) {
      return true;
    }

    return false;
  }
}

// Factory function for creating processors (similar to OpenCode)
export function createProcessor(context: ProcessorContext): StreamProcessor {
  return new StreamProcessor(context);
}