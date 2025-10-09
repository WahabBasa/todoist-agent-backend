"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { SessionMeta, useSessionStore } from "../store/sessionStore";

// ChatHub pattern: Session management types
export type ChatSession = SessionMeta;

function areSessionsSynced(existingMap: Record<string, SessionMeta>, incoming: SessionMeta[]): boolean {
  const incomingById = new Map(incoming.map((session) => [session._id, session]));

  let nonOptimisticCount = 0;
  for (const session of Object.values(existingMap)) {
    if (session.isOptimistic) {
      continue;
    }
    nonOptimisticCount += 1;
    const fromServer = incomingById.get(session._id);
    if (!fromServer) {
      return false;
    }
    if (
      session.title !== fromServer.title ||
      session.lastMessageAt !== fromServer.lastMessageAt ||
      session.messageCount !== fromServer.messageCount ||
      Boolean(session.isDefault) !== Boolean(fromServer.isDefault)
    ) {
      return false;
    }
  }

  if (nonOptimisticCount !== incoming.length) {
    return false;
  }

  return true;
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

  const sessions = useSessionStore((state) => state.sessionList);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const setSessionsAction = useSessionStore((state) => state.actions.setSessions);
  const upsertSessionAction = useSessionStore((state) => state.actions.upsertSession);
  const removeSessionAction = useSessionStore((state) => state.actions.removeSession);
  const setCurrentSessionAction = useSessionStore((state) => state.actions.setCurrentSession);

  // Debug: Log admin status
  useEffect(() => {
    console.log('?? [FRONTEND] Admin check:', {
      adminStatus,
      isAdmin,
      isLoading: adminStatus === undefined,
      type: typeof adminStatus
    });
  }, [adminStatus, isAdmin]);

  useEffect(() => {
    if (!sessionsQuery) return;
    const incomingSessions = sessionsQuery.sessions || [];
    const { sessionMap } = useSessionStore.getState();
    if (areSessionsSynced(sessionMap, incomingSessions)) {
      return;
    }
    setSessionsAction(incomingSessions);
  }, [sessionsQuery, setSessionsAction]);
  
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

  const didLoadPersistedRef = useRef(false);
  useEffect(() => {
    if (didLoadPersistedRef.current) return;
    didLoadPersistedRef.current = true;
    const stored = loadPersistedSession();
    if (stored) {
      setCurrentSessionAction(stored);
    }
  }, [setCurrentSessionAction]);

  useEffect(() => {
    persistSession(currentSessionId);
  }, [currentSessionId]);

  // Session state - single source of truth with persistence
  const [activeView, setActiveViewState] = useState<"chat" | "settings" | "admin">("chat");

  // Enforce admin gating even if persisted state tries to open the admin view
  useEffect(() => {
    if (activeView === "admin" && !isAdmin) {
      setActiveViewState("chat");
    }
  }, [activeView, isAdmin]);

  // Extract sessions array safely
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

  useEffect(() => {
    if (isLoadingSessions) return;
    if (!currentSessionId) return;
    const sessionExists = sessions.some((session) => session._id === currentSessionId);
    if (!sessionExists) {
      console.warn('🗑️ Persisted session no longer exists, clearing:', currentSessionId);
      setCurrentSessionAction(null);
    }
  }, [isLoadingSessions, currentSessionId, sessions, setCurrentSessionAction]);

  // Fixed: Proper default session management
  // Users start with a default session, and can create new sessions as needed

  // Ensure default session exists (called once on app initialization)
  const ensureDefaultSession = useCallback(async (): Promise<Id<"chatSessions">> => {
    console.log('📋 Ensuring default session exists');
    
    try {
      const defaultSessionId = await createDefaultSession();
      const existing = useSessionStore.getState().sessionMap[defaultSessionId];
      if (!existing) {
        upsertSessionAction({
          _id: defaultSessionId,
          title: "New Chat",
          lastMessageAt: Date.now(),
          messageCount: 0,
          isDefault: true,
          isOptimistic: true,
        });
      }
      console.log('✅ Default session ready:', defaultSessionId);
      return defaultSessionId;
    } catch (error) {
      console.error("Failed to ensure default session:", error);
      toast.error("Failed to initialize default chat. Please try again.");
      throw error;
    }
  }, [createDefaultSession, upsertSessionAction]);

  // Create new session (explicit user action)
  const createNewSession = useCallback(async (): Promise<Id<"chatSessions">> => {
    console.log('➕ Creating new chat session');
    
    try {
      const newSessionId = await createChatSession({});
      upsertSessionAction({
        _id: newSessionId,
        title: "New Chat",
        lastMessageAt: Date.now(),
        messageCount: 0,
        isDefault: false,
        isOptimistic: true,
      });
      
      // Switch to the new session
      setCurrentSessionAction(newSessionId);
      setActiveViewState("chat");
      
      console.log('✅ Created and switched to new session:', newSessionId);
      return newSessionId;
    } catch (error) {
      console.error("Failed to create new chat session:", error);
      toast.error("Failed to create new chat. Please try again.");
      throw error;
    }
  }, [createChatSession, setCurrentSessionAction, upsertSessionAction]);

  // ChatHub pattern: Select session with persistence
  const selectSession = useCallback((sessionId: Id<"chatSessions"> | null) => {
    console.log('🔄 [SESSIONS DEBUG] Selecting session:', {
      sessionId,
      previousSessionId: currentSessionId
    });
    
    setCurrentSessionAction(sessionId);
    
    if (sessionId) {
      setActiveViewState("chat");
    }
  }, [currentSessionId, setCurrentSessionAction]);

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
      removeSessionAction(sessionId);
      
      // Clear current session if it was the deleted one
      if (currentSessionId === sessionId) {
        const nextSession = useSessionStore.getState().sessionList[0] ?? null;
        setCurrentSessionAction(nextSession?._id ?? null);
      }
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      toast.error("Failed to delete chat. Please try again.");
      throw error;
    }
  }, [deleteChatSession, currentSessionId, removeSessionAction, setCurrentSessionAction]);

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
