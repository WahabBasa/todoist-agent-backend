import { Attributes } from '@opentelemetry/api';

/**
 * Attribute keys for prompt tracing
 */
export const PromptAttributeKeys = {
  // Basic prompt attributes
  MODEL_NAME: 'prompt.model.name',
  PROMPT_ID: 'prompt.id',
  PROMPT_TYPE: 'prompt.type',
  PROMPT_VERSION: 'prompt.version',
  
  // Component attributes
  COMPONENT_TYPE: 'prompt.component.type',
  COMPONENT_TOKEN_COUNT: 'prompt.component.tokens',
  COMPONENT_LENGTH: 'prompt.component.length',
  COMPONENT_COMPLEXITY: 'prompt.component.complexity',
  
  // Token usage attributes
  TOKENS_INPUT: 'prompt.tokens.input',
  TOKENS_OUTPUT: 'prompt.tokens.output',
  TOKENS_TOTAL: 'prompt.tokens.total',
  TOKENS_SYSTEM: 'prompt.tokens.system',
  TOKENS_HISTORY: 'prompt.tokens.history',
  TOKENS_USER: 'prompt.tokens.user',
  
  // Effectiveness metrics
  EFFECTIVENESS_RESPONSE_QUALITY: 'prompt.effectiveness.response_quality',
  EFFECTIVENESS_TOOL_EFFICIENCY: 'prompt.effectiveness.tool_efficiency',
  EFFECTIVENESS_TOKEN_EFFICIENCY: 'prompt.effectiveness.token_efficiency',
  EFFECTIVENESS_COMPLETION_RATE: 'prompt.effectiveness.completion_rate',
  EFFECTIVENESS_RELEVANCE: 'prompt.effectiveness.relevance',
  
  // Performance attributes
  DURATION_MS: 'prompt.duration.ms',
  TIMESTAMP_START: 'prompt.timestamp.start',
  TIMESTAMP_END: 'prompt.timestamp.end',
  
  // Context attributes
  SESSION_ID: 'prompt.session.id',
  USER_ID: 'prompt.user.id',
  CONVERSATION_ID: 'prompt.conversation.id',
  
  // Hierarchy attributes
  PARENT_SPAN_ID: 'prompt.parent.span_id',
  ROOT_SPAN_ID: 'prompt.root.span_id',
  SPAN_DEPTH: 'prompt.span.depth',
} as const;

/**
 * Types for prompt components
 */
export type PromptComponentType = 'system' | 'history' | 'user_message';

/**
 * Types for prompt effectiveness metrics
 */
export interface PromptEffectivenessMetrics {
  responseQuality: number;
  toolEfficiency: number;
  tokenEfficiency: number;
  completionRate: number;
  responseRelevance: number;
}

/**
 * Create attributes for prompt components
 */
export function createPromptComponentAttributes(
  componentType: PromptComponentType,
  content: string | any[],
  tokenCount: number,
  complexity?: number
): Attributes {
  const attributes: Attributes = {
    [PromptAttributeKeys.COMPONENT_TYPE]: componentType,
    [PromptAttributeKeys.COMPONENT_TOKEN_COUNT]: tokenCount,
    [PromptAttributeKeys.COMPONENT_LENGTH]: typeof content === 'string' ? content.length : JSON.stringify(content).length,
  };
  
  if (complexity !== undefined) {
    attributes[PromptAttributeKeys.COMPONENT_COMPLEXITY] = complexity;
  }
  
  return attributes;
}

/**
 * Create attributes for token usage tracking
 */
export function createTokenUsageAttributes(
  inputTokens: number,
  outputTokens: number,
  systemTokens?: number,
  historyTokens?: number,
  userTokens?: number
): Attributes {
  const attributes: Attributes = {
    [PromptAttributeKeys.TOKENS_INPUT]: inputTokens,
    [PromptAttributeKeys.TOKENS_OUTPUT]: outputTokens,
    [PromptAttributeKeys.TOKENS_TOTAL]: inputTokens + outputTokens,
  };
  
  if (systemTokens !== undefined) {
    attributes[PromptAttributeKeys.TOKENS_SYSTEM] = systemTokens;
  }
  
  if (historyTokens !== undefined) {
    attributes[PromptAttributeKeys.TOKENS_HISTORY] = historyTokens;
  }
  
  if (userTokens !== undefined) {
    attributes[PromptAttributeKeys.TOKENS_USER] = userTokens;
  }
  
  return attributes;
}

/**
 * Create attributes for prompt effectiveness metrics
 */
export function createEffectivenessAttributes(metrics: PromptEffectivenessMetrics): Attributes {
  return {
    [PromptAttributeKeys.EFFECTIVENESS_RESPONSE_QUALITY]: metrics.responseQuality,
    [PromptAttributeKeys.EFFECTIVENESS_TOOL_EFFICIENCY]: metrics.toolEfficiency,
    [PromptAttributeKeys.EFFECTIVENESS_TOKEN_EFFICIENCY]: metrics.tokenEfficiency,
    [PromptAttributeKeys.EFFECTIVENESS_COMPLETION_RATE]: metrics.completionRate,
    [PromptAttributeKeys.EFFECTIVENESS_RELEVANCE]: metrics.responseRelevance,
  };
}

/**
 * Create context attributes for prompt spans
 */
export function createContextAttributes(
  sessionId?: string,
  userId?: string,
  conversationId?: string
): Attributes {
  const attributes: Attributes = {};
  
  if (sessionId) {
    attributes[PromptAttributeKeys.SESSION_ID] = sessionId;
  }
  
  if (userId) {
    attributes[PromptAttributeKeys.USER_ID] = userId;
  }
  
  if (conversationId) {
    attributes[PromptAttributeKeys.CONVERSATION_ID] = conversationId;
  }
  
  return attributes;
}

/**
 * Create hierarchy attributes for prompt spans
 */
export function createHierarchyAttributes(
  parentSpanId?: string,
  rootSpanId?: string,
  depth?: number
): Attributes {
  const attributes: Attributes = {};
  
  if (parentSpanId) {
    attributes[PromptAttributeKeys.PARENT_SPAN_ID] = parentSpanId;
  }
  
  if (rootSpanId) {
    attributes[PromptAttributeKeys.ROOT_SPAN_ID] = rootSpanId;
  }
  
  if (depth !== undefined) {
    attributes[PromptAttributeKeys.SPAN_DEPTH] = depth;
  }
  
  return attributes;
}