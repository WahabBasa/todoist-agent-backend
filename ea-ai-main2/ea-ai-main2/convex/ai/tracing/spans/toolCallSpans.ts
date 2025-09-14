import { trace, Span, SpanKind, Attributes } from '@opentelemetry/api';
import { logSpanToConsole } from '../exporters/consoleExporter';

/**
 * Create a span for AI tool calls
 * @param params - Parameters for the tool call span
 * @returns The created span
 */
export function createToolCallSpan(params: {
  toolName: string;
  input: Record<string, any>;
  sessionId?: string;
  userId?: string;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'tool.name': params.toolName,
    'tool.input.keys': Object.keys(params.input).join(','),
  };
  
  if (params.sessionId) {
    attributes['session.id'] = params.sessionId;
  }
  
  if (params.userId) {
    attributes['user.id'] = params.userId;
  }
  
  // Add input parameters as attributes (truncated for privacy)
  for (const [key, value] of Object.entries(params.input)) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    // Truncate long values for privacy
    const truncatedValue = stringValue.length > 100 ? stringValue.substring(0, 100) + '...' : stringValue;
    attributes[`tool.input.${key}`] = truncatedValue;
  }
  
  // Create and return the span
  const span = tracer.startSpan('tool.call', {
    kind: SpanKind.CLIENT,
    attributes,
  });
  
  logSpanToConsole(span, `🔧 TOOL CALL STARTED (${params.toolName})`);
  return span;
}

/**
 * Create a span for tool results
 * @param params - Parameters for the tool result span
 * @returns The created span
 */
export function createToolResultSpan(params: {
  toolName: string;
  output: any;
  success: boolean;
  sessionId?: string;
  userId?: string;
}): Span {
  const tracer = trace.getTracer('ea-ai-backend');
  
  // Create attributes for the span
  const attributes: Attributes = {
    'tool.name': params.toolName,
    'tool.result.success': params.success,
  };
  
  if (params.sessionId) {
    attributes['session.id'] = params.sessionId;
  }
  
  if (params.userId) {
    attributes['user.id'] = params.userId;
  }
  
  // Add output information (truncated for privacy)
  const outputString = typeof params.output === 'string' ? params.output : JSON.stringify(params.output);
  const truncatedOutput = outputString.length > 200 ? outputString.substring(0, 200) + '...' : outputString;
  attributes['tool.result.output'] = truncatedOutput;
  
  // Create and return the span
  const span = tracer.startSpan('tool.result', {
    kind: SpanKind.CLIENT,
    attributes,
  });
  
  const status = params.success ? '✅ SUCCESS' : '❌ FAILED';
  logSpanToConsole(span, `🔧 TOOL RESULT STARTED (${params.toolName} - ${status})`);
  return span;
}