import { trace, Span, SpanKind, Attributes } from '@opentelemetry/api';
import { logSpanToConsole } from '../../exporters/consoleExporter';
import { 
  PromptAttributeKeys, 
  PromptComponentType, 
  createPromptComponentAttributes,
  createContextAttributes,
  createHierarchyAttributes
} from '../attributes/promptAttributes';
import { endSpan } from '../../utils/spanUtils';

/**
 * Interface for enhanced prompt span parameters
 */
export interface EnhancedPromptSpanParams {
  model: string;
  systemPrompt: string;
  history: any[];
  userMessage: string;
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  parentSpan?: Span;
}

/**
 * Interface for prompt component span parameters
 */
export interface PromptComponentSpanParams {
  componentType: PromptComponentType;
  content: string | any[];
  parentSpan: Span;
  tokenCount?: number;
  complexity?: number;
}

/**
 * Interface for prompt effectiveness span parameters
 */
export interface PromptEffectivenessSpanParams {
  promptSpan: Span;
  responseQuality: number;
  toolEfficiency: number;
  parentSpan: Span;
  tokenEfficiency?: number;
  completionRate?: number;
  responseRelevance?: number;
}

/**
 * Create an enhanced prompt span with hierarchical structure
 * @param params - Parameters for the enhanced prompt span
 * @returns The created enhanced prompt span
 */
export function createEnhancedPromptSpan(params: EnhancedPromptSpanParams): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Generate a unique prompt ID
  const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate total token estimate
  const totalTokens = estimateTotalTokens(params.systemPrompt, params.history, params.userMessage);
  
  // Create base attributes
  const attributes: Attributes = {
    [PromptAttributeKeys.MODEL_NAME]: params.model,
    [PromptAttributeKeys.PROMPT_ID]: promptId,
    [PromptAttributeKeys.PROMPT_TYPE]: 'enhanced',
    [PromptAttributeKeys.PROMPT_VERSION]: '1.0',
    [PromptAttributeKeys.TOKENS_TOTAL]: totalTokens,
    [PromptAttributeKeys.TIMESTAMP_START]: Date.now(),
  };
  
  // Add context attributes
  Object.assign(attributes, createContextAttributes(
    params.sessionId,
    params.userId,
    params.conversationId
  ));
  
  // Add hierarchy attributes
  if (params.parentSpan) {
    Object.assign(attributes, createHierarchyAttributes(
      params.parentSpan.spanContext().spanId,
      undefined, // Root span ID would be set at the conversation level
      1 // Depth level for prompt span
    ));
  }
  
  // Create and return the span
  const span = tracer.startSpan('ai.prompt.enhanced', {
    kind: SpanKind.CLIENT,
    attributes,
  });
  
  logSpanToConsole(span, `🧠 ENHANCED AI PROMPT STARTED (${params.model}, ${params.history.length + 2} components)`);
  
  // Create component spans as children
  createPromptComponentSpans(span, params);
  
  return span;
}

/**
 * Create component spans for each part of the prompt
 * @param parentSpan - The parent prompt span
 * @param params - The enhanced prompt parameters
 */
function createPromptComponentSpans(parentSpan: Span, params: EnhancedPromptSpanParams): void {
  // Create system prompt component span
  const systemTokens = estimateTokenUsage(params.systemPrompt);
  createPromptComponentSpan({
    componentType: 'system',
    content: params.systemPrompt,
    parentSpan,
    tokenCount: systemTokens,
    complexity: calculatePromptComplexity([{ type: 'system', content: params.systemPrompt }])
  });
  
  // Create history component span
  const historyTokens = estimateTokenUsage(JSON.stringify(params.history));
  createPromptComponentSpan({
    componentType: 'history',
    content: params.history,
    parentSpan,
    tokenCount: historyTokens,
    complexity: calculatePromptComplexity(params.history.map(msg => ({ 
      type: msg.role || 'unknown', 
      content: msg.content || '' 
    })))
  });
  
  // Create user message component span
  const userTokens = estimateTokenUsage(params.userMessage);
  createPromptComponentSpan({
    componentType: 'user_message',
    content: params.userMessage,
    parentSpan,
    tokenCount: userTokens,
    complexity: calculatePromptComplexity([{ type: 'user', content: params.userMessage }])
  });
}

/**
 * Create a span for a specific prompt component
 * @param params - Parameters for the prompt component span
 * @returns The created component span
 */
