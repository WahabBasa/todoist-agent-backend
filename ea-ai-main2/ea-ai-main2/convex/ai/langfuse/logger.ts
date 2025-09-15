import { getLangfuseClient } from "./client";
import type { Langfuse } from "langfuse";

// Type definitions for Langfuse objects
type LangfuseTrace = ReturnType<Langfuse['trace']>;
type LangfuseSpan = ReturnType<Langfuse['span']>;
type LangfuseGeneration = ReturnType<Langfuse['generation']>;

/**
 * Langfuse Cloud Logger for TaskAI
 * Comprehensive AI workflow tracing with detailed visibility into:
 * - System prompts and AI decision steps
 * - Subagent context and delegation
 * - Tool calls with complete parameter analysis
 * - All filled vs empty parameters
 */

// Global trace and span tracking
let currentTrace: LangfuseTrace | null = null;
let currentSpans: Map<string, LangfuseSpan> = new Map();
let currentGeneration: LangfuseGeneration | null = null;

export interface ConversationParams {
  sessionId: string;
  userId: string;
}

export interface UserMessageParams {
  sessionId: string;
  userId: string;
  message: string;
}

export interface PromptParams {
  model: string;
  systemPrompt: string;
  messageCount: number;
  sessionId: string;
  userId: string;
  messages?: any[];
}

export interface ToolCallParams {
  toolName: string;
  input: Record<string, any>;
  sessionId: string;
  userId: string;
}

export interface ToolResultParams {
  toolName: string;
  output: any;
  success: boolean;
  sessionId: string;
  userId: string;
}

export interface AssistantMessageParams {
  sessionId: string;
  userId: string;
  message: string;
  model: string;
}

export interface SubagentCallParams {
  subagentType: string;
  systemPrompt: string;
  userMessage: string;
  conversationHistory: any[];
  timestamp?: string;
}

export interface SubagentResponseParams {
  subagentType: string;
  response: string;
  executionTime?: number;
}

/**
 * Create a new conversation trace
 */
export function createConversationTrace(params: ConversationParams): LangfuseTrace {
  const langfuse = getLangfuseClient();
  
  currentTrace = langfuse.trace({
    name: "ai-conversation",
    id: `conversation-${params.sessionId}-${Date.now()}`,
    metadata: {
      sessionId: params.sessionId,
      userId: params.userId,
      timestamp: new Date().toISOString(),
      type: "conversation"
    },
    tags: ["conversation", "taskai"]
  });

  console.log(`🚀 [LANGFUSE] Started conversation trace: ${currentTrace.id}`);
  return currentTrace;
}

/**
 * Create user message span
 */
export function createUserMessageSpan(params: UserMessageParams): LangfuseSpan {
  if (!currentTrace) {
    throw new Error("No active trace for user message");
  }

  const span = currentTrace.span({
    name: "user-message",
    metadata: {
      sessionId: params.sessionId,
      userId: params.userId,
      message: params.message,
      messageLength: params.message.length,
      timestamp: new Date().toISOString()
    },
    input: {
      message: params.message
    }
  });

  currentSpans.set("user-message", span);
  console.log(`💬 [LANGFUSE] User message: "${params.message.substring(0, 50)}..."`);
  return span;
}

/**
 * Create AI prompt generation with full system prompt visibility
 */
export function createPromptGeneration(params: PromptParams): LangfuseGeneration {
  if (!currentTrace) {
    throw new Error("No active trace for prompt generation");
  }

  currentGeneration = currentTrace.generation({
    name: "ai-prompt-generation",
    model: params.model,
    input: params.messages || [
      { role: "system", content: params.systemPrompt }
    ],
    metadata: {
      sessionId: params.sessionId,
      userId: params.userId,
      systemPromptLength: params.systemPrompt.length,
      messageCount: params.messageCount,
      timestamp: new Date().toISOString(),
      systemPromptPreview: params.systemPrompt.substring(0, 200) + "..."
    }
  });

  // Log the complete system prompt for visibility
  console.log(`🧠 [LANGFUSE] AI Generation Started`);
  console.log(`📋 [LANGFUSE] System Prompt (${params.systemPrompt.length} chars):`);
  console.log(`─`.repeat(60));
  console.log(params.systemPrompt.substring(0, 500) + (params.systemPrompt.length > 500 ? "..." : ""));
  console.log(`─`.repeat(60));
  console.log(`🔢 [LANGFUSE] Model: ${params.model} | Messages: ${params.messageCount}`);

  return currentGeneration;
}

