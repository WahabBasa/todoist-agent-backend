"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useSessions } from './sessions';
import { useChat as useVercelChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/clerk-react';

// Minimal message shape expected by UI components
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

// Simple chat context interface - much cleaner than before
interface ChatContextType {
  // State from useConvexChat hook
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: Error | null;
  isRetriable: boolean;

  // Additional helpers
  clearChat: () => void;
  reload: () => void;
  isFreshSession: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Session context - get current session from centralized state
  const { currentSessionId, sessions } = useSessions();
  
  // Load messages for current session from Convex
  // Guard against stale session IDs from a previous user by validating against current sessions
  const isValidSession = React.useMemo(() => {
    return !!currentSessionId && sessions.some(s => s._id === currentSessionId);
  }, [currentSessionId, sessions]);

  const activeConversation = useQuery(
    api.conversations.getConversationBySession,
    isValidSession ? { sessionId: currentSessionId! } : "skip"
  );

  // Convert Convex messages to our Message format
  const initialMessages: Message[] = React.useMemo(() => {
    if (!activeConversation?.messages) return [];
    
    return activeConversation.messages
      .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
      .map((msg: any, index: number) => ({
        id: `${msg.timestamp}-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        createdAt: new Date(msg.timestamp)
      }));
  }, [activeConversation?.messages]);

  // Auth header for Convex httpAction
  const { getToken, isSignedIn } = useAuth();
  const [authHeader, setAuthHeader] = React.useState<string | null>(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isSignedIn) {
          const token = await getToken();
          if (mounted && token) setAuthHeader(`Bearer ${token}`);
        } else {
          setAuthHeader(null);
        }
      } catch (e) {
        console.warn('[CHAT] Failed to get auth token', e);
      }
    })();
    return () => { mounted = false; };
  }, [isSignedIn, getToken]);

  const resolvedChatApi = '/convex-http/chat';

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    reload,
    setMessages,
    error
  } = useVercelChat({
    transport: new DefaultChatTransport({
      api: resolvedChatApi,
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { id: currentSessionId, messages },
      }),
    }),
    headers: () => authHeader ? { Authorization: authHeader } : {},
    initialMessages,
    onError: (err) => toast.error(`Error: ${err.message}`),
    onFinish: () => window.dispatchEvent(new CustomEvent('chat-history-updated')),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const isRetriable = false;

  // Normalize AI SDK UI messages to simple { role, content } for existing UI
  const normalizedMessages: Message[] = React.useMemo(() => {
    return (messages as any[]).map((m: any) => {
      let text = '';
      if (Array.isArray(m.parts)) {
        text = m.parts
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => p?.text || '')
          .join('');
      } else if (typeof m.content === 'string') {
        text = m.content;
      }
      return { id: m.id, role: m.role, content: text } as Message;
    });
  }, [messages]);

  // Ensure input is always a string to avoid undefined.trim() crashes
  const safeInput = input ?? "";

  const clearChat = React.useCallback(() => {
    // Trigger clear chat event for sessions context to handle
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, []);

  // Fresh session detection
  const isFreshSession = messages.length === 0 && !isLoading;

  // Context value - much simpler than before!
  const contextValue: ChatContextType = {
    messages: normalizedMessages,
    input: safeInput,
    setInput: (val: string) => handleInputChange({ target: { value: val } } as any),
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    isRetriable,
    clearChat,
    reload,
    isFreshSession,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Export the hook for components to use
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}