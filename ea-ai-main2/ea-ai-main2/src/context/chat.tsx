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
import { useChatStore } from '../store/chatStore';
import type { UiStatus } from '../store/chatStore';

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
  forceResetStatus: () => void; // FIX: Manual recovery for stuck states
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

const isDev = typeof import.meta !== "undefined" ? !!import.meta.env?.DEV : false;

function areUiMessagesEqual(a: Message[], b: Message[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (left.role !== right.role) return false;
    if (left.content !== right.content) return false;
  }
  return true;
}

function mapConvexMessagesToSdk(messages: any[] | undefined): UIMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
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
}

function messagesEqual(a: UIMessage[], b: UIMessage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
    if (a[i]?.role !== b[i]?.role) return false;
    if (a[i]?.content !== b[i]?.content) return false;
  }
  return true;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  // Session context - get current session from centralized state
  const { currentSessionId, sessions } = useSessions();
  const chatId = currentSessionId ?? "default";

  // Phase 4: guarded rehydration key to remount the chat hook safely when needed (e.g., on session switch)
  const [rehydrationKey, setRehydrationKey] = React.useState(0);
  const hookId = React.useMemo(() => `${chatId}:${rehydrationKey}`,[chatId, rehydrationKey]);

  // Track last user text for retries and guard against duplicate retries
  const lastUserTextRef = React.useRef("");
  const pendingRetryRef = React.useRef(false);
  const queuedRetryRef = React.useRef(false);
  const skipVersionOnceRef = React.useRef(false);
  const lockRetryCountRef = React.useRef(0);
  
  // FIX: Use ref for canonicalHistoryVersion to stabilize transport during streaming
  const canonicalHistoryVersionRef = React.useRef(0);

  const currentSessionMeta = React.useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((session) => session._id === currentSessionId) ?? null;
  }, [currentSessionId, sessions]);
  
  // Load messages for current session from Convex
  const activeConversation = useQuery(
    api.conversations.getConversationBySession,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  );

  const canonicalHistoryVersion = React.useMemo(() => {
    // Prefer live conversation length (reactive) to avoid staleness; fallback to sessions meta
    if (Array.isArray(activeConversation?.messages)) {
      return activeConversation.messages.length;
    }
    if (currentSessionMeta?.messageCount != null) {
      return currentSessionMeta.messageCount;
    }
    return 0;
  }, [currentSessionMeta, activeConversation?.messages]);
  
  // FIX: Keep ref updated with latest version
  React.useEffect(() => {
    canonicalHistoryVersionRef.current = canonicalHistoryVersion;
  }, [canonicalHistoryVersion]);
  
  // (zustand) No remount/rehydration tracking needed

  // Zustand store for UI state per session
  const {
    instances,
    setInput: setInputStore,
    setStatus: setStatusStore,
    replaceFromDb,
    appendUser,
    ensureAssistantPlaceholder,
    updateAssistant,
    clear: clearStore,
    resetStatuses,
  } = useChatStore();
  const currentInstance = instances[chatId] ?? { input: '', messages: [], status: 'ready' };

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

    const body: any = {
      sessionId: currentSessionId ?? undefined,
      id: currentSessionId ?? undefined,
      requestId,
      latestUserMessage,
      messages,
    };

    // Send historyVersion unless a one-time skip is requested after a conflict
    if (!skipVersionOnceRef.current) {
      body.historyVersion = canonicalHistoryVersionRef.current; // FIX: Use ref instead of closure
    }
    // consume the flag
    skipVersionOnceRef.current = false;

    return { headers, body };
  }, [getToken, currentSessionId]); // FIX: Removed canonicalHistoryVersion from dependencies to stabilize transport

  // Memoize transport to prevent re-instantiating useChat on each render
  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: resolvedChatApi,
      prepareSendMessagesRequest,
    });
  }, [resolvedChatApi, prepareSendMessagesRequest]);

  // Track last sent version to gate retries until DB catches up
  const lastSentVersionRef = React.useRef<number>(0);

  const {
    messages,
    sendMessage,
    status: hookStatus,
    reload,
    error
  } = useVercelChat({
    id: hookId,
    transport,
    // We no longer render from the hook's internal state; store is our source of truth
    onError: (err) => {
      // FIX: Always reset status first to prevent stuck states
      setStatusStore(chatId, 'ready');
      
      // Ignore validation error for empty text
      if (err instanceof Error && err.message === "latestUserMessage_missing") return;

      const msg = String((err as any)?.message ?? "");
      const isLocked = /409|session_locked/i.test(msg);
      const isConflict = /history_conflict/i.test(msg);

      if (isConflict) {
        // Canonical history mismatch: skip version once, then retry quickly
        skipVersionOnceRef.current = true;
        if (!pendingRetryRef.current && lastUserTextRef.current) {
          pendingRetryRef.current = true;
          queuedRetryRef.current = true;
          if (isDev) {
            console.debug('[CHAT] scheduling retry due to history conflict', {
              chatId,
              canonicalVersion: canonicalHistoryVersionRef.current,
            });
          }
          setTimeout(() => { pendingRetryRef.current = false; }, 500);
        }
        return;
      }

      if (isLocked) {
        // Session locked: retry with bounded exponential backoff
        const n = Math.min(lockRetryCountRef.current + 1, 3);
        lockRetryCountRef.current = n;
        if (!pendingRetryRef.current && lastUserTextRef.current && n <= 3) {
          pendingRetryRef.current = true;
          queuedRetryRef.current = true;
          const backoff = 400 * Math.pow(2, n - 1); // 400, 800, 1600ms
          if (isDev) {
            console.debug('[CHAT] scheduling retry due to session lock', { chatId, backoff, attempt: n });
          }
          setTimeout(() => { pendingRetryRef.current = false; }, backoff);
        }
        try { toast.message("Assistant is busy, retrying…"); } catch {}
        return;
      }

      // Non-retriable errors surface to the user
      try { toast.error(`Error: ${msg}`); } catch {}
    },
    onFinish: () => {
      const last = messages[messages.length - 1] as any;
      let text = '';
      let hasToolPart = false;
      if (last) {
        if (Array.isArray(last?.parts)) {
          text = collectTextFromParts(last.parts);
          hasToolPart = last.parts.some((part: any) => typeof part?.type === 'string' && part.type.startsWith('tool-'));
        } else if (typeof last?.content === 'string') {
          text = last.content;
        } else if (Array.isArray(last?.content)) {
          text = collectTextFromParts(last.content);
        }
      }

      const nextStatus: UiStatus = !text.trim() && hasToolPart ? 'streaming' : 'ready';

      if (!text.trim() && hasToolPart) {
        ensureAssistantPlaceholder(chatId);
        updateAssistant(chatId, 'Working on tool response…');
      }

      if (isDev) {
        console.debug('[CHAT] onFinish from transport', {
          chatId,
          hookMessages: messages.length,
          hasToolPart,
          textPreview: text.slice(0, 80),
          nextStatus,
        });
      }

      setStatusStore(chatId, nextStatus);
      lockRetryCountRef.current = 0;
      if (isDev) {
        const storeStatus = useChatStore.getState().instances[chatId]?.status;
        console.debug('[CHAT] status after finish', {
          chatId,
          storeStatus,
        });
      }
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      try {
        if (typeof reload === 'function') {
          if (isDev) {
            console.debug('[CHAT] triggering reload after finish', { chatId });
          }
          reload();
          if (isDev) {
            console.debug('[CHAT] reload returned', { chatId });
          }
        }
      } catch (err) {
        console.warn('[CHAT] reload after finish failed', err);
      }
    },
  });
  const isLoading = currentInstance.status === 'submitted' || currentInstance.status === 'streaming';
  const isRetriable = false;

  // Stream sync: mirror hook streaming into store assistant placeholder
  React.useEffect(() => {
    if (isDev) {
      console.debug('[CHAT] hookStatus change', {
        chatId,
        hookStatus,
        storeStatus: currentInstance.status,
        hookMessages: messages.length,
      });
    }
    if (hookStatus === 'streaming') {
      // derive assistant text from hook messages
      const last = messages[messages.length - 1] as any;
      let text = '';
      if (last) {
        if (Array.isArray(last.parts)) text = collectTextFromParts(last.parts);
        else if (typeof last.content === 'string') text = last.content;
        else if (Array.isArray(last.content)) text = collectTextFromParts(last.content);
      }
      setStatusStore(chatId, 'streaming');
      ensureAssistantPlaceholder(chatId);
      updateAssistant(chatId, text);
    }
  }, [hookStatus, messages, chatId, setStatusStore, ensureAssistantPlaceholder, updateAssistant]);

  const prevHookStatusRef = React.useRef(hookStatus);
  React.useEffect(() => {
    const prev = prevHookStatusRef.current;
    prevHookStatusRef.current = hookStatus;

    let mappedStatus: UiStatus;
    if (hookStatus === 'streaming' || hookStatus === 'submitted') {
      mappedStatus = hookStatus as UiStatus;
    } else {
      const last = messages[messages.length - 1] as any;
      let text = '';
      let hasToolPart = false;
      if (last) {
        if (Array.isArray(last?.parts)) {
          text = collectTextFromParts(last.parts);
          hasToolPart = last.parts.some((part: any) => typeof part?.type === 'string' && part.type.startsWith('tool-'));
        } else if (typeof last?.content === 'string') {
          text = last.content;
        } else if (Array.isArray(last?.content)) {
          text = collectTextFromParts(last.content);
        }
      }

      mappedStatus = !text.trim() && hasToolPart ? 'streaming' : 'ready';
    }

    setStatusStore(chatId, mappedStatus);

    if (hookStatus === 'ready' && prev !== 'ready') {
      const last = messages[messages.length - 1] as any;
      let text = '';
      if (last) {
        if (Array.isArray(last?.parts)) text = collectTextFromParts(last.parts);
        else if (typeof last?.content === 'string') text = last.content;
        else if (Array.isArray(last?.content)) text = collectTextFromParts(last.content);
      }

      if (text) {
        updateAssistant(chatId, text);
      }

      if (isDev) {
        console.debug('[CHAT] stream finished', {
          chatId,
          assistantPreview: text.slice(0, 80),
          canonicalVersion: canonicalHistoryVersionRef.current,
        });
      }
    }
  }, [chatId, hookStatus, messages, setStatusStore, updateAssistant]);
  
  // FIX: Add timeout recovery for hung streams
  React.useEffect(() => {
    if (currentInstance.status !== 'streaming') return;
    
    const timeoutId = setTimeout(() => {
      console.warn('[CHAT] Stream timeout - resetting status');
      setStatusStore(chatId, 'ready');
      toast.error('Response timeout. Please try again.');
      queuedRetryRef.current = false;
      pendingRetryRef.current = false;
    }, 30000); // 30 second timeout
    
    return () => clearTimeout(timeoutId);
  }, [currentInstance.status, chatId, setStatusStore]);

  // Normalize DB (Convex) messages to store shape and replace when idle/ready
  React.useEffect(() => {
    if (activeConversation === undefined) return;
    const mapped = mapConvexMessagesToSdk(activeConversation?.messages);
    const dbMsgs: Message[] = mapped.map((m: any, idx: number) => {
      let text = '';
      if (Array.isArray(m.parts)) text = collectTextFromParts(m.parts);
      else if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) text = collectTextFromParts(m.content);
      return { id: m.id ?? String(idx), role: m.role, content: text };
    });

    const localMsgs = currentInstance.messages;
    const isEqual = areUiMessagesEqual(dbMsgs, localMsgs);

    if (isDev) {
      const lastLocal = localMsgs[localMsgs.length - 1];
      const lastDb = dbMsgs[dbMsgs.length - 1];
      console.debug('[CHAT] hydration check', {
        chatId,
        localCount: localMsgs.length,
        dbCount: dbMsgs.length,
        isEqual,
        localLastRole: lastLocal?.role ?? null,
        dbLastRole: lastDb?.role ?? null,
        storeStatus: currentInstance.status,
      });
    }

    if (!isEqual) {
      replaceFromDb(chatId, dbMsgs);
      if (isDev) {
        console.debug('[CHAT] store replaced from Convex', {
          chatId,
          nextCount: dbMsgs.length,
        });
      }
    }

    const lastAssistant = dbMsgs.slice().reverse().find((msg) => msg.role === 'assistant');
    if (lastAssistant && lastAssistant.content.trim()) {
      setStatusStore(chatId, 'ready');
      queuedRetryRef.current = false;
      pendingRetryRef.current = false;
      if (isDev) {
        console.debug('[CHAT] status reset after Convex hydration', {
          chatId,
          assistantPreview: lastAssistant.content.slice(0, 80),
        });
      }
    }
  }, [activeConversation, chatId, currentInstance.messages, currentInstance.status, replaceFromDb, setStatusStore]);

  // Ensure input is always a string to avoid trim() issues
  const safeInput = currentInstance.input ?? "";

  const clearChat = React.useCallback(() => {
    clearStore(chatId);
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, [chatId, clearStore]);
  
  // FIX: Add manual recovery for stuck states
  const forceResetStatus = React.useCallback(() => {
    setStatusStore(chatId, 'ready');
    lockRetryCountRef.current = 0;
    console.log('[CHAT] Manual status reset');
  }, [chatId, setStatusStore]);

  // Fresh session detection: prefer sessions meta; else conversation; allow initial loading to show greeting for new sessions
  const isFreshSession = React.useMemo(() => {
    if (currentInstance.status !== 'ready') return false; // avoid greeting during streaming/submitted
    if (typeof currentSessionMeta?.messageCount === 'number') {
      return currentSessionMeta.messageCount === 0;
    }
    if (activeConversation === undefined) return true; // loading: favor greeting for empty new chat
    if (Array.isArray(activeConversation?.messages)) {
      return activeConversation.messages.length === 0;
    }
    return false;
  }, [currentInstance.status, currentSessionMeta, activeConversation]);

  // Our own input change handler (SDK-agnostic)
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e?.target?.value ?? '';
    setInputStore(chatId, next);
  }, [chatId, setInputStore]);

  // Our own submit handler using sendMessage
  const handleSubmitCompat = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const content = (currentInstance.input || '').trim();
    if (!content || isLoading) return;
    setInputStore(chatId, '');
    lastUserTextRef.current = content;
    lastSentVersionRef.current = canonicalHistoryVersion;
    lockRetryCountRef.current = 0;
    try {
      setStatusStore(chatId, 'submitted');
      appendUser(chatId, content);
      ensureAssistantPlaceholder(chatId);
      if (typeof sendMessage === 'function') {
        void sendMessage({ text: content });
      } else {
        console.warn('[CHAT] sendMessage not available on useChat return');
      }
    } catch (err) {
      console.error('[CHAT] sendMessage failed:', err);
    }
  }, [currentInstance.input, isLoading, sendMessage, canonicalHistoryVersion, chatId, setInputStore, setStatusStore, appendUser, ensureAssistantPlaceholder]);

  // Retry queued message once we're idle/ready
  React.useEffect(() => {
    if (!queuedRetryRef.current) return;
    if (hookStatus !== 'ready') return;
    queuedRetryRef.current = false;
    try {
      if (typeof sendMessage === 'function' && lastUserTextRef.current) {
        setStatusStore(chatId, 'submitted');
        ensureAssistantPlaceholder(chatId);
        if (isDev) {
          console.debug('[CHAT] retrying queued message', {
            chatId,
            textLength: lastUserTextRef.current.length,
          });
        }
        void sendMessage({ text: lastUserTextRef.current });
      }
    } catch {}
  }, [hookStatus, sendMessage, chatId, setStatusStore, ensureAssistantPlaceholder]);

  const prevChatIdRef = React.useRef(chatId);
  React.useEffect(() => {
    if (prevChatIdRef.current === chatId) return;
    prevChatIdRef.current = chatId;
    if (isDev) {
      console.debug('[CHAT] session switched', { chatId, canonicalHistoryVersion });
    }
  }, [chatId, canonicalHistoryVersion]);

  React.useEffect(() => {
    setInputStore(chatId, '');
  }, [chatId, setInputStore]);

  React.useEffect(() => {
    resetStatuses();
  }, [resetStatuses]);

  // Context value - much simpler than before!
  const contextValue: ChatContextType = {
    messages: currentInstance.messages,
    input: safeInput,
    setInput: (val: string) => setInputStore(chatId, val),
    handleInputChange,
    handleSubmit: handleSubmitCompat,
    isLoading,
    // Filter benign errors from surfacing in the chat bubbles
    error: React.useMemo(() => {
      if (!error) return null;
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('history_conflict') || msg.includes('session_locked')) return null;
      return error;
    }, [error]),
    isRetriable,
    clearChat,
    reload,
    isFreshSession,
    forceResetStatus, // FIX: Manual recovery for stuck states
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