/**
 * Update prompt generation with response and usage
 */
export function updatePromptGeneration(
  response: string,
  toolCalls: any[],
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
): void {
  if (!currentGeneration) {
    console.warn("⚠️ [LANGFUSE] No active generation to update");
    return;
  }

  currentGeneration.update({
    output: response,
    usage: {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.totalTokens
    },
    metadata: {
      toolCallCount: toolCalls.length,
      responseLength: response.length,
      completedAt: new Date().toISOString()
    }
  });

  console.log(`✅ [LANGFUSE] AI Generation Complete - ${usage.totalTokens} tokens used`);
  console.log(`📄 [LANGFUSE] Response (${response.length} chars): "${response.substring(0, 100)}..."`);
  
  if (toolCalls.length > 0) {
    console.log(`🔧 [LANGFUSE] Tool calls made: ${toolCalls.length}`);
    toolCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.toolName}: ${JSON.stringify(call.input).substring(0, 100)}...`);
    });
  }
}

/**
 * Create detailed tool call span with parameter analysis
 */
export function createToolCallSpan(params: ToolCallParams): LangfuseSpan {
  if (!currentTrace) {
    throw new Error("No active trace for tool call");
  }

  // Analyze parameters - which are filled vs empty
  const parameterAnalysis: Record<string, any> = {};
  const filledParams: string[] = [];
  const emptyParams: string[] = [];

  Object.entries(params.input).forEach(([key, value]) => {
    parameterAnalysis[key] = {
      value: value,
      filled: value !== undefined && value !== null && value !== "",
      type: typeof value
    };

    if (value !== undefined && value !== null && value !== "") {
      filledParams.push(key);
    } else {
      emptyParams.push(key);
    }
  });

  const span = currentTrace.span({
    name: `tool-call-${params.toolName}`,
    input: params.input,
    metadata: {
      toolName: params.toolName,
      sessionId: params.sessionId,
      userId: params.userId,
      parameterAnalysis,
      filledParameters: filledParams,
      emptyParameters: emptyParams,
      parameterCount: Object.keys(params.input).length,
      timestamp: new Date().toISOString()
    }
  });

  currentSpans.set(`tool-${params.toolName}`, span);

  // Detailed console logging for immediate visibility
  console.log(`

🔧 [LANGFUSE] Tool Call: ${params.toolName}`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
  console.log(`📊 Parameter Analysis:`);
  
  Object.entries(parameterAnalysis).forEach(([key, analysis]) => {
    const status = analysis.filled ? "✅" : "❌";
    const displayValue = analysis.filled 
      ? (typeof analysis.value === 'object' 
          ? JSON.stringify(analysis.value).substring(0, 50) + "..." 
          : analysis.value.toString().substring(0, 50))
      : "(empty)";
    
    console.log(`  ${status} ${key}: ${displayValue}`);
  });

  console.log(`📈 Summary: ${filledParams.length} filled, ${emptyParams.length} empty`);
  return span;
}

/**
 * Create tool result span
 */
export function createToolResultSpan(params: ToolResultParams): LangfuseSpan {
  if (!currentTrace) {
    throw new Error("No active trace for tool result");
  }

  const span = currentTrace.span({
    name: `tool-result-${params.toolName}`,
    output: params.output,
    metadata: {
      toolName: params.toolName,
      success: params.success,
      sessionId: params.sessionId,
      userId: params.userId,
      timestamp: new Date().toISOString(),
      outputType: typeof params.output,
      outputSize: typeof params.output === 'string' ? params.output.length : JSON.stringify(params.output).length
    }
  });

  currentSpans.set(`tool-result-${params.toolName}`, span);

  console.log(`

✅ [LANGFUSE] Tool Result: ${params.toolName}`);
  console.log(`🎯 Success: ${params.success}`);
  console.log(`📤 Output: ${typeof params.output === 'string' 
    ? params.output.substring(0, 100) + "..." 
    : JSON.stringify(params.output).substring(0, 100) + "..."}`);

  return span;
}

/**
 * Create assistant message span
 */
export function createAssistantMessageSpan(params: AssistantMessageParams): LangfuseSpan {
  if (!currentTrace) {
    throw new Error("No active trace for assistant message");
  }

  const span = currentTrace.span({
    name: "assistant-message",
    output: params.message,
    metadata: {
      sessionId: params.sessionId,
      userId: params.userId,
      model: params.model,
      messageLength: params.message.length,
      timestamp: new Date().toISOString()
    }
  });

  currentSpans.set("assistant-message", span);
  console.log(`🤖 [LANGFUSE] Assistant response: "${params.message.substring(0, 100)}..."`);
  return span;
}

/**
 * Log subagent delegation with full context visibility
 */
export function logSubagentCall(params: SubagentCallParams): LangfuseSpan {
  if (!currentTrace) {
    throw new Error("No active trace for subagent call");
  }

  const span = currentTrace.span({
    name: `subagent-call-${params.subagentType}`,
    input: {
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      conversationHistory: params.conversationHistory
    },
    metadata: {
      subagentType: params.subagentType,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength: params.userMessage.length,
      historyMessageCount: params.conversationHistory.length,
      timestamp: params.timestamp || new Date().toISOString()
    }
  });

  currentSpans.set(`subagent-${params.subagentType}`, span);

  // Comprehensive console logging for subagent visibility
  console.log(`

🤖 [LANGFUSE] Subagent Call: ${params.subagentType} Agent`);
  console.log(`⏰ Time: ${params.timestamp || new Date().toLocaleTimeString()}`);
  console.log(`📋 System Prompt (${params.systemPrompt.length} chars):`);
  console.log(`─`.repeat(50));
  console.log(params.systemPrompt.substring(0, 300) + (params.systemPrompt.length > 300 ? "..." : ""));
  console.log(`─`.repeat(50));
  console.log(`💬 User Message: "${params.userMessage.substring(0, 100)}..."`);
  console.log(`📚 Context: ${params.conversationHistory.length} messages`);
  
  if (params.conversationHistory.length > 0) {
    console.log(`📖 Recent context:`);
    params.conversationHistory.slice(-3).forEach((msg, index) => {
      const content = msg.content || msg.message || 'No content';
      console.log(`  ${index + 1}. ${msg.role}: "${content.toString().substring(0, 60)}..."`);
    });
  }

  return span;
}

/**
 * Log subagent response
 */
export function logSubagentResponse(params: SubagentResponseParams): void {
  const spanKey = `subagent-${params.subagentType}`;
  const span = currentSpans.get(spanKey);
  
  if (span) {
    span.update({
      output: params.response,
      metadata: {
        executionTime: params.executionTime,
        responseLength: params.response.length,
        completedAt: new Date().toISOString()
      }
    });
  }

  console.log(`

✅ [LANGFUSE] ${params.subagentType} Agent Response`);
  console.log(`⏱️ Execution: ${params.executionTime}ms`);
  console.log(`📄 Response (${params.response.length} chars):`);
  console.log(`─`.repeat(50));
  console.log(params.response.substring(0, 400) + (params.response.length > 400 ? "..." : ""));
  console.log(`─`.repeat(50));
}

/**
 * End conversation trace and flush to Langfuse Cloud
 */
export async function endConversation(finalData?: {
  response?: string;
  toolCalls?: number;
  toolResults?: number;
  tokens?: { input: number; output: number; total: number };
}): Promise<void> {
  if (currentTrace) {
    if (finalData) {
      currentTrace.update({
        output: finalData.response,
        metadata: {
          toolCallCount: finalData.toolCalls,
          toolResultCount: finalData.toolResults,
          totalTokens: finalData.tokens?.total,
          inputTokens: finalData.tokens?.input,
          outputTokens: finalData.tokens?.output,
          completedAt: new Date().toISOString()
        }
      });
    }

    console.log(`🏁 [LANGFUSE] Conversation completed - flushing to cloud...`);
    
    // Flush to Langfuse Cloud
    const langfuse = getLangfuseClient();
    await langfuse.flushAsync();
    
    console.log(`☁️ [LANGFUSE] Data successfully sent to Langfuse Cloud`);
  }

  // Clean up state
  currentTrace = null;
  currentSpans.clear();
  currentGeneration = null;
}

/**
 * End a specific span
 */
export function endSpan(spanKey: string): void {
  const span = currentSpans.get(spanKey);
  if (span) {
    span.end();
    currentSpans.delete(spanKey);
  }
}

/**
 * Get current trace for external access
 */
export function getCurrentTrace(): LangfuseTrace | null {
  return currentTrace;
}