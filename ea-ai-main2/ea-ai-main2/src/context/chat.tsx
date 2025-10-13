"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useSessions } from './sessions';
import { useChat as useVercelChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/clerk-react';
import type { UIMessage, ToolInvocationUIPart, TextUIPart } from '@ai-sdk/ui-utils';
import { useChatStore } from '../store/chatStore';
import { useSessionStore } from '../store/sessionStore';
import { useShallow } from 'zustand/shallow';
import type { UiStatus, UiMsg } from '../store/chatStore';
import { logChatEvent } from '../utils/chatLogger';

// Simple chat context interface - much cleaner than before
interface ChatContextType {
  // State from useConvexChat hook
  messages: UiMsg[];
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

function collectTextFromParts(parts: ReadonlyArray<any> | undefined): string {
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
type UiPart = UIMessage['parts'][number];

function partsEqual(a: UiPart[] | undefined, b: UiPart[] | undefined): boolean {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const aa = left[i];
    const bb = right[i];
    if (!aa || !bb) return false;
    if (aa.type !== bb.type) return false;
    if (aa.type === 'text') {
      if ((aa as TextUIPart).text !== (bb as TextUIPart).text) return false;
      continue;
    }
    if (aa.type === 'tool-invocation') {
      const aTool = (aa as ToolInvocationUIPart).toolInvocation;
      const bTool = (bb as ToolInvocationUIPart).toolInvocation;
      if (aTool.state !== bTool.state) return false;
      if (aTool.toolCallId !== bTool.toolCallId) return false;
      if (aTool.toolName !== bTool.toolName) return false;
      const aArgs = JSON.stringify(aTool.args ?? null);
      const bArgs = JSON.stringify(bTool.args ?? null);
      if (aArgs !== bArgs) return false;
      const aResult = JSON.stringify((aTool as any).result ?? null);
      const bResult = JSON.stringify((bTool as any).result ?? null);
      if (aResult !== bResult) return false;
      continue;
    }
    if (JSON.stringify(aa) !== JSON.stringify(bb)) return false;
  }
  return true;
}

function areUiMessagesEqual(a: UiMsg[], b: UiMsg[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (left.role !== right.role) return false;
    if (left.content !== right.content) return false;
    if (!partsEqual(left.parts, right.parts)) return false;
  }
  return true;
}

function cloneParts(parts: UIMessage['parts'] | undefined): UiPart[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(parts) as UiPart[];
    } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(parts));
  } catch {
    return parts.map((part) => ({ ...part })) as UiPart[];
  }
}

function mapConvexMessagesToUi(messages: any[] | undefined): UiMsg[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg: any, index: number) => {
      const timestamp = typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : undefined;
      const baseContent = typeof msg.content === 'string'
        ? msg.content
        : typeof msg.content === 'number'
          ? String(msg.content)
          : '';

      const parts = buildUiPartsFromConvexMessage(msg);
      const textFromParts = collectTextFromParts(parts);

      return {
        id: `${msg.timestamp ?? Date.now()}-${index}`,
        role: msg.role,
        content: textFromParts || baseContent || '',
        parts,
        createdAt: timestamp,
      } satisfies UiMsg;
    });
}

