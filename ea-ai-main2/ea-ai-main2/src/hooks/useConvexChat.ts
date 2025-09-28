import { useState, useCallback, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

export interface UseConvexChatOptions {
  id?: string; // session ID
  initialMessages?: Message[];
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export interface UseConvexChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  append: (message: { content: string; role?: 'user' | 'assistant' }) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  isRetriable: boolean;
  reload: () => void;
  stop: () => void;
}

/**
 * Custom hook that provides Vercel AI SDK-like interface but uses Convex backend
 * This gives us the same simple API as useChat but works with our existing infrastructure
 */
export function useConvexChat({
  id,
  initialMessages = [],
  onFinish,
  onError
}: UseConvexChatOptions = {}): UseConvexChatReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRetriable, setIsRetriable] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const chatWithAI = useAction(api.ai.session.chatWithAI);

  // Reset messages when initialMessages change (for session switching)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const append = useCallback(async (message: { content: string; role?: 'user' | 'assistant' }) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setIsRetriable(false);

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: message.role || 'user',
      content: message.content,
      createdAt: new Date()
    };

    // Add user message optimistically
    setMessages(prev => [...prev, userMessage]);

    try {
      // Create time context
      const currentTimeContext = {
        currentTime: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toLocaleString(),
        timestamp: Date.now(),
        source: "convex_chat_hook"
      };

      // Call Convex action
      const result = await chatWithAI({
        message: message.content,
        useHaiku: false,
        sessionId: id as Id<"chatSessions"> | undefined,
        currentTimeContext
      });

      // Check for error in response metadata
      if (result.metadata?.error) {
        // Create error object from response metadata
        const responseError = new Error(result.metadata.userFriendlyError || result.metadata.error);

        // Store the failed message for retry
        setLastFailedMessage(message.content);

        // Remove the optimistic user message on error
        setMessages(prev => prev.slice(0, -1));

        // Set error state and retriability
        setError(responseError);
        setIsRetriable(result.metadata.isRetriable || false);

        if (onError) {
          onError(responseError);
        }

        return; // Don't proceed with adding assistant message
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: result.response || result.text || "I'm ready to help!",
        createdAt: new Date()
      };

      // Add assistant response
      setMessages(prev => [...prev, assistantMessage]);

      // Call onFinish callback
      if (onFinish) {
        onFinish(assistantMessage);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      // For thrown errors, check if they're typically retriable (network errors, etc.)
      const errorMessage = error.message.toLowerCase();
      const isNetworkError = errorMessage.includes('network') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('connection') ||
                           errorMessage.includes('fetch');
      setIsRetriable(isNetworkError);

      // Store the failed message for retry
      setLastFailedMessage(message.content);

      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));

      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, id, chatWithAI, onFinish, onError]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageContent = input.trim();
    setInput('');
    append({ content: messageContent });
  }, [input, isLoading, append]);

  const reload = useCallback(() => {
    // Retry the last failed message if available
    if (lastFailedMessage && !isLoading) {
      setError(null);
      setIsRetriable(false);
      setLastFailedMessage(null);
      append({ content: lastFailedMessage });
    } else {
      // Just clear error state if no message to retry
      setError(null);
      setIsRetriable(false);
    }
  }, [lastFailedMessage, isLoading, append]);

  const stop = useCallback(() => {
    // Since we're not actually streaming, we can't stop mid-generation
    // This is a no-op for compatibility with useChat interface
  }, []);

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    error,
    isRetriable,
    reload,
    stop
  };
}