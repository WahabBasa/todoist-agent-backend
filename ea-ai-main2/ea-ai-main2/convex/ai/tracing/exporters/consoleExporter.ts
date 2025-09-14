import { Span } from '@opentelemetry/api';
import { PromptAttributeKeys } from '../enhanced/attributes/promptAttributes';

/**
 * Clean, detailed console logging for AI workflow tracing
 * Shows complete tool call parameters and subagent interactions without noise
 */

// Global state to track conversation flow and filter noise
let conversationActive = false;
let currentToolCalls: Map<string, any> = new Map();

/**
 * Main entry point for span logging - decides what to show
 */
export function logSpanToConsole(span: any, operation: string): void {
  try {
    // Filter out span lifecycle noise completely
    if (operation.includes('STARTED') || operation.includes('COMPLETED')) {
      return;
    }

    // Only show meaningful AI workflow events
    if (span.name === 'conversation') {
      handleConversationFlow(span, operation);
    } else if (span.name === 'user.message') {
      handleUserMessage(span, operation);
    } else if (span.name === 'tool.call') {
      handleToolCall(span, operation);
    } else if (span.name === 'tool.result') {
      handleToolResult(span, operation);
    } else if (span.name === 'assistant.message') {
      handleAssistantResponse(span, operation);
    }
  } catch (error) {
    console.error('[AI-TRACE] Logging failed:', error);
  }
}

/**
 * Handle conversation start/end
 */
function handleConversationFlow(span: any, operation: string): void {
  if (operation.includes('CONVERSATION STARTED')) {
    conversationActive = true;
    const attributes = span.attributes || {};
    const sessionId = attributes['session.id'] || 'unknown';
    
    console.log('\n' + '═'.repeat(80));
    console.log(`🗣️  NEW CONVERSATION`);
    console.log(`📅 Time: ${new Date().toLocaleTimeString()}`);
    console.log(`🔗 Session: ${sessionId.substring(0, 12)}...`);
    console.log('═'.repeat(80));
  } else if (operation.includes('CONVERSATION') && conversationActive) {
    console.log('\n' + '═'.repeat(80));
    console.log(`✅ CONVERSATION ENDED`);
    console.log('═'.repeat(80) + '\n');
    conversationActive = false;
    currentToolCalls.clear();
  }
}

/**
 * Handle user message with full content
 */
function handleUserMessage(span: any, operation: string): void {
  if (!conversationActive) return;

  // Extract user message from the operation string
  const messageMatch = operation.match(/USER MESSAGE STARTED: "(.*?)"/);
  const userMessage = messageMatch ? messageMatch[1] : 'Unknown message';
  
  console.log(`\n┌─ USER MESSAGE ─────────────────────────────────────────────┐`);
  console.log(`│ ${userMessage.padEnd(59)} │`);
  console.log(`└────────────────────────────────────────────────────────────┘`);
}

/**
 * Handle detailed tool call with complete parameter analysis
 */
