"use node";

import { streamText, convertToCoreMessages, CoreMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { api } from "./_generated/api";
import { SystemPrompt } from "./ai/system";
import { MessageCaching } from "./ai/caching";
import { convertConvexMessagesToModel } from "./ai/messageConversion";
import { plannerTools } from "./shared/tools";

interface ChatStreamConfig {
  ctx: any;
  messages: any[];
  sessionId?: string;
  authHeader: string;
}


export async function createChatStreamResponse({
  ctx,
  messages,
  sessionId,
  authHeader
}: ChatStreamConfig) {
  try {
    // Initialize OpenRouter
    const openrouter = createOpenRouter({ 
      apiKey: process.env.OPENROUTER_API_KEY 
    });

    // Extract and validate user authentication from JWT token
    let tokenIdentifier: string;
    try {
      // The auth header should contain the Clerk JWT token
      const jwtToken = authHeader.replace("Bearer ", "");
      
      // For HTTP actions, we need to manually decode the user identity
      // In a real implementation, you'd validate the JWT properly
      // For now, we'll use the token as the tokenIdentifier
      tokenIdentifier = jwtToken;
      
      if (!tokenIdentifier || tokenIdentifier.length === 0) {
        throw new Error("Invalid authentication token");
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      return new Response("Unauthorized", { status: 401 });
    }

    // Get conversation history from Convex
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }

    // Get user's mental model from database
    let mentalModelContent: string;
    try {
      const mentalModel = await ctx.runQuery(api.mentalModels.getUserMentalModel, { tokenIdentifier });
      if (mentalModel.exists && mentalModel.content.trim()) {
        mentalModelContent = `
<user_mental_model>
${mentalModel.content}
</user_mental_model>`;
      } else {
        mentalModelContent = `
<user_mental_model>
No user mental model found - AI should create one by observing behavioral patterns in conversation.
Use readUserMentalModel and editUserMentalModel tools to learn and update user preferences.
</user_mental_model>`;
      }
    } catch (error) {
      console.warn("Failed to load mental model:", error);
      mentalModelContent = `
<user_mental_model>
Error loading mental model - AI should use default behavior and attempt to create mental model during conversation.
</user_mental_model>`;
    }

    // Prepare message history
    const history = (conversation?.messages as any[]) || [];
    const allMessages = [...history, ...messages];

    // Convert to model messages
    let modelMessages: any[];
    try {
      modelMessages = convertConvexMessagesToModel(allMessages);
    } catch (error) {
      console.warn('Message conversion failed, using input messages:', error);
      modelMessages = convertToCoreMessages(messages);
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    
    // Initialize caching
    MessageCaching.initializeCaching();

    // Stream the AI response
    const result = streamText({
      model: openrouter("anthropic/claude-3-haiku"),
      system: SystemPrompt.getSystemPrompt(
        "anthropic/claude-3-haiku", 
        "", 
        lastUserMessage, 
        mentalModelContent
      ),
      messages: modelMessages,
      tools: plannerTools
    });

    // Return streaming response with post-stream persistence
    return result.toUIMessageStreamResponse({
      onFinish: async (finishResult) => {
        // Save conversation to Convex after streaming completes
        await saveConversationToConvex(ctx, {
          messages: [...allMessages, {
            role: "assistant",
            content: finishResult.text,
            toolCalls: finishResult.toolCalls,
            timestamp: Date.now()
          }],
          sessionId,
          tokenIdentifier
        });
      }
    });

  } catch (error) {
    console.error("Chat stream error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// Helper function to save conversation after streaming
async function saveConversationToConvex(ctx: any, {
  messages,
  sessionId,
  tokenIdentifier
}: {
  messages: any[];
  sessionId?: string;
  tokenIdentifier: string;
}) {
  try {
    if (sessionId) {
      await ctx.runMutation(api.conversations.upsertConversation, {
        sessionId,
        messages
      });
    } else {
      await ctx.runMutation(api.conversations.upsertConversation, {
        messages
      });
    }

    // Update session title if needed
    if (sessionId && messages.length <= 2) {
      const firstUserMessage = messages.find(m => m.role === "user")?.content;
      if (firstUserMessage) {
        await ctx.runMutation(api.chatSessions.updateChatTitleFromMessage, {
          sessionId,
          message: firstUserMessage
        });
      }
    }

  } catch (error) {
    console.error("Failed to save conversation:", error);
    // Don't throw - streaming already succeeded
  }
}