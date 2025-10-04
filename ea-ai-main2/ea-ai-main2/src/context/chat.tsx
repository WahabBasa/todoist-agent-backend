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
  const chatId = currentSessionId ?? "default";
  
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
  const { getToken } = useAuth();

  const resolvedChatApi = React.useMemo(() => {
    const explicitOrigin = import.meta.env.VITE_CONVEX_HTTP_ORIGIN as string | undefined;
    if (explicitOrigin) {
      try {
        const u = new URL(explicitOrigin);
        const siteHost = u.hostname.endsWith('.convex.cloud')
          ? u.hostname.replace('.convex.cloud', '.convex.site')
          : u.hostname;
        return `${u.protocol}//${siteHost}${u.port ? `:${u.port}` : ''}/chat`;
      } catch {
        return `${explicitOrigin.replace(/\/$/, '').replace('.convex.cloud', '.convex.site')}/chat`;
      }
    }

    const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
    if (convexUrl) {
      try {
        const url = new URL(convexUrl);
        const siteHost = url.hostname.endsWith('.convex.cloud')
          ? url.hostname.replace('.convex.cloud', '.convex.site')
          : url.hostname;
        return `${url.protocol}//${siteHost}/chat`;
      } catch {
        // fall through to relative path fallback
      }
    }

    if (typeof window !== 'undefined') {
      return `${window.location.origin}/chat`;
    }

    return '/chat';
  }, []);

  // Memoize transport to prevent re-instantiating useChat on each render
  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: resolvedChatApi,
      prepareSendMessagesRequest: async ({ messages }) => {
        const token = await getToken({ template: 'convex' });
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        return {
          headers,
          body: { sessionId: currentSessionId ?? undefined, id: currentSessionId ?? undefined, messages },
        };
      },
    });
  }, [resolvedChatApi, chatId, currentSessionId, getToken]);

  const {
    messages,
    sendMessage,
    status,
    stop,
    reload,
    setMessages,
    error
  } = useVercelChat({
    id: chatId,
    transport,
    initialMessages,
    onError: (err) => toast.error(`Error: ${err.message}`),
    onFinish: () => window.dispatchEvent(new CustomEvent('chat-history-updated')),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const isRetriable = false;

  // Local input state managed here to avoid SDK API differences
  const [localInput, setLocalInput] = React.useState('');

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

  // Ensure input is always a string to avoid trim() issues
  const safeInput = localInput ?? "";

  const clearChat = React.useCallback(() => {
    // Trigger clear chat event for sessions context to handle
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, []);

  // Fresh session detection
  const isFreshSession = messages.length === 0 && !isLoading;

  // Our own input change handler (SDK-agnostic)
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e?.target?.value ?? '';
    setLocalInput(next);
  }, []);

  // Our own submit handler using sendMessage
  const handleSubmitCompat = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const content = (localInput || '').trim();
    if (!content || isLoading) return;
    setLocalInput('');
    try {
      if (typeof sendMessage === 'function') {
        sendMessage({ text: content });
      } else {
        console.warn('[CHAT] sendMessage not available on useChat return');
      }
    } catch (err) {
      console.error('[CHAT] sendMessage failed:', err);
    }
  }, [localInput, isLoading, sendMessage]);

  React.useEffect(() => {
    setMessages(initialMessages as any);
  }, [chatId, initialMessages, setMessages]);

  React.useEffect(() => {
    setLocalInput('');
  }, [chatId]);

  // Context value - much simpler than before!
  const contextValue: ChatContextType = {
    messages: normalizedMessages,
    input: safeInput,
    setInput: (val: string) => setLocalInput(val),
    handleInputChange,
    handleSubmit: handleSubmitCompat,
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