function handleToolCall(span: any, operation: string): void {
  if (!conversationActive) return;

  const attributes = span.attributes || {};
  const toolName = attributes['tool.name'] || 'Unknown Tool';
  const timestamp = new Date().toLocaleTimeString();

  console.log(`\n╔══ TOOL CALL: ${toolName} ${'═'.repeat(Math.max(0, 48 - toolName.length))}╗`);
  console.log(`║ ⏰ Time: ${timestamp.padEnd(55)} ║`);
  console.log(`║ 🤖 Agent: Primary Agent${' '.repeat(38)} ║`);
  console.log(`║${' '.repeat(62)}║`);
  
  // Show all parameters with filled/empty analysis
  console.log(`║ PARAMETERS ANALYSIS:${' '.repeat(41)} ║`);
  
  // Get all tool input attributes
  const inputParams: Record<string, any> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (key.startsWith('tool.input.')) {
      const paramName = key.substring('tool.input.'.length);
      inputParams[paramName] = value;
    }
  });

  // Display each parameter with detailed analysis
  if (Object.keys(inputParams).length > 0) {
    Object.entries(inputParams).forEach(([paramName, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Parameter has a value
        if (paramName === 'tasks' && typeof value === 'string' && value.startsWith('[')) {
          // Handle task arrays specially
          try {
            const parsed = JSON.parse(value);
            console.log(`║ ✅ ${paramName}: [Array with ${parsed.length} items]${' '.repeat(Math.max(0, 25 - paramName.length - parsed.length.toString().length))} ║`);
            parsed.forEach((task: any, index: number) => {
              console.log(`║    [${index}] title: "${truncateString(task.title || 'No title', 40)}"${' '.repeat(Math.max(0, 15 - (task.title || 'No title').length))} ║`);
              console.log(`║        description: "${truncateString(task.description || '(empty)', 35)}"${' '.repeat(Math.max(0, 10 - (task.description || '(empty)').length))} ║`);
              console.log(`║        priority: ${task.priority || '(empty)'}${' '.repeat(Math.max(0, 43 - (task.priority ? task.priority.toString().length : 7)))} ║`);
              console.log(`║        projectId: ${task.projectId || '(empty)'}${' '.repeat(Math.max(0, 41 - (task.projectId || '(empty)').length))} ║`);
              console.log(`║        dueDate: ${task.dueDate || '(empty)'}${' '.repeat(Math.max(0, 43 - (task.dueDate || '(empty)').length))} ║`);
              console.log(`║        labels: ${task.labels || '(empty)'}${' '.repeat(Math.max(0, 45 - (task.labels || '(empty)').length))} ║`);
              if (index < parsed.length - 1) {
                console.log(`║${' '.repeat(62)}║`);
              }
            });
          } catch {
            console.log(`║ ✅ ${paramName}: ${truncateString(value.toString(), 50)}${' '.repeat(Math.max(0, 10 - paramName.length))} ║`);
          }
        } else {
          // Regular parameter display
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
          console.log(`║ ✅ ${paramName}: ${truncateString(displayValue, 50 - paramName.length)}${' '.repeat(Math.max(0, 10 - paramName.length))} ║`);
        }
      } else {
        // Parameter is empty
        console.log(`║ ❌ ${paramName}: (empty)${' '.repeat(Math.max(0, 46 - paramName.length))} ║`);
      }
    });
  } else {
    console.log(`║ ⚠️  No parameters captured${' '.repeat(35)} ║`);
  }

  // Store tool call data for result matching
  currentToolCalls.set(toolName, {
    span,
    timestamp,
    startTime: Date.now()
  });

  console.log(`║${' '.repeat(62)}║`);
  console.log(`║ ⏳ Executing...${' '.repeat(46)} ║`);
  console.log(`╚${'═'.repeat(62)}╝`);
}

/**
 * Handle tool results with execution details
 */
