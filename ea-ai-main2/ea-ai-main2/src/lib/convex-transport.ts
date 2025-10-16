import type { UIMessage as Message } from '@/types/ai-ui';
import { api } from '../../convex/_generated/api';
import { ConvexReactClient } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';

interface ConvexTransportOptions {
  convex: ConvexReactClient;
}

/**
 * Custom transport for Vercel AI SDK that works directly with Convex backend
 * This bridges the gap between Vercel AI SDK and our existing Convex infrastructure
 */
export class ConvexChatTransport {
  private convex: ConvexReactClient;

  constructor({ convex }: ConvexTransportOptions) {
    this.convex = convex;
  }

  async *chatRequest({
    messages,
    data,
    ...requestOptions
  }: {
    messages: Message[];
    data?: object;
    [key: string]: any;
  }) {
    try {
      // Get the last message (user's input)
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Invalid message format: expected user message');
      }

      // Extract session ID from data or options
      const sessionId = (data as any)?.id || (requestOptions as any)?.body?.id;

      // Create time context
      const currentTimeContext = {
        currentTime: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toLocaleString(),
        timestamp: Date.now(),
        source: "convex_transport"
      };

      // Call existing Convex AI action
      const result = await this.convex.action(api.ai.session.chatWithAI, {
        message: lastMessage.content,

        sessionId: sessionId as Id<"chatSessions"> | undefined,
        currentTimeContext
      });

      // Create assistant message in the format expected by AI SDK
      const content: string = String(result?.response ?? result?.text ?? "I'm ready to help!");
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
      };

      // Yield the complete message (simulating streaming)
      // In a real streaming implementation, we'd yield chunks
      yield {
        type: 'text-delta' as const,
        textDelta: assistantMessage.content!
      };

      yield {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: {
          promptTokens: result.metadata?.tokens?.input || 0,
          completionTokens: result.metadata?.tokens?.output || 0,
          totalTokens: result.metadata?.tokens?.total || 0
        }
      };

    } catch (error) {
      console.error('ConvexChatTransport error:', error);
      yield {
        type: 'error' as const,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

/**
 * Helper function to create a ConvexChatTransport instance
 */
export function createConvexTransport(convex: ConvexReactClient) {
  return new ConvexChatTransport({ convex });
}