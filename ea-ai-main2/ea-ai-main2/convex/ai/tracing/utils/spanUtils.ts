import { Span } from '@opentelemetry/api';
import { logSpanToConsole } from '../exporters/consoleExporter';

/**
 * Safely end a span with error handling
 * @param span - The span to end
 * @param spanName - The name of the span for logging
 * @param error - Optional error to record
 */
export function endSpan(span: Span, spanName?: string, error?: Error): void {
  try {
    if (error) {
      span.recordException(error);
      span.setStatus({
        code: 2, // ERROR
        message: error.message,
      });
      logSpanToConsole(span, `🔴 ${spanName || 'Unknown'} FAILED: ${error.message}`);
    } else {
      logSpanToConsole(span, `✅ ${spanName || 'Unknown'} COMPLETED`);
    }
    span.end();
  } catch (err) {
    console.error('[OpenTelemetry] Failed to end span:', err);
  }
}

/**
 * Add attributes to a span safely
 * @param span - The span to add attributes to
 * @param attributes - The attributes to add
 */
export function addSpanAttributes(span: Span, attributes: Record<string, any>): void {
  try {
    span.setAttributes(attributes);
  } catch (err) {
    console.error('[OpenTelemetry] Failed to add attributes to span:', err);
  }
}

/**
 * Truncate a string for privacy purposes
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis
 */
export function truncateString(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}