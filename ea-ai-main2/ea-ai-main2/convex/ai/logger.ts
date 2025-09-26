/**
 * Enhanced, structured logging system for TaskAI
 * 
 * Features:
 * - Consistent format across all log types with distinctive emojis
 * - Enhanced active mode visibility with session tracking
 * - Final response logging with comprehensive metrics
 * - Environment-based log level control (off, error, info, debug)
 * - Production-ready log sampling to reduce noise
 * - Session-aware logging for multi-session debugging
 * 
 * Environment Variables:
 * - TASKAI_LOG_LEVEL: off, error, info, debug (default: info)
 * - TASKAI_LOG_SAMPLING_RATE: 0.0-1.0 (default: 1.0, production sampling)
 * - NODE_ENV: production mode enables additional optimizations
 * 
 * Log Categories:
 * - 🎯 MODE: Active mode and mode switches with enhanced visibility
 * - 👤 USER: User messages (truncated, session-aware)
 * - 🔧 TOOLS: AI tool calls in summary format
 * - ✨ RESPONSE: Final AI responses with metrics
 * - 🚀 SESSION: Session start/end tracking
 * - 📋 TODOS: Internal todos state changes
 * - 🔍 DEBUG: Debug information (debug level only)
 * - ⚠️ ERROR: Errors and warnings with context
 */

// Environment-based log level control with production optimizations
const LOG_LEVEL = process.env.LOG_LEVEL || "info"; // off, error, info, debug
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_SAMPLING_RATE = parseFloat(process.env.TASKAI_LOG_SAMPLING_RATE || "1.0"); // 0.0-1.0

const isLoggingEnabled = (level: string): boolean => {
  const levels = { off: 0, error: 1, info: 2, debug: 3 };
  const currentLevel = levels[LOG_LEVEL as keyof typeof levels] || 2;
  const requestedLevel = levels[level as keyof typeof levels] || 2;
  
  // In production, reduce debug logging by default
  if (IS_PRODUCTION && level === "debug" && LOG_LEVEL === "info") {
    return false;
  }
  
  return requestedLevel <= currentLevel;
};

// Log sampling for high-volume events in production
const shouldSampleLog = (level: string): boolean => {
  if (!IS_PRODUCTION || LOG_SAMPLING_RATE >= 1.0) return true;
  if (level === "error") return true; // Always log errors
  return Math.random() < LOG_SAMPLING_RATE;
};

// Utility function to format timestamp
const timestamp = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// Utility function to truncate text
const truncate = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
};

/**
 * Log mode switches (only when not primary mode)
 */
export function logModeSwitch(fromMode: string, toMode: string, reason?: string, sessionId?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const reasonText = reason ? ` (${reason})` : "";
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  
  // Enhanced mode switching visibility
  if (toMode === "primary") {
    console.log(`🔙 [MODE] ${timestamp()}${sessionText} RETURN: ${fromMode} → ${toMode.toUpperCase()}${reasonText}`);
  } else {
    console.log(`🔄 [MODE] ${timestamp()}${sessionText} SWITCH: ${fromMode} → ${toMode.toUpperCase()}${reasonText}`);
  }
}

/**
 * Log current active mode (always show what mode is active)
 */
export function logCurrentMode(modeName: string, toolCount?: number, context?: string, sessionId?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const toolText = toolCount !== undefined ? ` (${toolCount} tools)` : "";
  const contextText = context ? ` - ${context}` : "";
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  
  // Enhanced mode visibility with distinctive indicators
  if (modeName === "primary") {
    console.log(`🎯 [MODE] ${timestamp()}${sessionText} ACTIVE: ${modeName.toUpperCase()}${toolText}${contextText}`);
  } else {
    console.log(`🔄 [MODE] ${timestamp()}${sessionText} ACTIVE: ${modeName.toUpperCase()}${toolText}${contextText}`);
  }
}

/**
 * Log user messages with clean formatting
 */
export function logUserMessage(message: string, sessionId?: string): void {
  if (!isLoggingEnabled("info") || !shouldSampleLog("info")) return;
  
  const truncatedMessage = truncate(message, 60);
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  console.log(`👤 [USER] ${timestamp()}${sessionText} "${truncatedMessage}"`);
}

/**
 * Log AI tool calls in summary format
 */
export function logToolCalls(toolCalls: Array<{name: string, args?: any}>): void {
  if (!isLoggingEnabled("info") || !shouldSampleLog("info")) return;
  if (toolCalls.length === 0) return;
  
  const toolSummaries = toolCalls.map(call => {
    // Create concise parameter summary for common tools
    if (call.name === "createTask" && call.args?.content) {
      return `createTask("${truncate(call.args.content, 30)}")`;
    } else if (call.name === "createBatchTasks" && call.args?.tasks) {
      return `createBatchTasks(${call.args.tasks.length} items)`;
    } else if (call.name === "updateTask" && call.args?.content) {
      return `updateTask("${truncate(call.args.content, 30)}")`;
    } else if (call.name === "planTask" && call.args?.taskContent) {
      return `planTask("${truncate(call.args.taskContent, 30)}")`;
    } else if (call.args && typeof call.args === "object") {
      // Generic parameter summary
      const keyCount = Object.keys(call.args).length;
      return `${call.name}(${keyCount} params)`;
    } else {
      return call.name + "()";
    }
  });
  
  console.log(`🔧 [TOOLS] ${timestamp()} Called: ${toolSummaries.join(", ")}`);
}