function buildUiPartsFromConvexMessage(msg: any): UiPart[] {
  if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return [];

  const parts: UiPart[] = [];
  const appendText = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push({ type: 'text', text: value } as TextUIPart);
    }
  };

  if (typeof msg.content === 'string') {
    appendText(msg.content);
  } else if (Array.isArray(msg.content)) {
    for (const entry of msg.content) {
      if (typeof entry?.text === 'string') {
        appendText(entry.text);
      }
    }
  }

  if (msg.role !== 'assistant') {
    return parts;
  }

  const toolStates: Record<string, string> | undefined =
    typeof msg.metadata === 'object' && msg.metadata !== null ? msg.metadata.toolStates : undefined;

  const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
  const toolResults = Array.isArray(msg.toolResults) ? msg.toolResults : [];

  const callMap = new Map<string, any>();
  for (const call of toolCalls) {
    if (call && typeof call.toolCallId === 'string') {
      callMap.set(call.toolCallId, call);
    }
  }

  const resultMap = new Map<string, any>();
  for (const result of toolResults) {
    if (result && typeof result.toolCallId === 'string') {
      resultMap.set(result.toolCallId, result);
    }
  }

  const ids = new Set<string>();
  for (const key of callMap.keys()) ids.add(key);
  for (const key of resultMap.keys()) ids.add(key);
  if (toolStates) {
    for (const key of Object.keys(toolStates)) {
      ids.add(key);
    }
  }

  for (const toolCallId of ids) {
    const call = callMap.get(toolCallId) ?? null;
    const result = resultMap.get(toolCallId) ?? null;
    const toolName = result?.toolName || call?.name || toolCallId;

    let state: ToolInvocationUIPart['toolInvocation']['state'] = 'call';
    const stateFromMetadata = toolStates?.[toolCallId];
    if (result) {
      state = 'result';
    } else if (stateFromMetadata === 'pending') {
      state = 'partial-call';
    } else if (stateFromMetadata === 'running') {
      state = 'call';
    }

    const toolInvocation: ToolInvocationUIPart['toolInvocation'] = {
      state,
      toolCallId,
      toolName,
    };

    if (call?.args !== undefined) {
      toolInvocation.args = call.args;
    }
    if (result?.result !== undefined) {
      (toolInvocation as any).result = result.result;
    }

    parts.push({ type: 'tool-invocation', toolInvocation } as ToolInvocationUIPart);
  }

  return parts;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { ensureDefaultSession, selectSession } = useSessions();
  // Tuple selector to avoid returning a new object each render (prevents getSnapshot caching loops)
  const [currentSessionId, currentSessionMeta, hasMessagesFlag] = useSessionStore(
    useShallow((s) => [
      s.currentSessionId,
      s.currentSessionId ? s.sessionMap[s.currentSessionId] ?? null : null,
      s.currentSessionId ? s.hasMessagesById[s.currentSessionId] ?? false : false,
    ])
  );
  const setHasMessages = useSessionStore((state) => state.actions.setHasMessages);
  const bumpSessionStats = useSessionStore((state) => state.actions.bumpSessionStats);
  const lastSyncedCountRef = React.useRef<Record<string, number>>({});
  const lastSyncedHasMessagesRef = React.useRef<Record<string, boolean>>({});
  const chatId = currentSessionId ?? "default";
  const prevSessionIdRef = React.useRef<string | null>(null);

  // Phase 4: guarded rehydration key to remount the chat hook safely when needed (e.g., on session switch)
  const [rehydrationKey, setRehydrationKey] = React.useState(0);
  const hookId = React.useMemo(() => `${chatId}:${rehydrationKey}`,[chatId, rehydrationKey]);

  const [uiError, setUiError] = React.useState<Error | null>(null);

  // Track last user text for retries and guard against duplicate retries
  const lastUserTextRef = React.useRef("");
  const pendingRetryRef = React.useRef(false);
  const queuedRetryRef = React.useRef(false);
  const skipVersionOnceRef = React.useRef(false);
  const lockRetryCountRef = React.useRef(0);
  // Queue the very first send until session is active; prefer this session id in transport
  const queuedFirstSendRef = React.useRef<{ sessionId: string; text: string } | null>(null);
  const pendingSendSessionIdRef = React.useRef<string | null>(null);
  
  // FIX: Use ref for canonicalHistoryVersion to stabilize transport during streaming
  const canonicalHistoryVersionRef = React.useRef(0);
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

  // Zustand store for UI state per session - select only what we need
  const setInputStore = useChatStore((s) => s.setInput);
  const setStatusStore = useChatStore((s) => s.setStatus);
  const replaceFromDb = useChatStore((s) => s.replaceFromDb);
  const appendUser = useChatStore((s) => s.appendUser);
  const ensureAssistantPlaceholder = useChatStore((s) => s.ensureAssistantPlaceholder);
  const updateAssistant = useChatStore((s) => s.updateAssistant);
  const clearStore = useChatStore((s) => s.clear);
  const resetStatuses = useChatStore((s) => s.resetStatuses);

  const emptyMsgsRef = React.useRef<UiMsg[]>([]);
  const [inputFromStore, storeMessages, storeStatus] = useChatStore(
    useShallow((s) => {
      const inst = s.instances[chatId];
      return [
        inst?.input ?? "",
        inst?.messages ?? emptyMsgsRef.current,
        inst?.status ?? 'ready',
      ] as const;
    })
  );

  // Auth header for Convex httpAction
  const { getToken } = useAuth();
  const updateChatTitle = useMutation(api.chatSessions.updateChatTitleFromMessage);

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

    const sid = pendingSendSessionIdRef.current ?? currentSessionId ?? undefined;
    if (sid) headers["X-Session-Id"] = sid as string;

    const body: any = {
      sessionId: sid ?? undefined,
      id: sid ?? undefined,
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
    reload
  } = useVercelChat({
    id: hookId,
    transport,
    // We no longer render from the hook's internal state; store is our source of truth
    onError: (err) => {
      // FIX: Always reset status first to prevent stuck states
      setStatusStore(chatId, 'ready');
      setUiError(null);
      
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
          logChatEvent(chatId, 'retry_scheduled_conflict', {
            canonicalVersion: canonicalHistoryVersionRef.current,
          });
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
          logChatEvent(chatId, 'retry_scheduled_lock', { backoff, attempt: n });
          setTimeout(() => { pendingRetryRef.current = false; }, backoff);
        }
        try { toast.message("Assistant is busy, retrying…"); } catch {}
        return;
      }

      // Non-retriable errors surface to the user
      try { toast.error(`Error: ${msg}`); } catch {}
      const displayError = err instanceof Error ? err : new Error(msg || 'Unknown error');
      setUiError(displayError);
    },
    onFinish: () => {
      setUiError(null);
      const last = messages[messages.length - 1] as UIMessage | undefined;
      const rawParts = Array.isArray(last?.parts)
        ? last?.parts
        : Array.isArray((last as any)?.content)
          ? (last as any).content
          : undefined;
      const parts = cloneParts(rawParts as UIMessage['parts'] | undefined);
      const text = last
        ? Array.isArray(last.parts)
          ? collectTextFromParts(last.parts)
          : typeof last.content === 'string'
            ? last.content
            : Array.isArray((last as any)?.content)
              ? collectTextFromParts((last as any).content)
              : ''
        : '';
      const hasToolPart = parts.some((part) => part?.type === 'tool-invocation');
      const nextStatus: UiStatus = !text.trim() && hasToolPart ? 'streaming' : 'ready';

      ensureAssistantPlaceholder(chatId);
      updateAssistant(chatId, { content: text, parts });

      logChatEvent(chatId, 'transport_finish', {
        hookMessages: messages.length,
        hasToolPart,
        textPreview: text.slice(0, 80),
        nextStatus,
      });

      setStatusStore(chatId, nextStatus);
      lockRetryCountRef.current = 0;
      const storeStatus = useChatStore.getState().instances[chatId]?.status;
      logChatEvent(chatId, 'status_after_finish', { storeStatus });
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      // Avoid calling reload() here to prevent finish-time flicker; live Convex query will reconcile
    },
  });
  const isLoading = storeStatus === 'submitted' || storeStatus === 'streaming';
  const isRetriable = false;

  const lastStatusLogRef = React.useRef({ hookStatus, storeStatus });
  const lastAssistantContentRef = React.useRef('');
  const lastAssistantPartsRef = React.useRef<UiPart[] | undefined>(undefined);

  // MERGED EFFECT: Stream sync + Status management (reduces cascade from 2 effects to 1)
  const lastStreamEndTimeRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const prevHookStatusRef = React.useRef(hookStatus);
  
  React.useEffect(() => {
    const prev = lastStatusLogRef.current;
    const prevStatus = prevHookStatusRef.current;
    prevHookStatusRef.current = hookStatus;
    
    // Log status changes
    if (prev.hookStatus !== hookStatus || prev.storeStatus !== storeStatus) {
      lastStatusLogRef.current = { hookStatus, storeStatus };
      logChatEvent(chatId, 'status_change', {
        hookStatus,
        storeStatus,
      });
    }

    // Extract last message data ONCE (used by all states)
    const last = messages[messages.length - 1] as UIMessage | undefined;
    const rawParts = Array.isArray(last?.parts)
      ? last?.parts
      : Array.isArray((last as any)?.content)
        ? (last as any).content
        : undefined;
    const textRaw = last
      ? Array.isArray(last?.parts)
        ? collectTextFromParts(last.parts)
        : typeof last?.content === 'string'
          ? last.content
          : Array.isArray((last as any)?.content)
            ? collectTextFromParts((last as any).content)
            : ''
      : '';
    const text = textRaw.replace(/^\n{1,2}/, '').replace(/\s+$/, '');
    const parts = cloneParts(rawParts as UIMessage['parts'] | undefined);

    // Handle streaming state
    if (hookStatus === 'streaming') {
      if (storeStatus !== 'streaming') setStatusStore(chatId, 'streaming');
      ensureAssistantPlaceholder(chatId);
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      const hasChanged =
        lastAssistantContentRef.current !== text ||
        !partsEqual(lastAssistantPartsRef.current, parts);
      
      if (hasChanged) {
        rafRef.current = requestAnimationFrame(() => {
          updateAssistant(chatId, { content: text, parts });
          lastAssistantContentRef.current = text;
          lastAssistantPartsRef.current = parts;
          rafRef.current = null;
          logChatEvent(chatId, 'stream_chunk_rendered', { textLength: text.length });
        });
      }
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    // Handle submitted state
    if (hookStatus === 'submitted') {
      if (storeStatus !== 'submitted') setStatusStore(chatId, 'submitted');
      return;
    }

    // Handle ready state (stream completed or idle)
    // Preserve 'submitted' while a manual HTTP request is in flight
    if (storeStatus === 'submitted') {
      return;
    }
    const toolParts = Array.isArray(rawParts)
      ? rawParts.filter((part: any) => part?.type === 'tool-invocation')
      : [];
    const mappedStatus: UiStatus = !text.trim() && toolParts.length > 0 ? 'streaming' : 'ready';
    if (storeStatus !== mappedStatus) setStatusStore(chatId, mappedStatus);

    // Update assistant content when stream finishes
    if (hookStatus === 'ready' && prevStatus !== 'ready') {
      const currentContent = storeMessages[storeMessages.length - 1]?.content;
      if (currentContent !== text) {
        updateAssistant(chatId, { content: text, parts });
        lastAssistantContentRef.current = text;
        lastAssistantPartsRef.current = parts;
        logChatEvent(chatId, 'stream_final_update', { textLength: text.length });
      }
      
      lastStreamEndTimeRef.current = Date.now();
      logChatEvent(chatId, 'stream_finished', {
        assistantPreview: text.slice(0, 80),
        canonicalVersion: canonicalHistoryVersionRef.current,
      });
    }

    // Cleanup
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [hookStatus, messages, chatId, storeStatus, storeMessages, setStatusStore, ensureAssistantPlaceholder, updateAssistant]);
  
  // FIX: Add timeout recovery for hung streams
  React.useEffect(() => {
    if (storeStatus !== 'streaming') return;
    
    const timeoutId = setTimeout(() => {
      console.warn('[CHAT] Stream timeout - resetting status');
      logChatEvent(chatId, 'stream_timeout');
      setStatusStore(chatId, 'ready');
      toast.error('Response timeout. Please try again.');
      queuedRetryRef.current = false;
      pendingRetryRef.current = false;
    }, 30000); // 30 second timeout
    
    return () => clearTimeout(timeoutId);
  }, [storeStatus, chatId, setStatusStore]);

  // Normalize DB (Convex) messages to store shape and replace when idle/ready
  React.useEffect(() => {
    if (activeConversation === undefined) return;

    const dbMsgs = mapConvexMessagesToUi(activeConversation?.messages);
    const localMsgs = storeMessages;
    const isEqual = areUiMessagesEqual(dbMsgs, localMsgs);

    // Smart DB Sync: Allow user messages immediately, preserve streaming assistant
    if (!isEqual) {
      const dbIsAhead = dbMsgs.length > localMsgs.length;
      const isActivelySyncingFromHook = hookStatus === 'streaming' || hookStatus === 'submitted';

      // Allow immediate user message display even during submit
      if (dbIsAhead && storeStatus === 'submitted') {
        // User message landed in DB while status still 'submitted'
        const lastLocal = localMsgs[localMsgs.length - 1];
        if (lastLocal?.role === 'user') {
          // Replace with DB version which includes the user message
          replaceFromDb(chatId, dbMsgs);
          logChatEvent(chatId, 'store_sync_user_message_immediate', {
            dbCount: dbMsgs.length,
            localCount: localMsgs.length,
          });
          return;
        }
      }

      // Preserve streaming assistant during active sync
      if (isActivelySyncingFromHook && localMsgs[localMsgs.length - 1]?.role === 'assistant') {
        if (dbIsAhead) {
          // Merge: take DB messages except last, keep local streaming assistant
          const mergedMsgs = [...dbMsgs.slice(0, -1), localMsgs[localMsgs.length - 1]];
          replaceFromDb(chatId, mergedMsgs);
          logChatEvent(chatId, 'store_sync_merged_during_streaming', {
            dbCount: dbMsgs.length,
            localCount: localMsgs.length,
            mergedCount: mergedMsgs.length,
          });
          return;
        }
        // DB behind, keep local optimistic state
        logChatEvent(chatId, 'store_skip_replace_preserving_stream', {
          hookStatus,
          status: storeStatus,
          dbCount: dbMsgs.length,
          localCount: localMsgs.length,
        });
        return;
      }

      // Only block sync if we're not ready and DB isn't ahead
      if (storeStatus !== 'ready' && !dbIsAhead) {
        logChatEvent(chatId, 'store_skip_replace_not_ready', {
          status: storeStatus,
          dbCount: dbMsgs.length,
          localCount: localMsgs.length,
        });
        return;
      }
    }

    const lastAssistant = dbMsgs.slice().reverse().find((msg) => msg.role === 'assistant');
    const assistantText = lastAssistant
      ? lastAssistant.content || collectTextFromParts(lastAssistant.parts)
      : '';
    if (lastAssistant && assistantText.trim()) {
      setStatusStore(chatId, 'ready');
      queuedRetryRef.current = false;
      pendingRetryRef.current = false;
      logChatEvent(chatId, 'status_reset_after_hydration', {
        assistantPreview: assistantText.slice(0, 80),
      });
    }
    const sessionId = currentSessionId;
    if (!sessionId) {
      return;
    }

    const serverMessageCount = dbMsgs.length;
    if (lastSyncedCountRef.current[sessionId] !== serverMessageCount) {
      const storeCount = currentSessionMeta?.messageCount ?? 0;
      if (storeCount !== serverMessageCount) {
        bumpSessionStats(sessionId, { setMessageCount: serverMessageCount });
      }
      lastSyncedCountRef.current[sessionId] = serverMessageCount;
    }

    const serverHasMessages = serverMessageCount > 0;
    if (lastSyncedHasMessagesRef.current[sessionId] !== serverHasMessages) {
      if (hasMessagesFlag !== serverHasMessages) {
        setHasMessages(sessionId, serverHasMessages);
      }
      lastSyncedHasMessagesRef.current[sessionId] = serverHasMessages;
    }
  }, [activeConversation, chatId, storeMessages, storeStatus, replaceFromDb, setStatusStore, currentSessionId, hasMessagesFlag, setHasMessages, currentSessionMeta, bumpSessionStats]);

  // Ensure input is always a string to avoid trim() issues
  const safeInput = inputFromStore ?? "";

  const clearChat = React.useCallback(() => {
    clearStore(chatId);
    if (currentSessionId) {
      setHasMessages(currentSessionId, false);
      bumpSessionStats(currentSessionId, { setMessageCount: 0 });
      lastSyncedHasMessagesRef.current[currentSessionId] = false;
      lastSyncedCountRef.current[currentSessionId] = 0;
    }
    window.dispatchEvent(new CustomEvent('clear-chat-requested'));
    toast.success("Chat cleared");
  }, [chatId, clearStore, currentSessionId, setHasMessages, bumpSessionStats]);
  
  // FIX: Add manual recovery for stuck states
  const forceResetStatus = React.useCallback(() => {
    setStatusStore(chatId, 'ready');
    lockRetryCountRef.current = 0;
    logChatEvent(chatId, 'manual_status_reset');
  }, [chatId, setStatusStore]);

  // Fresh session detection with optimistic store state
  const isFreshSession = React.useMemo(() => {
    if (!currentSessionId) return false;
    if (hasMessagesFlag) return false;
    if (storeMessages.length > 0) return false;

    if (Array.isArray(activeConversation?.messages)) {
      return activeConversation.messages.length === 0;
    }
    if (typeof currentSessionMeta?.messageCount === 'number') {
      return currentSessionMeta.messageCount === 0;
    }
    return true;
  }, [currentSessionId, hasMessagesFlag, storeMessages.length, activeConversation, currentSessionMeta]);

  // Our own input change handler (SDK-agnostic)
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e?.target?.value ?? '';
    setInputStore(chatId, next);
  }, [chatId, setInputStore]);

  // Our own submit handler using sendMessage
  const handleSubmitCompat = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const content = (inputFromStore || '').trim();
    if (!content || isLoading) return;

    void (async () => {
      let targetSessionId = currentSessionId;
      setInputStore(chatId, '');
      if (!targetSessionId) {
        try {
          targetSessionId = await ensureDefaultSession();
          selectSession(targetSessionId);
        } catch (err) {
          console.error('[CHAT] Failed to ensure default session before submit:', err);
          toast.error('Unable to start chat session. Please try again.');
          return;
        }
      }

      if (!targetSessionId) return;

      const now = Date.now();

      if (targetSessionId !== chatId) {
        setInputStore(targetSessionId, '');
        delete lastSyncedCountRef.current[targetSessionId];
        delete lastSyncedHasMessagesRef.current[targetSessionId];
      }
      lastUserTextRef.current = content;
      lastSentVersionRef.current = canonicalHistoryVersion;
      lockRetryCountRef.current = 0;
      setUiError(null);

      setHasMessages(targetSessionId, true);
      lastSyncedHasMessagesRef.current[targetSessionId] = true;

      try {
        setStatusStore(targetSessionId, 'submitted');
        logChatEvent(targetSessionId, 'user_submitted', {
          textPreview: content.slice(0, 80),
          length: content.length,
        });
        const appendedId = appendUser(targetSessionId, content);
        ensureAssistantPlaceholder(targetSessionId);
        lastAssistantContentRef.current = '';
        lastAssistantPartsRef.current = undefined;
        const appendedMessage = useChatStore.getState().instances[targetSessionId]?.messages.find((msg) => msg.id === appendedId);
        if (appendedMessage?.metrics) {
          logChatEvent(targetSessionId, 'user_message_sent_timing', {
            messageId: appendedMessage.id,
            sentAt: appendedMessage.metrics.sentAt ?? null,
            sentAtIso: appendedMessage.metrics.sentAt ? new Date(appendedMessage.metrics.sentAt).toISOString() : null,
            sentAtPerf: appendedMessage.metrics.sentAtPerf ?? null,
            textLength: content.length,
          }, { dedupe: false });
        }
        // Attempt to set a generated title for the first message (backend guards default-only)
        try {
          await updateChatTitle({
            sessionId: targetSessionId as any,
            firstMessage: content,
          });
        } catch (e) {
          // non-fatal
        }

        // Direct POST to /chat: update assistant immediately from JSON response
        try {
          const token = await getToken({ template: 'convex' });
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Request-Id': generateRequestId(),
          };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          headers['X-Session-Id'] = String(targetSessionId);

          const body = {
            message: content,
            sessionId: String(targetSessionId),
          };

          const res = await fetch(resolvedChatApi, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            throw new Error(`chat_http_${res.status}`);
          }
          const data = await res.json().catch(() => ({} as any));
          const text = typeof data?.response === 'string'
            ? data.response
            : typeof data?.text === 'string'
              ? data.text
              : '';

          ensureAssistantPlaceholder(targetSessionId);
          updateAssistant(targetSessionId, { content: text });
          setStatusStore(targetSessionId, 'ready');
          logChatEvent(targetSessionId, 'http_finish_update_assistant', { textLength: text.length });
        } catch (err) {
          console.error('[CHAT] direct POST /chat failed:', err);
          toast.error('Failed to get response. Please try again.');
          setStatusStore(targetSessionId, 'ready');
        }
      } catch (err) {
        console.error('[CHAT] sendMessage failed:', err);
      }
    })();
  }, [inputFromStore, isLoading, currentSessionId, ensureDefaultSession, selectSession, setInputStore, chatId, canonicalHistoryVersion, setUiError, setHasMessages, setStatusStore, appendUser, ensureAssistantPlaceholder, sendMessage]);

  // Retry queued message once we're idle/ready
  React.useEffect(() => {
    if (!queuedRetryRef.current) return;
    if (hookStatus !== 'ready') return;
    queuedRetryRef.current = false;
    try {
      if (typeof sendMessage === 'function' && lastUserTextRef.current) {
        setStatusStore(chatId, 'submitted');
        ensureAssistantPlaceholder(chatId);
        logChatEvent(chatId, 'retrying_queued_message', {
          textLength: lastUserTextRef.current.length,
        });
        void sendMessage({ text: lastUserTextRef.current });
      }
    } catch {}
  }, [hookStatus, sendMessage, chatId, setStatusStore, ensureAssistantPlaceholder]);

  const prevChatIdRef = React.useRef(chatId);
  React.useEffect(() => {
    if (prevChatIdRef.current === chatId) return;
    prevChatIdRef.current = chatId;
    logChatEvent(chatId, 'session_changed', { canonicalHistoryVersion });
    const lastSessionId = prevSessionIdRef.current;
    if (lastSessionId && lastSessionId !== chatId) {
      delete lastSyncedCountRef.current[lastSessionId];
      delete lastSyncedHasMessagesRef.current[lastSessionId];
    }
    prevSessionIdRef.current = chatId;
  }, [chatId, canonicalHistoryVersion]);

  // Flush a queued first send when the desired session becomes active
  React.useEffect(() => {
    const q = queuedFirstSendRef.current;
    if (!q) return;
    if (!currentSessionId || q.sessionId !== currentSessionId) return;
    try {
      if (typeof sendMessage === 'function') {
        pendingSendSessionIdRef.current = q.sessionId;
        skipVersionOnceRef.current = true; // avoid sending historyVersion on the very first message
        logChatEvent(q.sessionId, 'flushing_queued_first_send', {});
        void sendMessage({ text: q.text });
      }
    } finally {
      queuedFirstSendRef.current = null;
      pendingSendSessionIdRef.current = null;
    }
  }, [currentSessionId, sendMessage]);

  React.useEffect(() => {
    setInputStore(chatId, '');
  }, [chatId, setInputStore]);

  React.useEffect(() => {
    resetStatuses();
  }, [resetStatuses]);

  // Context value - much simpler than before!
  const contextValue: ChatContextType = {
    messages: storeMessages,
    input: safeInput,
    setInput: (val: string) => setInputStore(chatId, val),
    handleInputChange,
    handleSubmit: handleSubmitCompat,
    isLoading,
    // Filter benign errors from surfacing in the chat bubbles
    error: React.useMemo(() => {
      if (!uiError) return null;
      const msg = String(uiError.message || '').toLowerCase();
      if (msg.includes('history_conflict') || msg.includes('session_locked')) return null;
      return uiError;
    }, [uiError]),
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