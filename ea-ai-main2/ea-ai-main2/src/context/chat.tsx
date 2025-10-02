"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useSessions } from './sessions';
import { useConvexChat, Message } from '../hooks/useConvexChat';

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

  // Use our custom hook that mimics Vercel AI SDK interface
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    isRetriable,
    reload
  } = useConvexChat({
    id: currentSessionId || undefined,
    initialMessages,
    onFinish: (message) => {
      // Optional: Add any post-message logic here
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const clearChat = React.useCallback(() => {
    // Trigger clear chat event for sessions context to handle
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, []);

  // Fresh session detection
  const isFreshSession = messages.length === 0 && !isLoading;

  // Context value - much simpler than before!
  const contextValue: ChatContextType = {
    messages,
    input,
    setInput,
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