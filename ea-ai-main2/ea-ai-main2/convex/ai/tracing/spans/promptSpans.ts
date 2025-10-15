import { trace, Span, SpanKind, Attributes } from '@opentelemetry/api';
import { logSpanToConsole } from '../exporters/consoleExporter';

// Import enhanced functionality
import {
  createEnhancedPromptSpan,
  EnhancedPromptSpanParams,
  createPromptEffectivenessSpan
} from '../enhanced/spans/enhancedPromptSpans';
import { analyzePromptEffectiveness, PromptAnalysisParams } from '../enhanced/analysis/promptAnalysis';
import { createEffectivenessAttributes } from '../enhanced/attributes/promptAttributes';

/**
 * Create a span for AI model prompts (legacy interface)
 * @param params - Parameters for the prompt span
 * @returns The created span
 */
export function createPromptSpan(params: {
  model: string;
  prompt: string;
  messageCount: number;
  sessionId?: string;
  userId?: string;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'model.name': params.model,
    'prompt.content.length': params.prompt.length,
    'prompt.message.count': params.messageCount,
  };
  
  if (params.sessionId) {
    attributes['session.id'] = params.sessionId;
  }
  
  if (params.userId) {
    attributes['user.id'] = params.userId;
  }
  
  // Create and return the span
  const span = tracer.startSpan('ai.prompt', {
    kind: SpanKind.CLIENT,
    attributes,
  });
  
  logSpanToConsole(span, `🧠 AI PROMPT STARTED (${params.model}, ${params.messageCount} messages)`);
  return span;
}

/**
 * Create an enhanced prompt span with detailed tracking
 * @param params - Parameters for the enhanced prompt span
 * @returns The created enhanced prompt span
 */
export function createEnhancedPromptTracking(params: EnhancedPromptSpanParams): Span {
  return createEnhancedPromptSpan(params);
}

/**
 * Analyze prompt effectiveness and create tracking spans
 * @param params - Parameters for prompt effectiveness analysis
 * @param parentSpan - The parent prompt span
 * @returns The effectiveness span
 */
export function analyzeAndTrackPromptEffectiveness(
  params: PromptAnalysisParams,
  parentSpan: Span
): Span {
  // Analyze effectiveness
  const metrics = analyzePromptEffectiveness(params);
  
  // Create effectiveness span
  const effectivenessSpan = createPromptEffectivenessSpan({
    promptSpan: parentSpan,
    responseQuality: metrics.responseQuality,
    toolEfficiency: metrics.toolEfficiency,
    parentSpan,
    tokenEfficiency: metrics.tokenEfficiency,
    completionRate: metrics.completionRate,
    responseRelevance: metrics.responseRelevance
  });
  
  // Add effectiveness metrics to parent span
  parentSpan.setAttributes(createEffectivenessAttributes(metrics));
  
  return effectivenessSpan;
}

/**
 * Update prompt span with response information
 * @param span - The prompt span to update
 * @param response - The AI response
 * @param toolCalls - Array of tool calls made
 * @param tokenUsage - Token usage information
 */
export function updatePromptSpanWithResponse(
  span: Span,
  response: string,
  toolCalls: any[] = [],
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number }
): void {
  try {
    const attributes: Attributes = {
      'ai.response.length': response.length,
      'ai.tool_calls.count': toolCalls.length,
    };
    
    if (tokenUsage) {
      attributes['ai.usage.input_tokens'] = tokenUsage.inputTokens;
      attributes['ai.usage.output_tokens'] = tokenUsage.outputTokens;
      attributes['ai.usage.total_tokens'] = tokenUsage.totalTokens;
    }
    
    span.setAttributes(attributes);
  } catch (error) {
    console.error('[OpenTelemetry] Failed to update prompt span with response:', error);
  }
}