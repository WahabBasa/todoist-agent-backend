"use node";

import { httpAction } from "./_generated/server";
import { PersistentTextStreaming, StreamId } from "@convex-dev/persistent-text-streaming";
import { streamText, ModelMessage, convertToModelMessages, UIMessage, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

// Declare the components global that Convex provides when app is configured with components
declare const components: any;

// Initialize the persistent text streaming component for Node.js runtime
const persistentTextStreaming = new PersistentTextStreaming(
  components.persistentTextStreaming
);

// Simple tools for basic functionality
const plannerTools = {
  createTask: tool({
    description: "Create a new task in the user's Todoist account",
    inputSchema: z.object({
      title: z.string().describe("The task title"),
      projectId: z.string().optional().describe("Optional project ID"),
    }),
  }),
};

// Simple system prompt for AI responses
function getSystemPrompt(): string {
  return "You are an intelligent executive assistant that helps users manage their personal and professional tasks and projects efficiently.";
}

// Convert Convex messages to AI SDK model format
function convertConvexMessagesToModel(
  history: {
    role: "user" | "assistant" | "tool";
    content?: string;
    toolCalls?: { name: string; args: any; toolCallId: string }[];
    toolResults?: { toolCallId: string; toolName?: string; result: any }[];
    timestamp?: number;
  }[]
): ModelMessage[] {
  const uiMessages: UIMessage[] = [];
  
  // Group messages by conversation flow (user -> assistant -> tool results)
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    
    try {
      if (message.role === "user" && message.content && typeof message.content === 'string') {
        uiMessages.push({
          id: `user-${i}`,
          role: "user",
          parts: [{
            type: "text",
            text: message.content
          }]
        });
      }
      
      else if (message.role === "assistant") {
        const parts: UIMessage["parts"] = [];
        
        // Add text content if present
        if (message.content && typeof message.content === 'string') {
          parts.push({
            type: "text",
            text: message.content
          });
        }
        
        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const tc of message.toolCalls) {
            if (tc.toolCallId && tc.name) {
              // Find corresponding tool result in the next tool message
              const nextToolMsg = history.find((h, idx) => 
                idx > i && h.role === "tool" && 
                h.toolResults?.some(tr => tr.toolCallId === tc.toolCallId)
              );
              
              const toolResult = nextToolMsg?.toolResults?.find(tr => tr.toolCallId === tc.toolCallId);
              
              if (toolResult) {
                parts.push({
                  type: `tool-${tc.name}` as `tool-${string}`,
                  state: "output-available",
                  toolCallId: tc.toolCallId,
                  input: tc.args || {},
                  output: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result)
                });
              }
            }
          }
        }
        
        if (parts.length > 0) {
          uiMessages.push({
            id: `assistant-${i}`,
            role: "assistant",
            parts
          });
        }
      }
      
      // Skip tool messages as they're handled above with assistant messages
      
    } catch (error) {
      console.warn('[CONVERSION] Skipping invalid message:', error);
      continue;
    }
  }
  
  // Use AI SDK's conversion function
  return convertToModelMessages(uiMessages);
}

/**
 * HTTP action for streaming chat content using persistent text streaming component
 * This action generates AI responses and streams them to the client while persisting to database
 */