export function createPromptComponentSpan(params: PromptComponentSpanParams): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Calculate token count if not provided
  const tokenCount = params.tokenCount || estimateTokenUsage(params.content);
  
  // Create attributes for the component
  const attributes = createPromptComponentAttributes(
    params.componentType,
    params.content,
    tokenCount,
    params.complexity
  );
  
  // Add hierarchy attributes
  Object.assign(attributes, createHierarchyAttributes(
    params.parentSpan.spanContext().spanId,
    undefined, // Root span ID would be set at the conversation level
    2 // Depth level for component spans
  ));
  
  // Create component-specific span name
  const spanName = `ai.prompt.component.${params.componentType}`;
  
  // Create and return the span
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes,
  });
  
  const contentPreview = typeof params.content === 'string' 
    ? params.content.substring(0, 50) + (params.content.length > 50 ? '...' : '')
    : `${Array.isArray(params.content) ? params.content.length : 1} items`;
  
  logSpanToConsole(span, `📋 PROMPT COMPONENT: ${params.componentType.toUpperCase()} (${tokenCount} tokens, "${contentPreview}")`);
  
  // End the component span immediately as it's just for tracking
  endSpan(span, `PROMPT COMPONENT ${params.componentType.toUpperCase()}`);
  
  return span;
}

/**
 * Create a span for prompt effectiveness analysis
 * @param params - Parameters for the prompt effectiveness span
 * @returns The created effectiveness span
 */
export function createPromptEffectivenessSpan(params: PromptEffectivenessSpanParams): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for effectiveness metrics
  const attributes: Attributes = {
    [PromptAttributeKeys.EFFECTIVENESS_RESPONSE_QUALITY]: params.responseQuality,
    [PromptAttributeKeys.EFFECTIVENESS_TOOL_EFFICIENCY]: params.toolEfficiency,
    [PromptAttributeKeys.TIMESTAMP_START]: Date.now(),
  };
  
  // Add optional metrics
  if (params.tokenEfficiency !== undefined) {
    attributes[PromptAttributeKeys.EFFECTIVENESS_TOKEN_EFFICIENCY] = params.tokenEfficiency;
  }
  
  if (params.completionRate !== undefined) {
    attributes[PromptAttributeKeys.EFFECTIVENESS_COMPLETION_RATE] = params.completionRate;
  }
  
  if (params.responseRelevance !== undefined) {
    attributes[PromptAttributeKeys.EFFECTIVENESS_RELEVANCE] = params.responseRelevance;
  }
  
  // Add hierarchy attributes
  Object.assign(attributes, createHierarchyAttributes(
    params.parentSpan.spanContext().spanId,
    undefined, // Root span ID would be set at the conversation level
    2 // Depth level for effectiveness spans
  ));
  
  // Create and return the span
  const span = tracer.startSpan('ai.prompt.effectiveness', {
    kind: SpanKind.INTERNAL,
    attributes,
  });
  
  logSpanToConsole(span, `📊 PROMPT EFFECTIVENESS (Quality: ${params.responseQuality}, Efficiency: ${params.toolEfficiency})`);
  
  return span;
}

/**
 * Estimate total tokens for the entire prompt
 * @param systemPrompt - The system prompt
 * @param history - The conversation history
 * @param userMessage - The user message
 * @returns Estimated total token count
 */
function estimateTotalTokens(systemPrompt: string, history: any[], userMessage: string): number {
  return (
    estimateTokenUsage(systemPrompt) +
    estimateTokenUsage(JSON.stringify(history)) +
    estimateTokenUsage(userMessage)
  );
}

/**
 * Calculate prompt complexity based on components
 * @param components - Array of prompt components
 * @returns Complexity score (0-100)
 */
export function calculatePromptComplexity(components: any[]): number {
  if (!components || components.length === 0) {
    return 0;
  }
  
  let complexity = 0;
  
  for (const component of components) {
    // Base complexity for each component
    complexity += 10;
    
    // Add complexity based on content length
    const contentLength = typeof component.content === 'string'
      ? component.content.length
      : JSON.stringify(component.content).length;
    
    if (contentLength > 1000) complexity += 20;
    else if (contentLength > 500) complexity += 10;
    else if (contentLength > 200) complexity += 5;
    
    // Add complexity based on component type
    if (component.type === 'history') complexity += 15;
    if (component.type === 'system' && component.content.length > 500) complexity += 10;
    
    // Add complexity for structured data
    if (typeof component.content === 'object' && !Array.isArray(component.content)) {
      complexity += 10;
    }
  }
  
  // Normalize to 0-100 scale
  return Math.min(100, Math.max(0, complexity));
}

/**
 * Estimate token usage for content
 * @param content - The content to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenUsage(content: string | any[]): number {
  if (typeof content === 'string') {
    // Simple estimation: ~4 characters per token on average
    return Math.ceil(content.length / 4);
  } else if (Array.isArray(content)) {
    // For arrays, estimate based on stringified content
    return estimateTokenUsage(JSON.stringify(content));
  } else {
    // For objects, estimate based on stringified content
    return estimateTokenUsage(JSON.stringify(content));
  }
}