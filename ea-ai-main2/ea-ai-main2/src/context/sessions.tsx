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
  ensureDefaultSession: () => Promise<Id<"chatSessions">>;
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
  const createDefaultSession = useMutation(api.chatSessions.createDefaultSession);
  const deleteChatSession = useMutation(api.chatSessions.deleteChatSession);

  // Session state - single source of truth
  const [currentSessionId, setCurrentSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");

  // Extract sessions array safely
  const sessions = sessionsQuery?.sessions || [];
  const isLoadingSessions = sessionsQuery === undefined;

  // Fixed: Proper default session management
  // Users start with a default session, and can create new sessions as needed

  // Ensure default session exists (called once on app initialization)
  const ensureDefaultSession = useCallback(async (): Promise<Id<"chatSessions">> => {
    console.log('📋 Ensuring default session exists');
    
    try {
      const defaultSessionId = await createDefaultSession();
      console.log('✅ Default session ready:', defaultSessionId);
      return defaultSessionId;
    } catch (error) {
      console.error("Failed to ensure default session:", error);
      toast.error("Failed to initialize default chat. Please try again.");
      throw error;
    }
  }, [createDefaultSession]);

  // Create new session (explicit user action)
  const createNewSession = useCallback(async (): Promise<Id<"chatSessions">> => {
    console.log('➕ Creating new chat session');
    
    try {
      const newSessionId = await createChatSession({});
      
      // Switch to the new session
      setCurrentSessionId(newSessionId);
      setActiveView("chat");
      
      console.log('✅ Created and switched to new session:', newSessionId);
      return newSessionId;
    } catch (error) {
      console.error("Failed to create new chat session:", error);
      toast.error("Failed to create new chat. Please try again.");
      throw error;
    }
  }, [createChatSession]);

  // ChatHub pattern: Select session
  const selectSession = useCallback(async (sessionId: Id<"chatSessions"> | null) => {
    console.log('🔄 Switching to session:', sessionId);
    
    // Return a promise to allow awaiting the session change
    return new Promise<void>((resolve) => {
      setCurrentSessionId(sessionId);
      
      if (sessionId) {
        setActiveView("chat");
      }
      
      // Small delay to ensure state updates are processed
      setTimeout(resolve, 0);
    });
  }, []);

  // ChatHub pattern: Delete session (pure reactive)
  const deleteSession = useCallback(async (sessionId: Id<"chatSessions">) => {
    console.log('🗑️ Deleting session:', sessionId);
    
    try {
      await deleteChatSession({ sessionId });
      console.log('✅ Session deleted - Convex reactivity will update UI');
      
      // Clear current session if it was the deleted one
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
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
    ensureDefaultSession,
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