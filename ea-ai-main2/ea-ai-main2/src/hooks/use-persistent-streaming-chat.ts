import { useState, useCallback, useEffect } from 'react';
import { useAction, useMutation } from 'convex/react';
import { useStream } from '@convex-dev/persistent-text-streaming/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// =================================================================
// PERSISTENT TEXT STREAMING CHAT HOOK
// Uses Convex's persistent text streaming component for real-time chat
// Replaces custom streaming implementation with purpose-built streaming
// =================================================================

interface UsePersistentStreamingChatOptions {
  sessionId?: Id<"chatSessions"> | null;
}

/**
 * Streaming message interface for the new persistent text streaming approach
 */
interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  status: 'pending' | 'streaming' | 'done' | 'error';
}

interface UsePersistentStreamingChatReturn {
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;
  streamingError: string | null;
  sendStreamingMessage: (message: string, useHaiku?: boolean) => Promise<string>;
  clearStreaming: () => void;
}

/**
 * Hook that uses the persistent text streaming component for real-time chat
 */
export function usePersistentStreamingChat(
  options: UsePersistentStreamingChatOptions = {}
): UsePersistentStreamingChatReturn {
  const { sessionId } = options;
  
  // Local state for streaming
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [driven, setDriven] = useState(false);
  
  // Convex mutation to create the chat stream
  const createChatMutation = useMutation(api.chat.createChat);
  
  // Construct the streaming endpoint URL
  const streamUrl = new URL('/chat-stream', window.location.origin);
  
  // Use the persistent text streaming hook
  const streamBody = useStream(
    api.chat.getChatBody,
    streamUrl,
    driven,
    currentStreamId as any, // StreamId type
    {
      // Add authentication if needed
      authToken: null, // Can be added if authentication is needed
    }
  );
  
  // Convert stream body to our interface
  const streamingMessage: StreamingMessage | null = currentStreamId ? {
    id: currentStreamId,
    content: streamBody.text || '',
    isComplete: streamBody.status === 'done' || streamBody.status === 'error',
    status: streamBody.status,
  } : null;
  
  // Handle stream status changes
  useEffect(() => {
    if (streamingMessage) {
      const wasStreaming = isStreaming;
      
      if (streamingMessage.status === 'streaming' || streamingMessage.status === 'pending') {
        setIsStreaming(true);
        setStreamingError(null);
      } else if (streamingMessage.status === 'done') {
        setIsStreaming(false);
        setStreamingError(null);
        console.log('[PersistentStreaming] Stream completed successfully:', streamingMessage.id);
      } else if (streamingMessage.status === 'error') {
        setIsStreaming(false);
        setStreamingError('Stream completed with error');
        console.error('[PersistentStreaming] Stream completed with error:', streamingMessage.id);
      }
    }
  }, [streamingMessage?.status, isStreaming]);
  
  /**
   * Start a new streaming conversation using the persistent text streaming approach
   */
  const sendStreamingMessage = useCallback(async (
    message: string,
    useHaiku: boolean = true
  ): Promise<string> => {
    try {
      setStreamingError(null);
      setIsStreaming(true);
      
      console.log('[PersistentStreaming] Starting stream for message:', message.substring(0, 50) + '...');
      
      // Create the chat stream using the mutation
      const result = await createChatMutation({
        prompt: message,
        sessionId,
        useHaiku,
      });
      
      if (result && result.streamId) {
        // Set up the stream for the useStream hook to handle
        setCurrentStreamId(result.streamId);
        setCurrentChatId(result.chatId);
        setDriven(true); // This client is driving the stream
        
        console.log('[PersistentStreaming] Stream initialized:', {
          streamId: result.streamId,
          chatId: result.chatId
        });
        
        // The useStream hook will automatically start the HTTP streaming
        return result.streamId;
      } else {
        throw new Error('Failed to start streaming session');
      }
      
    } catch (error) {
      console.error('[PersistentStreaming] Error starting stream:', error);
      setIsStreaming(false);
      setStreamingError(error instanceof Error ? error.message : 'Failed to start streaming');
      throw error;
    }
  }, [createChatMutation, sessionId]);
  
  /**
   * Clear streaming state - cleanup function
   */
  const clearStreaming = useCallback(() => {
    console.log('[PersistentStreaming] Clearing streaming state');
    
    setCurrentStreamId(null);
    setCurrentChatId(null);
    setDriven(false);
    setIsStreaming(false);
    setStreamingError(null);
  }, []);
  
  // Auto-cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (currentStreamId && isStreaming) {
        console.log('[PersistentStreaming] Component unmounting, clearing stream');
        clearStreaming();
      }
    };
  }, [currentStreamId, isStreaming, clearStreaming]);
  
  return {
    streamingMessage,
    isStreaming,
    streamingError,
    sendStreamingMessage,
    clearStreaming,
  };
}

/**
 * Legacy compatibility wrapper - provides the same interface as the old hook
 */
export function useConvexStreamingChat(
  options: UsePersistentStreamingChatOptions = {}
): UsePersistentStreamingChatReturn {
  // Just use the new persistent streaming implementation
  return usePersistentStreamingChat(options);
}