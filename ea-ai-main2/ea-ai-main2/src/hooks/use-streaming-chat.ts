import { useState, useEffect, useCallback } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  status: 'streaming' | 'complete' | 'error';
  userMessage?: string;
  toolCalls?: any[];
  toolResults?: any[];
}

interface UseStreamingChatOptions {
  sessionId?: Id<"chatSessions"> | null;
}

interface UseStreamingChatReturn {
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;
  streamingError: string | null;
  sendStreamingMessage: (message: string, useHaiku?: boolean) => Promise<string>;
  clearStreaming: () => void;
}

/**
 * Custom hook for managing streaming chat responses
 * Integrates with Convex backend using streamText for real-time AI responses
 */
export function useStreamingChat(options: UseStreamingChatOptions = {}): UseStreamingChatReturn {
  const { sessionId } = options;
  
  // Local state for streaming management
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  
  // Convex actions and queries
  const streamChatAction = useAction(api.ai.streamChatWithAI);
  
  // Subscribe to streaming updates - only if we have an active stream
  const streamingData = useQuery(
    api.streamingResponses.getStreamingResponse,
    streamingMessage?.id ? { streamId: streamingMessage.id } : "skip"
  );
  
  // Update local state when streaming data changes from Convex
  useEffect(() => {
    if (streamingData && streamingMessage) {
      const updatedMessage: StreamingMessage = {
        id: streamingMessage.id,
        content: streamingData.partialContent,
        isComplete: streamingData.isComplete,
        status: streamingData.status,
        userMessage: streamingData.userMessage,
        toolCalls: streamingData.toolCalls,
        toolResults: streamingData.toolResults,
      };
      
      setStreamingMessage(updatedMessage);
      
      // Update streaming status
      if (streamingData.isComplete) {
        setIsStreaming(false);
        if (streamingData.status === 'error') {
          setStreamingError('An error occurred during streaming');
        }
      }
    }
  }, [streamingData, streamingMessage?.id]);
  
  /**
   * Send a streaming message and start receiving real-time updates
   */
  const sendStreamingMessage = useCallback(async (
    message: string, 
    useHaiku: boolean = true
  ): Promise<string> => {
    try {
      setStreamingError(null);
      setIsStreaming(true);
      
      console.log('[useStreamingChat] Starting stream for message:', message.substring(0, 50) + '...');
      
      // Call the streaming action
      const result = await streamChatAction({
        message,
        useHaiku,
        sessionId,
        currentTimeContext: {
          currentTime: new Date().toISOString(),
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          localTime: new Date().toLocaleString(),
          timestamp: Date.now(),
          source: "user_browser"
        }
      });
      
      if (result.success && result.streamId) {
        // Initialize streaming state
        setStreamingMessage({
          id: result.streamId,
          content: '',
          isComplete: false,
          status: 'streaming',
          userMessage: message,
        });
        
        console.log('[useStreamingChat] Stream initialized:', result.streamId);
        return result.streamId;
      } else {
        throw new Error('Failed to start streaming session');
      }
      
    } catch (error) {
      console.error('[useStreamingChat] Error starting stream:', error);
      setIsStreaming(false);
      setStreamingError(error instanceof Error ? error.message : 'Failed to start streaming');
      throw error;
    }
  }, [streamChatAction, sessionId]);
  
  /**
   * Clear streaming state - useful for cleanup or resetting
   */
  const clearStreaming = useCallback(() => {
    console.log('[useStreamingChat] Clearing streaming state');
    setStreamingMessage(null);
    setIsStreaming(false);
    setStreamingError(null);
  }, []);
  
  // Auto-cleanup when component unmounts or sessionId changes
  useEffect(() => {
    return () => {
      if (streamingMessage && !streamingMessage.isComplete) {
        console.log('[useStreamingChat] Component unmounting, clearing incomplete stream');
        clearStreaming();
      }
    };
  }, [sessionId]);
  
  return {
    streamingMessage,
    isStreaming,
    streamingError,
    sendStreamingMessage,
    clearStreaming,
  };
}