/**
 * Log internal todos state changes
 */
export function logTodosState(todos: Array<{status: string, content: string}>, operation: "created" | "updated" | "read" = "read"): void {
  if (!isLoggingEnabled("info")) return;
  if (todos.length === 0) return;
  
  // Count todos by status
  const counts = todos.reduce((acc, todo) => {
    acc[todo.status] = (acc[todo.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Find current active (in_progress) todo
  const activeTodo = todos.find(t => t.status === "in_progress");
  const activeText = activeTodo ? ` | Current: "${truncate(activeTodo.content, 40)}"` : "";
  
  // Format counts
  const statusCounts = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
  
  const operationText = operation === "read" ? "" : ` (${operation})`;
  console.log(`📋 [TODOS] ${timestamp()} Active: ${statusCounts}${activeText}${operationText}`);
}

/**
 * Log errors and warnings
 */
export function logError(error: string | Error, context?: string): void {
  if (!isLoggingEnabled("error")) return;
  
  const errorMessage = error instanceof Error ? error.message : error;
  const contextText = context ? ` [${context}]` : "";
  console.log(`⚠️ [ERROR] ${timestamp()}${contextText} ${errorMessage}`);
}

/**
 * Log when no tools are called (debugging AI behavior)
 */
export function logNoToolsCalled(availableTools: string[], userMessage: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const toolList = availableTools.slice(0, 5).join(", ") + (availableTools.length > 5 ? "..." : "");
  const messageSnippet = truncate(userMessage, 40);
  console.log(`⚠️ [TOOLS] ${timestamp()} No tools called for: "${messageSnippet}" | Available: ${toolList}`);
}

/**
 * Log final AI response with metrics
 */
export function logFinalResponse(response: string, metadata?: {
  toolCalls?: number;
  toolResults?: number;
  tokens?: { input: number; output: number; total: number };
  processingTime?: number;
}, sessionId?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const responseSnippet = truncate(response, 60);
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  
  let metricsText = "";
  if (metadata) {
    const parts = [];
    if (metadata.toolCalls !== undefined) parts.push(`${metadata.toolCalls} tools`);
    if (metadata.tokens) parts.push(`${metadata.tokens.total} tokens`);
    if (metadata.processingTime) parts.push(`${metadata.processingTime}ms`);
    metricsText = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  }
  
  console.log(`✨ [RESPONSE] ${timestamp()}${sessionText} "${responseSnippet}"${metricsText}`);
}

/**
 * Log a general step or milestone
 */
export function logStep(details: string, todos?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  let todosText = "";
  if (todos && (LOG_LEVEL === "info" || LOG_LEVEL === "debug")) {
    todosText = `\n${todos}`;
  }
  
  console.log(`📋 [STEP] ${timestamp()} ${details}${todosText}`);
}


/**
 * Log tool execution summary
 */
export function logToolExec(tool: string, argsSummary: string): void {
  if (LOG_LEVEL === "error") return; // Suppress unless error level allows info
  
  console.log(`🔧 [TOOL] ${timestamp()} ${tool}: ${argsSummary}`);
}


/**
 * Log debug information (only when debug level enabled)
 */
export function logDebug(message: string, data?: any): void {
  if (!isLoggingEnabled("debug") || !shouldSampleLog("debug")) return;
  
  let dataText = "";
  if (data) {
    if (typeof data === "object") {
      const keys = Object.keys(data).slice(0, 3); // Limit to 3 keys
      dataText = ` | ${keys.map(k => `${k}: ${String(data[k]).substring(0, 20)}`).join(", ")}`;
    } else {
      dataText = ` | ${String(data).substring(0, 100)}`;
    }
  }
  console.log(`🔍 [DEBUG] ${timestamp()} ${message}${dataText}`);
}

/**
 * Log session start/end for conversation flow tracking
 */
export function logSession(event: "start" | "end", sessionId?: string, userMessage?: string, activeMode?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  const modeText = activeMode ? ` (${activeMode.toUpperCase()})` : "";
  
  if (event === "start" && userMessage) {
    console.log(`🚀 [SESSION] ${timestamp()}${sessionText}${modeText} Started: "${truncate(userMessage, 50)}"`);
  } else if (event === "end") {
    console.log(`🏁 [SESSION] ${timestamp()}${sessionText}${modeText} Completed`);
  }
}

/**
 * Log warnings (similar to errors but less severe)
 */
export function logWarning(message: string, context?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const contextText = context ? ` [${context}]` : "";
  console.warn(`⚠️ [WARNING] ${timestamp()}${contextText} ${message}`);
}