import { useState, useEffect, useCallback, useRef } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// =================================================================
// CONVEX-NATIVE STREAMING CHAT HOOK
// Simple reactive subscriptions using Convex built-in real-time updates
// Replaces complex event reconstruction with progressive document updates
// =================================================================

/**
 * Tool execution state from streaming response
 */
interface ToolExecution {
  toolCallId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: any;
  output?: any;
  startTime?: number;
  endTime?: number;
}

/**
 * Simple streaming message from Convex document
 */
interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  status: 'streaming' | 'complete' | 'error';
  userMessage?: string;
  toolExecutions: ToolExecution[];
  createdAt: number;
  updatedAt: number;
}

interface UseConvexStreamingChatOptions {
  sessionId?: Id<"chatSessions"> | null;
}

interface UseConvexStreamingChatReturn {
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;
  streamingError: string | null;
  sendStreamingMessage: (message: string, useHaiku?: boolean) => Promise<string>;
  clearStreaming: () => void;
}

/**
 * Convex-native streaming chat hook
 * Uses simple reactive subscriptions instead of complex event reconstruction
 */
export function useConvexStreamingChat(options: UseConvexStreamingChatOptions = {}): UseConvexStreamingChatReturn {
  const { sessionId } = options;
  
  // Local state for streaming
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  
  // Convex actions
  const streamChatAction = useAction(api.ai.streamChatWithAI);
  
  // Simple reactive subscription to streaming response document
  // This automatically updates when the backend patches the document
  const streamingResponse = useQuery(
    api.streamingResponses.getStreamingResponse,
    currentStreamId ? { streamId: currentStreamId } : "skip"
  );

  // Convert Convex document to our interface format
  const streamingMessage: StreamingMessage | null = streamingResponse ? {
    id: streamingResponse.streamId,
    content: streamingResponse.content,
    isComplete: streamingResponse.isComplete,
    status: streamingResponse.status,
    userMessage: streamingResponse.userMessage,
    toolExecutions: (streamingResponse.toolExecutions || []).map(te => ({
      toolCallId: te.toolCallId,
      toolName: te.toolName,
      status: te.status,
      input: te.input,
      output: te.output,
      startTime: te.startTime,
      endTime: te.endTime,
    })),
    createdAt: streamingResponse.createdAt,
    updatedAt: streamingResponse.updatedAt,
  } : null;

  // Handle stream completion
  useEffect(() => {
    if (streamingMessage?.isComplete && isStreaming) {
      console.log('[ConvexStreaming] Stream completed:', streamingMessage.id);
      setIsStreaming(false);
      
      // Handle error status
      if (streamingMessage.status === 'error') {
        setStreamingError(streamingResponse?.errorMessage || 'Stream completed with error');
      } else {
        setStreamingError(null);
      }
    }
  }, [streamingMessage?.isComplete, streamingMessage?.status, isStreaming, streamingResponse?.errorMessage]);

  /**
   * Start a new streaming conversation
   */
  const sendStreamingMessage = useCallback(async (
    message: string, 
    useHaiku: boolean = true
  ): Promise<string> => {
    try {
      setStreamingError(null);
      setIsStreaming(true);
      
      console.log('[ConvexStreaming] Starting stream for message:', message.substring(0, 50) + '...');
      
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
        // Set up reactive subscription to this stream
        setCurrentStreamId(result.streamId);
        
        console.log('[ConvexStreaming] Stream initialized:', result.streamId);
        return result.streamId;
      } else {
        throw new Error('Failed to start streaming session');
      }
      
    } catch (error) {
      console.error('[ConvexStreaming] Error starting stream:', error);
      setIsStreaming(false);
      setStreamingError(error instanceof Error ? error.message : 'Failed to start streaming');
      throw error;
    }
  }, [streamChatAction, sessionId]);
  
  /**
   * Clear streaming state - cleanup function
   */
  const clearStreaming = useCallback(() => {
    console.log('[ConvexStreaming] Clearing streaming state');
    
    setCurrentStreamId(null);
    setIsStreaming(false);
    setStreamingError(null);
  }, []);
  
  // Auto-cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (currentStreamId && isStreaming) {
        console.log('[ConvexStreaming] Component unmounting, clearing stream');
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
 * Legacy compatibility wrapper for existing components
 * Converts the new simple format to match old interface expectations
 */
export function useSimpleStreamingChat(options: UseConvexStreamingChatOptions = {}) {
  const convexResult = useConvexStreamingChat(options);
  
  // Convert to legacy format if needed
  const legacyStreamingMessage = convexResult.streamingMessage ? {
    ...convexResult.streamingMessage,
    // Add any legacy fields that existing components expect
    eventCount: 0, // Not applicable in new system
    lastEventOrder: -1, // Not applicable in new system
    startTime: convexResult.streamingMessage.createdAt,
    endTime: convexResult.streamingMessage.isComplete ? convexResult.streamingMessage.updatedAt : undefined,
  } : null;
  
  return {
    ...convexResult,
    streamingMessage: legacyStreamingMessage,
  };
}