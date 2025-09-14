import { trace, Span, SpanKind, Attributes } from '@opentelemetry/api';
import { logSpanToConsole } from '../exporters/consoleExporter';

/**
 * Create a span for user messages
 * @param params - Parameters for the user message span
 * @returns The created span
 */
export function createUserMessageSpan(params: {
  sessionId?: string;
  userId?: string;
  message: string;
  timestamp?: number;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'message.role': 'user',
    'message.content.length': params.message.length,
  };
  
  if (params.sessionId) {
    attributes['session.id'] = params.sessionId;
  }
  
  if (params.userId) {
    attributes['user.id'] = params.userId;
  }
  
  // Create and return the span
  const span = tracer.startSpan('user.message', {
    kind: SpanKind.INTERNAL,
    attributes,
  });
  
  logSpanToConsole(span, `🟢 USER MESSAGE STARTED: "${params.message.substring(0, 50)}${params.message.length > 50 ? '...' : ''}"`);
  return span;
}

/**
 * Create a span for assistant messages
 * @param params - Parameters for the assistant message span
 * @returns The created span
 */
export function createAssistantMessageSpan(params: {
  sessionId?: string;
  userId?: string;
  message: string;
  model?: string;
  timestamp?: number;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'message.role': 'assistant',
    'message.content.length': params.message.length,
  };
  
  if (params.sessionId) {
    attributes['session.id'] = params.sessionId;
  }
  
  if (params.userId) {
    attributes['user.id'] = params.userId;
  }
  
  if (params.model) {
    attributes['model.name'] = params.model;
  }
  
  // Create and return the span
  const span = tracer.startSpan('assistant.message', {
    kind: SpanKind.INTERNAL,
    attributes,
  });
  
  logSpanToConsole(span, `🤖 ASSISTANT MESSAGE STARTED (${params.model || 'unknown-model'})`);
  return span;
}

/**
 * Create a root span for the entire conversation
 * @param params - Parameters for the conversation span
 * @returns The created span
 */
export function createConversationSpan(params: {
  sessionId: string;
  userId: string;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'session.id': params.sessionId,
    'user.id': params.userId,
  };
  
  // Create and return the span
  const span = tracer.startSpan('conversation', {
    kind: SpanKind.SERVER,
    attributes,
  });
  
  logSpanToConsole(span, `💬 CONVERSATION STARTED (session: ${params.sessionId.substring(0, 8)}...)`);
  return span;
}