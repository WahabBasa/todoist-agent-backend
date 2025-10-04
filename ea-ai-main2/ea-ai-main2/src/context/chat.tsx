"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useSessions } from './sessions';
import { useChat as useVercelChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/clerk-react';
import type { UIMessage } from '@ai-sdk/ui-utils';

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

function generateRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function collectTextFromParts(parts: any[]): string {
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part: any) => {
      const type = typeof part?.type === 'string' ? part.type : '';
      const isTextLike = type === 'text' || type === 'output_text' || type === 'input_text' || type === 'assistant_message';
      if (!isTextLike) return '';

      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      if (typeof part?.value === 'string') return part.value;
      return '';
    })
    .join('')
    .trim();
}

function extractLatestUserMessage(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'user') continue;

    if (Array.isArray(message.parts) && message.parts.length > 0) {
      const text = collectTextFromParts(message.parts);
      if (text) return text;
    }

    const anyMessage = message as any;
    if (Array.isArray(anyMessage.content)) {
      const text = collectTextFromParts(anyMessage.content);
      if (text) return text;
    }
    if (typeof anyMessage.content === 'string' && anyMessage.content.trim()) {
      return anyMessage.content.trim();
    }
  }
  return '';
}

export function ChatProvider({ children }: { children: ReactNode }) {
  // Session context - get current session from centralized state
  const { currentSessionId, sessions } = useSessions();
  const chatId = currentSessionId ?? "default";

  const currentSessionMeta = React.useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((session) => session._id === currentSessionId) ?? null;
  }, [currentSessionId, sessions]);
  
  // Load messages for current session from Convex
  // Guard against stale session IDs from a previous user by validating against current sessions
  const isValidSession = React.useMemo(() => {
    return !!currentSessionId && sessions.some(s => s._id === currentSessionId);
  }, [currentSessionId, sessions]);

  const activeConversation = useQuery(
    api.conversations.getConversationBySession,
    isValidSession ? { sessionId: currentSessionId! } : "skip"
  );

  const canonicalHistoryVersion = React.useMemo(() => {
    if (currentSessionMeta?.messageCount != null) {
      return currentSessionMeta.messageCount;
    }
    if (Array.isArray(activeConversation?.messages)) {
      return activeConversation.messages.length;
    }
    return 0;
  }, [currentSessionMeta, activeConversation?.messages]);

  // Convert Convex messages to our Message format
  const initialSdkMessages = React.useMemo<UIMessage[]>(() => {
    if (!activeConversation?.messages) return [];

    return activeConversation.messages
      .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
      .map((msg: any, index: number) => {
        const baseContent = typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content ?? '');

        const metadata = typeof msg.metadata === 'object' && msg.metadata !== null ? msg.metadata : undefined;

        return {
          id: `${msg.timestamp}-${index}`,
          role: msg.role,
          content: baseContent,
          metadata,
          createdAt: msg.timestamp,
          mode: msg.mode,
        } as UIMessage;
      });
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

  const prepareSendMessagesRequest = React.useCallback(async ({ messages }: { messages: any[] }) => {
    const token = await getToken({ template: 'convex' });
    const requestId = generateRequestId();
    const latestUserMessage = extractLatestUserMessage(messages as UIMessage[]);

    if (!latestUserMessage) {
      toast.error("We couldn't read your message. Please try again.");
      throw new Error("latestUserMessage_missing");
    }

    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}`, "X-Request-Id": requestId }
      : { "X-Request-Id": requestId };

    if (currentSessionId) {
      headers["X-Session-Id"] = currentSessionId;
    }

    return {
      headers,
      body: {
        sessionId: currentSessionId ?? undefined,
        id: currentSessionId ?? undefined,
        requestId,
        latestUserMessage,
        historyVersion: canonicalHistoryVersion,
        messages,
      },
    };
  }, [getToken, currentSessionId, canonicalHistoryVersion]);

  // Memoize transport to prevent re-instantiating useChat on each render
  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: resolvedChatApi,
      prepareSendMessagesRequest,
    });
  }, [resolvedChatApi, prepareSendMessagesRequest]);

  const {
    messages,
    sendMessage,
    status,
    reload,
    error
  } = useVercelChat({
    id: chatId,
    transport,
    initialMessages: initialSdkMessages,
    onError: (err) => {
      if (err instanceof Error && err.message === "latestUserMessage_missing") {
        return;
      }
      toast.error(`Error: ${err.message}`);
    },
    onFinish: () => window.dispatchEvent(new CustomEvent('chat-history-updated')),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const isRetriable = false;

  // Local input state managed here to avoid SDK API differences
  const [localInput, setLocalInput] = React.useState('');

  // Normalize AI SDK UI messages to simple { role, content } for existing UI
  const normalizedMessages: Message[] = React.useMemo(() => {
    return messages.map((m: any) => {
      let text = '';
      if (Array.isArray(m.parts)) {
        text = collectTextFromParts(m.parts);
      } else if (typeof m.content === 'string') {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        text = collectTextFromParts(m.content);
      }
      return { id: m.id, role: m.role, content: text };
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
        void sendMessage({ text: content });
      } else {
        console.warn('[CHAT] sendMessage not available on useChat return');
      }
    } catch (err) {
      console.error('[CHAT] sendMessage failed:', err);
    }
  }, [localInput, isLoading, sendMessage]);

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