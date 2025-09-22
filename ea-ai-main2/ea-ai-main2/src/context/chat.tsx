"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useSessions } from './sessions';

// ChatHub pattern: Complete conversation turn (user + AI pair)
export interface ConversationTurn {
  id: string;
  userMessage: string;
  aiMessage?: string;
  isThinking: boolean;
  timestamp: number;
}

// Chat context interface - ChatHub message-only pattern
interface ChatContextType {
  // State - single source of truth for messages only
  conversationTurns: ConversationTurn[];
  isLoading: boolean;
  
  // Actions
  submitMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  
  // UI helpers
  isFreshSession: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

// ChatHub pattern: Provider focused on messages only
export function ChatProvider({ children }: { children: ReactNode }) {
  // Session context - get current session from centralized state
  const { currentSessionId } = useSessions();
  
  // Convex integration - preserve existing backend
  const chatWithAI = useAction(api.ai.chatWithAI);
  const updateChatTitle = useMutation(api.chatSessions.updateChatTitleFromMessage);

  // ChatHub pattern: Single source of truth for messages only
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load messages for current session from SessionsContext
  const activeConversation = useQuery(
    api.conversations.getConversationBySession,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  );

  // Track loaded data per session to prevent unnecessary reloads
  const [loadedSessionData, setLoadedSessionData] = useState<{
    sessionId: string | null;
    hasLoaded: boolean;
  }>({ sessionId: null, hasLoaded: false });

  // Stable session change detection
  const previousSessionId = React.useRef<string | null>(currentSessionId);
  
  // Clear messages and reset loading state when session actually changes
  useEffect(() => {
    // Only reset if session actually changed
    if (previousSessionId.current !== currentSessionId) {
      console.log('🔄 Session changed, resetting conversation state:', { 
        from: previousSessionId.current, 
        to: currentSessionId 
      });
      
      setConversationTurns([]);
      setLoadedSessionData({ sessionId: currentSessionId, hasLoaded: false });
      previousSessionId.current = currentSessionId;
    }
  }, [currentSessionId]);

  // Stable database sync logic with session-specific tracking
  useEffect(() => {
    // Skip if no session or already loaded for this session
    if (!currentSessionId || !activeConversation?.messages) {
      return;
    }

    // Skip if we've already loaded data for this specific session
    if (loadedSessionData.sessionId === currentSessionId && loadedSessionData.hasLoaded) {
      console.log('🔄 Already loaded data for session, skipping sync:', currentSessionId);
      return;
    }

    console.log('📚 Loading conversation data from database for session:', currentSessionId);
    
    const allMessages = (activeConversation.messages as any[])
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map((msg, index) => ({
        id: `${msg.timestamp}-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: msg.timestamp
      }));

    // FIXED: Robust message pairing algorithm that preserves all AI responses
    const turns: ConversationTurn[] = [];
    
    // Group messages into logical conversation turns
    let i = 0;
    while (i < allMessages.length) {
      const currentMessage = allMessages[i];
      
      if (currentMessage.role === 'user') {
        // Start a new conversation turn with user message
        const userMessage = currentMessage;
        
        // Collect all consecutive assistant messages that follow
        const assistantMessages: any[] = [];
        let j = i + 1;
        
        while (j < allMessages.length && allMessages[j].role === 'assistant') {
          assistantMessages.push(allMessages[j]);
          j++;
        }
        
        // Create conversation turn
        let aiMessage: string | undefined;
        
        if (assistantMessages.length > 0) {
          // Merge multiple assistant messages into single response
          // Join with double newlines to preserve message boundaries
          aiMessage = assistantMessages
            .map(msg => msg.content)
            .filter(content => content && content.trim())
            .join('\n\n');
        }
        
        turns.push({
          id: userMessage.id,
          userMessage: userMessage.content,
          aiMessage: aiMessage || undefined,
          isThinking: false,
          timestamp: userMessage.timestamp
        });
        
        // Move to next unprocessed message
        i = j;
      } else {
        // Skip orphaned assistant messages (rare edge case)
        console.warn('⚠️ Found orphaned assistant message, skipping:', currentMessage.content);
        i++;
      }
    }

    console.log('📚 Loaded', turns.length, 'conversation turns from database');
    setConversationTurns(turns);
    setLoadedSessionData({ sessionId: currentSessionId, hasLoaded: true });
  }, [activeConversation?.messages, currentSessionId, loadedSessionData.sessionId, loadedSessionData.hasLoaded]);

  // Stable submit message with improved error handling
  const submitMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Validate session before starting
    if (!currentSessionId) {
      console.error('❌ No active session available');
      toast.error('No active session. Please refresh the page.');
      return;
    }

    setIsLoading(true);

    // Create optimistic conversation turn
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTurn: ConversationTurn = {
      id: turnId,
      userMessage: content.trim(),
      aiMessage: undefined,
      isThinking: true,
      timestamp: Date.now()
    };

    console.log('➕ Adding conversation turn optimistically:', turnId);
    setConversationTurns(prev => [...prev, newTurn]);

    try {

      // Create time context (preserve existing logic)
      const currentTimeContext = {
        currentTime: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toLocaleString(),
        timestamp: Date.now(),
        source: "user_browser"
      };

      // Call AI (preserve existing backend integration)
      console.log('🤖 Calling AI for turn:', turnId);
      const result = await chatWithAI({ 
        message: content.trim(), 
        useHaiku: false,
        sessionId: currentSessionId,
        currentTimeContext
      });

      // Extract response text (fixed to match actual result structure)
      let responseText = "Response received";
      
      if (typeof result === 'string') {
        responseText = result;
      } else if (result && typeof result === 'object') {
        // The result has a 'response' property based on the error messages
        responseText = result.response || JSON.stringify(result);
      }

      console.log('✅ AI response received, updating turn:', turnId, 'length:', responseText.length);

      // Update conversation turn with AI response (single source of truth)
      setConversationTurns(prev => prev.map(turn => 
        turn.id === turnId 
          ? { ...turn, aiMessage: responseText, isThinking: false }
          : turn
      ));

      // Update chat title for first turn (preserve existing logic)
      if (conversationTurns.length === 0 && currentSessionId) {
        try {
          await updateChatTitle({
            sessionId: currentSessionId,
            firstMessage: content.trim()
          });
        } catch (error) {
          console.warn("Failed to update chat title:", error);
        }
      }

      // Handle tool results (preserve existing logic)
      if (result && typeof result === 'object' && 'toolResults' in result && Array.isArray((result as any).toolResults)) {
        const toolResults = (result as any).toolResults;
        if (toolResults.length > 0) {
          const successfulToolCalls = toolResults.filter((tc: any) => tc.success);
          if (successfulToolCalls.length > 0) {
            toast.success(`Executed ${successfulToolCalls.length} action(s) successfully`);
          }
          
          const failedToolCalls = toolResults.filter((tc: any) => !tc.success);
          if (failedToolCalls.length > 0) {
            toast.error(`${failedToolCalls.length} action(s) failed`);
          }
        }
      }

      // Trigger background sync (database save happens in background)
      window.dispatchEvent(new CustomEvent('chat-history-updated'));

    } catch (error) {
      console.error("❌ Chat submission error:", error);
      
      // Enhanced error handling with session validation
      let errorMessage = "Failed to send message";
      let shouldRetry = true;
      
      if (error instanceof Error) {
        const errorText = error.message.toLowerCase();
        
        if (errorText.includes('network') || errorText.includes('fetch') || errorText.includes('connection')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (errorText.includes('rate limit') || errorText.includes('too many')) {
          errorMessage = "Too many requests. Please wait a moment before trying again.";
          shouldRetry = false;
        } else if (errorText.includes('authentication') || errorText.includes('unauthorized') || errorText.includes('token')) {
          errorMessage = "Authentication error. Please refresh the page and try again.";
          shouldRetry = false;
        } else if (errorText.includes('timeout')) {
          errorMessage = "Request timed out. The AI may be busy, please try again.";
        } else if (errorText.includes('session')) {
          errorMessage = "Session error. Your session may have expired.";
          shouldRetry = false;
          // Clear session state if it seems corrupted
          setLoadedSessionData({ sessionId: null, hasLoaded: false });
        }
      }
      
      toast.error(errorMessage);
      
      // Remove failed turn from UI
      console.log('❌ Removing failed turn:', turnId);
      setConversationTurns(prev => prev.filter(turn => turn.id !== turnId));

    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentSessionId, conversationTurns.length, chatWithAI, updateChatTitle]);

  // Clear chat function
  const clearChat = useCallback(() => {
    console.log('🧹 Clearing all conversation turns');
    setConversationTurns([]);
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, []);

  // ChatHub pattern: Fresh session detection
  const isFreshSession = conversationTurns.length === 0 && !isLoading;

  // Context value - single source of truth for messages
  const contextValue: ChatContextType = {
    // State
    conversationTurns,
    isLoading,
    
    // Actions
    submitMessage,
    clearChat,
    
    // UI helpers
    isFreshSession,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// ChatHub pattern: Custom hook
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}