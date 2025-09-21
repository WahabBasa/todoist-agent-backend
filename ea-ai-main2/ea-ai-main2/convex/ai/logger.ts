/**
 * Clean, structured logging system for TaskAI
 * 
 * Provides organized, color-coded logs for:
 * - Mode switches (when not primary)
 * - User messages (truncated)
 * - AI tool calls (summary format)
 * - Internal todos state
 */

// Environment-based log level control
const LOG_LEVEL = process.env.TASKAI_LOG_LEVEL || "info"; // off, error, info, debug
const isLoggingEnabled = (level: string): boolean => {
  const levels = { off: 0, error: 1, info: 2, debug: 3 };
  const currentLevel = levels[LOG_LEVEL as keyof typeof levels] || 2;
  const requestedLevel = levels[level as keyof typeof levels] || 2;
  return requestedLevel <= currentLevel;
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
export function logModeSwitch(fromMode: string, toMode: string, reason?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  // Only log when switching away from or back to primary
  if (toMode !== "primary" || fromMode !== "primary") {
    const reasonText = reason ? ` (reason: ${reason})` : "";
    if (toMode === "primary") {
      console.log(`✅ [MODE] ${timestamp()} Returned to: ${toMode}`);
    } else {
      console.log(`🎯 [MODE] ${timestamp()} Switched to: ${toMode}${reasonText}`);
    }
  }
}

/**
 * Log current active mode (always show what mode is active)
 */
export function logCurrentMode(modeName: string, toolCount?: number, context?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const toolText = toolCount !== undefined ? ` (${toolCount} tools available)` : "";
  const contextText = context ? ` - ${context}` : "";
  
  if (modeName === "primary") {
    console.log(`🎯 [MODE] ${timestamp()} Active: ${modeName}${toolText}${contextText}`);
  } else {
    console.log(`🎯 [MODE] ${timestamp()} Active: ${modeName}${toolText}${contextText}`);
  }
}

/**
 * Log user messages with clean formatting
 */
export function logUserMessage(message: string, sessionId?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const truncatedMessage = truncate(message, 60);
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  console.log(`👤 [USER] ${timestamp()}${sessionText} "${truncatedMessage}"`);
}

/**
 * Log AI tool calls in summary format
 */
export function logToolCalls(toolCalls: Array<{name: string, args?: any}>): void {
  if (!isLoggingEnabled("info")) return;
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
 * Log debug information (only when debug level enabled)
 */
export function logDebug(message: string, data?: any): void {
  if (!isLoggingEnabled("debug")) return;
  
  const dataText = data ? ` | ${JSON.stringify(data).substring(0, 100)}` : "";
  console.log(`🔍 [DEBUG] ${timestamp()} ${message}${dataText}`);
}

/**
 * Log session start/end for conversation flow tracking
 */
export function logSession(event: "start" | "end", sessionId?: string, userMessage?: string): void {
  if (!isLoggingEnabled("info")) return;
  
  const sessionText = sessionId ? ` [${sessionId.slice(-4)}]` : "";
  if (event === "start" && userMessage) {
    console.log(`🚀 [SESSION] ${timestamp()}${sessionText} Started with: "${truncate(userMessage, 50)}"`);
  } else if (event === "end") {
    console.log(`🏁 [SESSION] ${timestamp()}${sessionText} Completed`);
  }
}