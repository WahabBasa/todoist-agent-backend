"use client";

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

// ChatHub pattern: Session management types
export interface ChatSession {
  _id: Id<"chatSessions">;
  title: string;
  lastMessageAt: number;
  messageCount: number;
  isDefault?: boolean;
}

// Sessions context interface - ChatHub centralized session management pattern
interface SessionsContextType {
  // Session state - single source of truth
  currentSessionId: Id<"chatSessions"> | null;
  sessions: ChatSession[];
  isLoadingSessions: boolean;
  
  // Session operations
  createNewSession: () => Promise<Id<"chatSessions">>;
  selectSession: (sessionId: Id<"chatSessions"> | null) => void;
  deleteSession: (sessionId: Id<"chatSessions">) => Promise<void>;
  
  // UI state
  activeView: "chat" | "settings";
  setActiveView: (view: "chat" | "settings") => void;
}

const SessionsContext = createContext<SessionsContextType | null>(null);

// ChatHub pattern: Sessions provider with centralized management
export function SessionsProvider({ children }: { children: ReactNode }) {
  // Convex session queries
  const sessionsQuery = useQuery(api.chatSessions.getChatSessions, {});
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {});
  
  // Convex mutations
  const createChatSession = useMutation(api.chatSessions.createChatSession);
  const deleteChatSession = useMutation(api.chatSessions.deleteChatSession);

  // Session state - single source of truth
  const [currentSessionId, setCurrentSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");

  // Extract sessions array safely
  const sessions = sessionsQuery?.sessions || [];
  const isLoadingSessions = sessionsQuery === undefined;

  // ChatHub pattern: No automatic default session loading
  // Users will always start with a fresh new session created by App.tsx

  // ChatHub pattern: Create new session
  const createNewSession = useCallback(async (): Promise<Id<"chatSessions">> => {
    try {
      console.log('➕ Creating new chat session');
      const newSessionId = await createChatSession({});
      
      // Immediately switch to the new session
      setCurrentSessionId(newSessionId);
      setActiveView("chat");
      
      // Trigger history refresh
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      
      console.log('✅ Created and switched to new session:', newSessionId);
      return newSessionId;
    } catch (error) {
      console.error("Failed to create new chat session:", error);
      toast.error("Failed to create new chat. Please try again.");
      throw error;
    }
  }, [createChatSession]);

  // ChatHub pattern: Select session
  const selectSession = useCallback((sessionId: Id<"chatSessions"> | null) => {
    console.log('🔄 Switching to session:', sessionId);
    setCurrentSessionId(sessionId);
    
    if (sessionId) {
      setActiveView("chat");
    }
  }, []);

  // ChatHub pattern: Delete session
  const deleteSession = useCallback(async (sessionId: Id<"chatSessions">) => {
    try {
      console.log('🗑️ Deleting session:', sessionId);
      await deleteChatSession({ sessionId });
      
      // If deleted session was current, clear it
      if (currentSessionId === sessionId) {
        console.log('🔄 Deleted session was current, clearing');
        setCurrentSessionId(null);
      }
      
      // Trigger history refresh
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      
      toast.success("Chat deleted successfully");
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      toast.error("Failed to delete chat. Please try again.");
      throw error;
    }
  }, [deleteChatSession, currentSessionId]);

  // Context value - single source of truth for sessions
  const contextValue: SessionsContextType = {
    // Session state
    currentSessionId,
    sessions,
    isLoadingSessions,
    
    // Session operations
    createNewSession,
    selectSession,
    deleteSession,
    
    // UI state  
    activeView,
    setActiveView,
  };

  return (
    <SessionsContext.Provider value={contextValue}>
      {children}
    </SessionsContext.Provider>
  );
}

// ChatHub pattern: Custom hook
export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error('useSessions must be used within a SessionsProvider');
  }
  return context;
}