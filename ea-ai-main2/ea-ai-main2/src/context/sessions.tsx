"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
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
  isAdmin: boolean;
  
  // Session operations
  createNewSession: () => Promise<Id<"chatSessions">>;
  ensureDefaultSession: () => Promise<Id<"chatSessions">>;
  selectSession: (sessionId: Id<"chatSessions"> | null) => void;
  deleteSession: (sessionId: Id<"chatSessions">) => Promise<void>;
  
  // UI state
  activeView: "chat" | "settings" | "admin";
  setActiveView: (view: "chat" | "settings" | "admin") => void;
}

const SessionsContext = createContext<SessionsContextType | null>(null);

// ChatHub pattern: Sessions provider with centralized management
export function SessionsProvider({ children }: { children: ReactNode }) {
  // Convex session queries
  const sessionsQuery = useQuery(api.chatSessions.getChatSessions, {});
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {});
  const adminStatus = useQuery(api.auth.admin.isCurrentUserAdmin, {});
  const isAdmin = adminStatus === true;

  // Debug: Log admin status
  useEffect(() => {
    console.log('?? [FRONTEND] Admin check:', {
      adminStatus,
      isAdmin,
      isLoading: adminStatus === undefined,
      type: typeof adminStatus
    });
  }, [adminStatus, isAdmin]);
  
  // Convex mutations
  const createChatSession = useMutation(api.chatSessions.createChatSession);
  const createDefaultSession = useMutation(api.chatSessions.createDefaultSession);
  const deleteChatSession = useMutation(api.chatSessions.deleteChatSession);

  // Session persistence helpers
  const STORAGE_KEY = 'taskai_current_session_id';
  
  const loadPersistedSession = (): Id<"chatSessions"> | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (stored as Id<"chatSessions">) : null;
    } catch (error) {
      console.warn('Failed to load persisted session:', error);
      return null;
    }
  };
  
  const persistSession = (sessionId: Id<"chatSessions"> | null) => {
    try {
      if (sessionId) {
        localStorage.setItem(STORAGE_KEY, sessionId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to persist session:', error);
    }
  };

  // Session state - single source of truth with persistence
  const [currentSessionId, setCurrentSessionId] = useState<Id<"chatSessions"> | null>(() => {
    // Initialize from localStorage if available
    const stored = loadPersistedSession();
    console.log('🔄 [SESSIONS DEBUG] Initializing session state from localStorage:', stored);
    return stored;
  });
  
  // Debug: Log when currentSessionId changes
  React.useEffect(() => {
    console.log('🔄 [SESSIONS DEBUG] Current session ID changed:', currentSessionId);
  }, [currentSessionId]);
  const [activeView, setActiveViewState] = useState<"chat" | "settings" | "admin">("chat");

  // Enforce admin gating even if persisted state tries to open the admin view
  useEffect(() => {
    if (activeView === "admin" && !isAdmin) {
      setActiveViewState("chat");
    }
  }, [activeView, isAdmin]);

  // Extract sessions array safely
  const sessions = sessionsQuery?.sessions || [];
  const isLoadingSessions = sessionsQuery === undefined;
  
  // Debug: Log sessions
  React.useEffect(() => {
    console.log('🔄 [SESSIONS DEBUG] Sessions updated:', {
      isLoading: isLoadingSessions,
      sessionCount: sessions.length,
      sessions: sessions.map(s => ({
        id: s._id,
        title: s.title,
        isDefault: s.isDefault,
        messageCount: s.messageCount,
        lastMessageAt: new Date(s.lastMessageAt).toISOString()
      }))
    });
  }, [sessions, isLoadingSessions]);

  // Validate persisted session on app startup
  useEffect(() => {
    if (isLoadingSessions || !currentSessionId) return;
    
    // Check if the persisted session still exists in the database
    const sessionExists = sessions.some(session => session._id === currentSessionId);
    
    if (!sessionExists) {
      console.warn('🗑️ Persisted session no longer exists, clearing:', currentSessionId);
      setCurrentSessionId(null);
      persistSession(null);
    } else {
      console.log('✅ Persisted session validated:', currentSessionId);
    }
  }, [isLoadingSessions, currentSessionId, sessions]);

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
      setActiveViewState("chat");
      
      console.log('✅ Created and switched to new session:', newSessionId);
      return newSessionId;
    } catch (error) {
      console.error("Failed to create new chat session:", error);
      toast.error("Failed to create new chat. Please try again.");
      throw error;
    }
  }, [createChatSession]);

  // ChatHub pattern: Select session with persistence
  const selectSession = useCallback((sessionId: Id<"chatSessions"> | null) => {
    console.log('🔄 [SESSIONS DEBUG] Selecting session:', {
      sessionId,
      previousSessionId: currentSessionId
    });
    
    setCurrentSessionId(sessionId);
    persistSession(sessionId); // Persist to localStorage
    
    if (sessionId) {
      setActiveViewState("chat");
    }
  }, [currentSessionId]);

  const setActiveView = useCallback((view: "chat" | "settings" | "admin") => {
    if (view === "admin" && !isAdmin) {
      toast.error("Admin access required.");
      return;
    }
    setActiveViewState(view);
  }, [isAdmin]);

  // ChatHub pattern: Delete session (pure reactive)
  const deleteSession = useCallback(async (sessionId: Id<"chatSessions">) => {
    console.log('🗑️ Deleting session:', sessionId);
    
    try {
      await deleteChatSession({ sessionId });
      console.log('✅ Session deleted - Convex reactivity will update UI');
      
      // Clear current session if it was the deleted one
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        persistSession(null); // Clear from localStorage
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
    isAdmin,
    
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
