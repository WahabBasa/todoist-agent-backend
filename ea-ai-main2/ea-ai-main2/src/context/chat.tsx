"use client";

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
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

  // Track if we've loaded initial data for the current session
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  // Clear messages and reset loading state when session changes
  useEffect(() => {
    console.log('🔄 Session changed, resetting conversation state:', currentSessionId);
    setConversationTurns([]);
    setHasLoadedInitialData(false);
  }, [currentSessionId]);

  // Fixed: Improved database sync logic that properly loads conversation data
  useEffect(() => {
    // Only proceed if we have an active conversation and haven't loaded data yet
    if (!activeConversation?.messages) {
      console.log('🔄 No active conversation messages, skipping sync');
      return;
    }

    // If we've already loaded data for this session, don't reload
    if (hasLoadedInitialData) {
      console.log('🔄 Already loaded data for this session, skipping sync');
      return;
    }

    // Always load from database when session changes, regardless of local state
    // This ensures we get the correct conversation data for the new session
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
    setHasLoadedInitialData(true);
  }, [activeConversation?.messages, currentSessionId, hasLoadedInitialData]);

  // ChatHub pattern: Submit message with optimistic updates
  const submitMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);

    // ChatHub pattern: Add conversation turn immediately (optimistic update)
    const turnId = `turn-${Date.now()}`;
    const newTurn: ConversationTurn = {
      id: turnId,
      userMessage: content.trim(),
      aiMessage: undefined,
      isThinking: true,
      timestamp: Date.now()
    };

    // Add to UI state immediately - this is the single source of truth
    console.log('➕ Adding conversation turn optimistically:', turnId);
    setConversationTurns(prev => [...prev, newTurn]);

    try {
      // Session must exist (managed by SessionsContext)
      if (!currentSessionId) {
        throw new Error('No active session - cannot send message');
      }

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
      console.error("Chat error:", error);
      
      // Enhanced error handling (preserve existing logic)
      let errorMessage = "Failed to send message";
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Too many requests. Please wait a moment before trying again.";
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          errorMessage = "Authentication error. Please refresh the page and try again.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. The AI may be busy, please try again.";
        }
      }
      
      toast.error(errorMessage);
      
      // Remove failed turn on error
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