export const streamChat = httpAction(async (ctx, request) => {
  console.log('[STREAMING_CHAT] HTTP action started');
  
  const body = (await request.json()) as {
    streamId: string;
    message?: string;
    sessionId?: string;
    useHaiku?: boolean;
  };
  
  console.log('[STREAMING_CHAT] Request body:', {
    streamId: body.streamId?.substring(0, 20) + '...',
    hasMessage: !!body.message,
    sessionId: body.sessionId,
    useHaiku: body.useHaiku
  });

  // Generate chat function that integrates with our AI system
  const generateChat = async (ctx: any, request: Request, streamId: StreamId, chunkAppender: (chunk: string) => Promise<void>) => {
    console.log('[STREAMING_CHAT] Starting AI generation');
    
    try {
      // Get user authentication context
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required for streaming");
      }
      
      const userId = identity.tokenIdentifier;
      console.log(`[STREAMING_CHAT] Authenticated user: ${userId.substring(0, 20)}...`);

      // Get the streaming response to find the user message and session info
      const streamingResponse = await ctx.runQuery("chat.getStreamingResponse", { 
        streamId: streamId as unknown as string 
      });
      
      if (!streamingResponse) {
        throw new Error("Streaming response not found");
      }

      const userMessage = streamingResponse.userMessage || body.message || "Hello";
      const sessionId = streamingResponse.sessionId || body.sessionId;

      // Get conversation history - session-aware or default
      let conversation;
      if (sessionId) {
        conversation = await ctx.runQuery("conversations.getConversationBySession", { sessionId });
      } else {
        conversation = await ctx.runQuery("conversations.getConversation");
      }

      const history = (conversation?.messages as any[]) || [];
      
      // Add current user message to history if not already there
      const lastMessage = history[history.length - 1];
      if (!lastMessage || lastMessage.content !== userMessage) {
        history.push({ role: "user", content: userMessage, timestamp: Date.now() });
      }

      // Simple mental model for now
      const mentalModelContent = `
<user_mental_model>
This user prefers direct, efficient task management assistance. Provide clear, actionable responses focused on productivity.
</user_mental_model>`;
      
      // Convert conversation to model format
      let modelMessages: ModelMessage[];
      try {
        modelMessages = convertConvexMessagesToModel(history);
      } catch (error) {
        console.warn('[STREAMING] Message conversion failed, using minimal context:', error);
        modelMessages = [{ role: "user", content: userMessage }];
      }

      // Initialize OpenRouter
      const modelName = body.useHaiku ? "anthropic/claude-3-haiku" : "anthropic/claude-3-haiku";
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      
      // Generate streaming response
      const result = streamText({
        model: openrouter(modelName),
        system: getSystemPrompt() + mentalModelContent,
        messages: modelMessages,
        tools: plannerTools,
      });

      console.log('[STREAMING_CHAT] Starting AI SDK stream processing');
      
      // Process the stream and send chunks to the component
      let accumulatedText = '';
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            accumulatedText += part.text;
            await chunkAppender(part.text);
            break;
            
          case 'tool-call':
            console.log(`[STREAMING_CHAT] Tool call: ${part.toolName}`);
            const toolNotice = `\n🔧 Executing ${part.toolName}...`;
            await chunkAppender(toolNotice);
            break;
            
          case 'tool-result':
            console.log(`[STREAMING_CHAT] Tool result: ${part.toolName}`);
            let resultNotice = "";
            const toolResult = part.output;
            
            if (toolResult && typeof toolResult === 'object' && 'success' in toolResult && toolResult.success) {
              resultNotice = `\n✅ ${part.toolName} completed successfully.`;
            } else if (typeof toolResult === 'string') {
              resultNotice = `\n📝 ${toolResult}`;
            } else if (toolResult && typeof toolResult === 'object') {
              resultNotice = `\n🔧 ${part.toolName} executed.`;
            }
            
            if (resultNotice) {
              await chunkAppender(resultNotice);
            }
            break;
            
          case 'finish':
            console.log('[STREAMING_CHAT] Stream finished');
            break;
        }
      }

      // Get final content and save to conversation
      const finalText = await result.text;
      const finalToolCalls = await result.toolCalls;
      const finalToolResults = await result.toolResults;

      console.log('[STREAMING_CHAT] Saving final conversation');
      
      // Save the complete conversation with assistant response
      const newHistory = [
        ...history,
        {
          role: "assistant" as const,
          content: finalText || accumulatedText,
          toolCalls: finalToolCalls?.map((tc: any) => ({
            name: tc.toolName,
            args: tc.args,
            toolCallId: tc.toolCallId
          })),
          toolResults: finalToolResults?.map((tr: any) => ({
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            result: tr.result
          })),
          timestamp: Date.now(),
        }
      ];

      // Save conversation
      await ctx.runMutation("conversations.upsertConversation", {
        sessionId: sessionId,
        messages: newHistory as any
      });

      // Mark streaming response as complete
      await ctx.runMutation("chat.completeStreamingResponse", {
        streamId: streamId as unknown as string,
        finalContent: finalText || accumulatedText,
      });

      console.log('[STREAMING_CHAT] Generation completed successfully');
      
    } catch (error) {
      console.error('[STREAMING_CHAT] Error during generation:', error);
      await chunkAppender(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      throw error;
    }
  };

  // Use the persistent text streaming component to handle the stream
  const response = await persistentTextStreaming.stream(
    ctx,
    request,
    body.streamId as StreamId,
    generateChat
  );

  // Set CORS headers for browser requests
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");

  console.log('[STREAMING_CHAT] HTTP action completed');
  return response;
});