function handleToolResult(span: any, operation: string): void {
  if (!conversationActive) return;

  const attributes = span.attributes || {};
  const toolName = attributes['tool.name'] || 'Unknown Tool';
  const success = attributes['tool.result.success'];
  const output = attributes['tool.result.output'];
  
  // Get the stored tool call info
  const toolCallInfo = currentToolCalls.get(toolName);
  const executionTime = toolCallInfo ? Date.now() - toolCallInfo.startTime : 0;

  console.log(`\n╔══ RESULT: ${toolName} ${'═'.repeat(Math.max(0, 51 - toolName.length))}╗`);
  console.log(`║ ${success ? '✅ Success' : '❌ Failed'}${' '.repeat(success ? 51 : 52)} ║`);
  console.log(`║ ⏱️  Execution Time: ${executionTime}ms${' '.repeat(Math.max(0, 40 - executionTime.toString().length))} ║`);
  console.log(`║${' '.repeat(62)}║`);
  
  // Parse and display result details
  if (output) {
    try {
      const parsed = typeof output === 'string' ? JSON.parse(output) : output;
      
      if (parsed.successful !== undefined && parsed.failed !== undefined) {
        // Batch operation result
        console.log(`║ BATCH OPERATION SUMMARY:${' '.repeat(37)} ║`);
        console.log(`║ • Successful: ${parsed.successful}${' '.repeat(Math.max(0, 44 - parsed.successful.toString().length))} ║`);
        console.log(`║ • Failed: ${parsed.failed}${' '.repeat(Math.max(0, 48 - parsed.failed.toString().length))} ║`);
        console.log(`║ • Total: ${parsed.total}${' '.repeat(Math.max(0, 49 - parsed.total.toString().length))} ║`);
        
        if (parsed.successful > 0 && parsed.successful.length > 0) {
          console.log(`║${' '.repeat(62)}║`);
          console.log(`║ CREATED ITEMS:${' '.repeat(48)} ║`);
          const successfulItems = Array.isArray(parsed.successful) ? parsed.successful : [];
          successfulItems.slice(0, 5).forEach((item: any) => {
            const id = item.realId || item.id || 'Unknown ID';
            const title = item.title || 'No title';
            console.log(`║ • ${truncateString(id, 12)}: ${truncateString(title, 40)}${' '.repeat(Math.max(0, 6 - id.length))} ║`);
          });
          if (successfulItems.length > 5) {
            console.log(`║ • ... and ${successfulItems.length - 5} more items${' '.repeat(Math.max(0, 28 - (successfulItems.length - 5).toString().length))} ║`);
          }
        }
      } else {
        // Regular result display
        const resultText = typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed.toString();
        const lines = resultText.split('\n').slice(0, 8); // Show first 8 lines
        
        console.log(`║ RESULT DATA:${' '.repeat(50)} ║`);
        lines.forEach((line: string) => {
          console.log(`║ ${truncateString(line, 60)}${' '.repeat(Math.max(0, 61 - line.length))} ║`);
        });
        
        if (resultText.split('\n').length > 8) {
          console.log(`║ ... (${resultText.split('\n').length - 8} more lines truncated)${' '.repeat(Math.max(0, 23 - (resultText.split('\n').length - 8).toString().length))} ║`);
        }
      }
    } catch {
      // Show raw output if parsing fails
      const outputStr = output.toString();
      console.log(`║ RAW OUTPUT:${' '.repeat(51)} ║`);
      console.log(`║ ${truncateString(outputStr, 60)}${' '.repeat(Math.max(0, 61 - outputStr.length))} ║`);
    }
  }

  console.log(`╚${'═'.repeat(62)}╝`);
  
  // Clean up stored tool call
  currentToolCalls.delete(toolName);
}

/**
 * Handle assistant final response
 */
function handleAssistantResponse(span: any, operation: string): void {
  if (!conversationActive) return;

  const attributes = span.attributes || {};
  const model = attributes['model.name'] || 'unknown';
  
  console.log(`\n┌─ ASSISTANT RESPONSE ───────────────────────────────────────┐`);
  console.log(`│ 🤖 Model: ${model}${' '.repeat(Math.max(0, 49 - model.length))} │`);
  console.log(`└────────────────────────────────────────────────────────────┘`);
}

/**
 * Handle subagent delegation (called from taskTool)
 */
