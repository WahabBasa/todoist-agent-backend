import { langfuse } from "./client";
import { trackToolCall, trackToolResult } from "./toolMonitoring";
import { trackMessage, trackConversation, trackConversationResult } from "./messageMonitoring";
import { trackAssistantStep, trackAssistantStepResult } from "./assistantMonitoring";

/**
 * Test Langfuse integration
 */
export async function testLangfuse(): Promise<void> {
  console.log("[Langfuse Test] Starting Langfuse integration test");
  
  try {
    // Test 1: Initialize Langfuse
    console.log("[Langfuse Test] Test 1: Initialize Langfuse");
    // Already initialized in client.ts
    
    // Test 2: Track a message
    console.log("[Langfuse Test] Test 2: Track a message");
    const messageTraceId = trackMessage({
      role: "user",
      content: "Test message",
      userId: "test-user-id",
      sessionId: "test-session-id"
    });
    console.log(`[Langfuse Test] Message trace ID: ${messageTraceId}`);
    
    // Test 3: Track a conversation
    console.log("[Langfuse Test] Test 3: Track a conversation");
    const conversationTraceId = trackConversation([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" }
    ], "test-session-id", "test-user-id");
    console.log(`[Langfuse Test] Conversation trace ID: ${conversationTraceId}`);
    
    // Test 4: Track conversation result
    console.log("[Langfuse Test] Test 4: Track conversation result");
    trackConversationResult(conversationTraceId, "Conversation completed successfully", {
      toolCalls: 0,
      toolResults: 0
    });
    
    // Test 5: Track an assistant step
    console.log("[Langfuse Test] Test 5: Track an assistant step");
    const assistantStepTraceId = trackAssistantStep({
      stepName: "Test Step",
      input: { test: "input" },
      userId: "test-user-id",
      sessionId: "test-session-id",
      model: "test-model"
    });
    console.log(`[Langfuse Test] Assistant step trace ID: ${assistantStepTraceId}`);
    
    // Test 6: Track assistant step result
    console.log("[Langfuse Test] Test 6: Track assistant step result");
    trackAssistantStepResult(assistantStepTraceId, {
      stepName: "Test Step",
      output: "Step completed successfully",
      userId: "test-user-id",
      sessionId: "test-session-id",
      success: true
    });
    
    // Test 7: Track a tool call
    console.log("[Langfuse Test] Test 7: Track a tool call");
    const toolCallTraceId = trackToolCall({
      toolName: "testTool",
      input: { param1: "value1", param2: "value2" },
      userId: "test-user-id",
      sessionId: "test-session-id"
    });
    console.log(`[Langfuse Test] Tool call trace ID: ${toolCallTraceId}`);
    
    // Test 8: Track a tool result
    console.log("[Langfuse Test] Test 8: Track a tool result");
    trackToolResult(toolCallTraceId, {
      toolName: "testTool",
      output: "Tool executed successfully",
      userId: "test-user-id",
      sessionId: "test-session-id",
      success: true
    });
    
    // Test 9: Flush Langfuse client
    console.log("[Langfuse Test] Test 9: Flush Langfuse client");
    await langfuse.flushAsync();
    
    console.log("[Langfuse Test] All tests completed successfully!");
  } catch (error) {
    console.error("[Langfuse Test] Test failed:", error);
    throw error;
  }
}