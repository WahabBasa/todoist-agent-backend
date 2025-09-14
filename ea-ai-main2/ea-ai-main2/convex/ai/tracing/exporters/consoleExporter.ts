import { Span } from '@opentelemetry/api';
import { PromptAttributeKeys } from '../enhanced/attributes/promptAttributes';

/**
 * Simple console logging for serverless environments
 * Replaces the OpenTelemetry ConsoleSpanExporter which requires NodeSDK
 */

/**
 * Log span information to console in a readable format
 * @param span - The span to log
 * @param operation - The operation name
 */
export function logSpanToConsole(span: any, operation: string): void {
  try {
    // Clean, focused OpenTelemetry logging
    console.log(`🔍 [TRACE] ${operation}`);
    
    // For enhanced prompt spans, log additional details
    if (span.name === 'ai.prompt.enhanced') {
      logEnhancedPromptDetails(span);
    }
    
    // For prompt effectiveness spans, log metrics
    if (span.name === 'ai.prompt.effectiveness') {
      logPromptEffectivenessMetrics(span);
    }
    
    // For prompt component spans, log component details
    if (span.name && span.name.startsWith('ai.prompt.component.')) {
      logPromptComponentDetails(span);
    }
  } catch (error) {
    console.error('[OpenTelemetry] Failed to log span to console:', error);
  }
}

/**
 * Log details for enhanced prompt spans
 * @param span - The enhanced prompt span
 */
function logEnhancedPromptDetails(span: any): void {
  const attributes = span.attributes || {};
  
  console.log(`  📊 Model: ${attributes[PromptAttributeKeys.MODEL_NAME] || 'unknown'}`);
  console.log(`  🆔 ID: ${attributes[PromptAttributeKeys.PROMPT_ID] || 'unknown'}`);
  console.log(`  📏 Tokens: ${attributes[PromptAttributeKeys.TOKENS_TOTAL] || 'unknown'}`);
  
  if (attributes[PromptAttributeKeys.SESSION_ID]) {
    console.log(`  🗂️ Session: ${attributes[PromptAttributeKeys.SESSION_ID].substring(0, 8)}...`);
  }
}

/**
 * Log metrics for prompt effectiveness spans
 * @param span - The prompt effectiveness span
 */
function logPromptEffectivenessMetrics(span: any): void {
  const attributes = span.attributes || {};
  
  console.log(`  📈 Response Quality: ${attributes[PromptAttributeKeys.EFFECTIVENESS_RESPONSE_QUALITY] || 'unknown'}/100`);
  console.log(`  ⚡ Tool Efficiency: ${attributes[PromptAttributeKeys.EFFECTIVENESS_TOOL_EFFICIENCY] || 'unknown'}/100`);
  console.log(`  💰 Token Efficiency: ${attributes[PromptAttributeKeys.EFFECTIVENESS_TOKEN_EFFICIENCY] || 'unknown'}/100`);
  console.log(`  ✅ Completion Rate: ${attributes[PromptAttributeKeys.EFFECTIVENESS_COMPLETION_RATE] || 'unknown'}/100`);
  console.log(`  🎯 Response Relevance: ${attributes[PromptAttributeKeys.EFFECTIVENESS_RELEVANCE] || 'unknown'}/100`);
  
  // Calculate overall effectiveness
  const metrics = [
    attributes[PromptAttributeKeys.EFFECTIVENESS_RESPONSE_QUALITY],
    attributes[PromptAttributeKeys.EFFECTIVENESS_TOOL_EFFICIENCY],
    attributes[PromptAttributeKeys.EFFECTIVENESS_TOKEN_EFFICIENCY],
    attributes[PromptAttributeKeys.EFFECTIVENESS_COMPLETION_RATE],
    attributes[PromptAttributeKeys.EFFECTIVENESS_RELEVANCE]
  ].filter(val => val !== undefined && val !== null);
  
  if (metrics.length > 0) {
    const overall = metrics.reduce((sum: number, val: number) => sum + val, 0) / metrics.length;
    console.log(`  🏆 Overall Effectiveness: ${Math.round(overall)}/100`);
  }
}

/**
 * Log details for prompt component spans
 * @param span - The prompt component span
 */
function logPromptComponentDetails(span: any): void {
  const attributes = span.attributes || {};
  const componentType = attributes[PromptAttributeKeys.COMPONENT_TYPE] || 'unknown';
  
  console.log(`  📝 Component: ${componentType.toUpperCase()}`);
  console.log(`  📏 Tokens: ${attributes[PromptAttributeKeys.COMPONENT_TOKEN_COUNT] || 'unknown'}`);
  console.log(`  📐 Length: ${attributes[PromptAttributeKeys.COMPONENT_LENGTH] || 'unknown'} chars`);
  
  if (attributes[PromptAttributeKeys.COMPONENT_COMPLEXITY] !== undefined) {
    const complexity = attributes[PromptAttributeKeys.COMPONENT_COMPLEXITY];
    let complexityLabel = 'Simple';
    
    if (complexity > 70) complexityLabel = 'Complex';
    else if (complexity > 40) complexityLabel = 'Medium';
    
    console.log(`  🧩 Complexity: ${complexity}/100 (${complexityLabel})`);
  }
}

/**
 * Create a simple console exporter for development
 * @returns Simple logging function
 */
export function createConsoleExporter() {
  return {
    export: (spans: any[]) => {
      spans.forEach(span => {
        logSpanToConsole(span, span.name || 'Unknown Operation');
      });
    }
  };
}

/**
 * Log a summary of all spans in a trace
 * @param spans - Array of spans to summarize
 */
export function logTraceSummary(spans: any[]): void {
  try {
    if (!spans || spans.length === 0) return;
    
    // Group spans by type
    const spanTypes: Record<string, number> = {};
    let totalTokens = 0;
    let totalDuration = 0;
    
    spans.forEach(span => {
      const name = span.name || 'unknown';
      spanTypes[name] = (spanTypes[name] || 0) + 1;
      
      // Sum up tokens from prompt spans
      if (name === 'ai.prompt.enhanced' && span.attributes) {
        totalTokens += span.attributes[PromptAttributeKeys.TOKENS_TOTAL] || 0;
      }
      
      // Sum up duration
      if (span.endTime && span.startTime) {
        totalDuration += span.endTime - span.startTime;
      }
    });
    
    console.log(`\n📊 TRACE SUMMARY:`);
    console.log(`  🕒 Duration: ${totalDuration}ms`);
    console.log(`  🔤 Tokens: ${totalTokens}`);
    console.log(`  📋 Spans: ${spans.length}`);
    
    console.log(`  📂 Span Types:`);
    Object.entries(spanTypes).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`);
    });
    
    console.log(''); // Add empty line for readability
  } catch (error) {
    console.error('[OpenTelemetry] Failed to log trace summary:', error);
  }
}