export function logSubagentCall(params: {
  subagentType: string;
  systemPrompt: string;
  userMessage: string;
  conversationHistory: any[];
  timestamp?: string;
}): void {
  if (!conversationActive) return;

  const timestamp = params.timestamp || new Date().toLocaleTimeString();

  console.log(`\n╔══ SUBAGENT: ${params.subagentType} Agent ${'═'.repeat(Math.max(0, 35 - params.subagentType.length))}╗`);
  console.log(`║ ⏰ Time: ${timestamp}${' '.repeat(Math.max(0, 53 - timestamp.length))} ║`);
  console.log(`║ 📤 Called by: Primary Agent${' '.repeat(34)} ║`);
  console.log(`║${' '.repeat(62)}║`);
  
  // Show system prompt (truncated)
  console.log(`║ SYSTEM PROMPT:${' '.repeat(48)} ║`);
  const promptLines = params.systemPrompt.split('\n').slice(0, 5);
  promptLines.forEach(line => {
    console.log(`║ ${truncateString(line.trim(), 60)}${' '.repeat(Math.max(0, 61 - line.trim().length))} ║`);
  });
  if (params.systemPrompt.split('\n').length > 5) {
    const remainingLines = params.systemPrompt.split('\n').length - 5;
    console.log(`║ ... (${remainingLines} more lines)${' '.repeat(Math.max(0, 41 - remainingLines.toString().length))} ║`);
  }
  
  console.log(`║${' '.repeat(62)}║`);
  
  // Show user message
  console.log(`║ USER REQUEST:${' '.repeat(49)} ║`);
  const messageLines = params.userMessage.split('\n').slice(0, 3);
  messageLines.forEach(line => {
    console.log(`║ ${truncateString(line.trim(), 60)}${' '.repeat(Math.max(0, 61 - line.trim().length))} ║`);
  });
  if (params.userMessage.split('\n').length > 3) {
    const remainingLines = params.userMessage.split('\n').length - 3;
    console.log(`║ ... (${remainingLines} more lines)${' '.repeat(Math.max(0, 41 - remainingLines.toString().length))} ║`);
  }
  
  console.log(`║${' '.repeat(62)}║`);
  
  // Show conversation history summary
  console.log(`║ CONVERSATION HISTORY: [${params.conversationHistory.length} messages]${' '.repeat(Math.max(0, 27 - params.conversationHistory.length.toString().length))} ║`);
  params.conversationHistory.slice(-3).forEach((msg, index) => {
    const role = msg.role || 'unknown';
    const content = msg.content || msg.message || 'No content';
    const preview = truncateString(content.toString(), 45);
    console.log(`║ [${index + 1}] ${role}: "${preview}"${' '.repeat(Math.max(0, 10 - role.length - preview.length))} ║`);
  });
  if (params.conversationHistory.length > 3) {
    console.log(`║ ... (${params.conversationHistory.length - 3} earlier messages)${' '.repeat(Math.max(0, 27 - (params.conversationHistory.length - 3).toString().length))} ║`);
  }
  
  console.log(`║${' '.repeat(62)}║`);
  console.log(`║ 🔄 Processing...${' '.repeat(45)} ║`);
  console.log(`╚${'═'.repeat(62)}╝`);
}

/**
 * Handle subagent response
 */
export function logSubagentResponse(params: {
  subagentType: string;
  response: string;
  executionTime?: number;
}): void {
  if (!conversationActive) return;

  const executionTime = params.executionTime || 0;

  console.log(`\n╔══ ${params.subagentType} AGENT RESPONSE ${'═'.repeat(Math.max(0, 35 - params.subagentType.length))}╗`);
  console.log(`║ ⏱️  Execution Time: ${executionTime}ms${' '.repeat(Math.max(0, 40 - executionTime.toString().length))} ║`);
  console.log(`║${' '.repeat(62)}║`);
  
  console.log(`║ AGENT ANALYSIS:${' '.repeat(47)} ║`);
  const responseLines = params.response.split('\n').slice(0, 10);
  responseLines.forEach(line => {
    console.log(`║ ${truncateString(line.trim(), 60)}${' '.repeat(Math.max(0, 61 - line.trim().length))} ║`);
  });
  if (params.response.split('\n').length > 10) {
    const remainingLines = params.response.split('\n').length - 10;
    console.log(`║ ... (${remainingLines} more lines)${' '.repeat(Math.max(0, 41 - remainingLines.toString().length))} ║`);
  }
  
  console.log(`╚${'═'.repeat(62)}╝`);
}

/**
 * Helper function to truncate strings for display
 */
function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Legacy functions for compatibility - now filter out noise
 */
export function createConsoleExporter() {
  return {
    export: (spans: any[]) => {
      // Skip span-based logging entirely - we handle this in real-time
    }
  };
}

export function logTraceSummary(spans: any[]): void {
  // Skip trace summaries - they add noise
}