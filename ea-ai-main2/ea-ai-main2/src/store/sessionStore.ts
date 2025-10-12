import { create } from "zustand"
import type { Id } from "../../convex/_generated/dataModel"

export type SessionMeta = {
  _id: Id<"chatSessions">
  title: string
  lastMessageAt: number
  messageCount: number
  isDefault?: boolean
  isOptimistic?: boolean
}

type SessionMap = Record<string, SessionMeta>

interface SessionStoreState {
  sessionMap: SessionMap
  sessionList: SessionMeta[]
  currentSessionId: Id<"chatSessions"> | null
  hasMessagesById: Record<string, boolean>
  actions: {
    setSessions: (sessions: SessionMeta[]) => void
    upsertSession: (session: SessionMeta) => void
    removeSession: (sessionId: Id<"chatSessions">) => void
    setCurrentSession: (sessionId: Id<"chatSessions"> | null) => void
    setHasMessages: (sessionId: Id<"chatSessions">, value: boolean) => void
    bumpSessionStats: (
      sessionId: Id<"chatSessions">,
      updates: {
        lastMessageAt?: number
        incrementMessageCount?: number
        setMessageCount?: number
        title?: string
      }
    ) => void
  }
}

function sortSessions(map: SessionMap): SessionMeta[] {
  return Object.values(map).sort((a, b) => {
    if (b.lastMessageAt === a.lastMessageAt) {
      return a._id.localeCompare(b._id)
    }
    return b.lastMessageAt - a.lastMessageAt
  })
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessionMap: {},
  sessionList: [],
  currentSessionId: null,
  hasMessagesById: {},
  actions: {
    setSessions: (sessions) => {
      set((state) => {
        const incomingMap: SessionMap = {}
        const hasMessagesById = { ...state.hasMessagesById }

        for (const session of sessions) {
          incomingMap[session._id] = { ...session, isOptimistic: false }
          const existingFlag = hasMessagesById[session._id] ?? false
          hasMessagesById[session._id] = existingFlag || session.messageCount > 0
        }

        // Preserve optimistic sessions that might not be in server payload yet
        for (const session of Object.values(state.sessionMap)) {
          if (session.isOptimistic && !incomingMap[session._id]) {
            incomingMap[session._id] = session
          }
        }

        return {
          sessionMap: incomingMap,
          sessionList: sortSessions(incomingMap),
          hasMessagesById,
        }
      })
    },
    upsertSession: (session) => {
      set((state) => {
        const sessionMap = { ...state.sessionMap, [session._id]: session }
        const hasMessagesById = {
          ...state.hasMessagesById,
          [session._id]: state.hasMessagesById[session._id] || session.messageCount > 0,
        }
        return {
          sessionMap,
          sessionList: sortSessions(sessionMap),
          hasMessagesById,
        }
      })
    },
    removeSession: (sessionId) => {
      set((state) => {
        if (!state.sessionMap[sessionId]) return state
        const sessionMap = { ...state.sessionMap }
        delete sessionMap[sessionId]
        const hasMessagesById = { ...state.hasMessagesById }
        delete hasMessagesById[sessionId]

        const currentSessionId = state.currentSessionId === sessionId ? null : state.currentSessionId

        return {
          sessionMap,
          sessionList: sortSessions(sessionMap),
          hasMessagesById,
          currentSessionId,
        }
      })
    },
    setCurrentSession: (sessionId) => {
      set({ currentSessionId: sessionId })
    },
    setHasMessages: (sessionId, value) => {
      set((state) => ({
        hasMessagesById: {
          ...state.hasMessagesById,
          [sessionId]: value,
        },
      }))
    },
    bumpSessionStats: (sessionId, updates) => {
      set((state) => {
        const target = state.sessionMap[sessionId]
        if (!target) return state

        const messageCount = (() => {
          if (typeof updates.setMessageCount === "number") {
            return Math.max(0, updates.setMessageCount)
          }
          if (typeof updates.incrementMessageCount === "number") {
            return Math.max(0, target.messageCount + updates.incrementMessageCount)
          }
          return target.messageCount
        })()

        const sessionMap: SessionMap = {
          ...state.sessionMap,
          [sessionId]: {
            ...target,
            title: updates.title ?? target.title,
            lastMessageAt: updates.lastMessageAt ?? target.lastMessageAt,
            messageCount,
          },
        }

        let nextHasMessages = state.hasMessagesById[sessionId] || false
        if (typeof updates.setMessageCount === "number") {
          nextHasMessages = updates.setMessageCount > 0
        } else if (messageCount > 0) {
          nextHasMessages = true
        }

        const hasMessagesById = {
          ...state.hasMessagesById,
          [sessionId]: nextHasMessages,
        }

        return {
          sessionMap,
          sessionList: sortSessions(sessionMap),
          hasMessagesById,
        }
      })
    },
  },
}))

export function getSessionMeta(sessionId: Id<"chatSessions"> | null): SessionMeta | null {
  if (!sessionId) return null
  const { sessionMap } = useSessionStore.getState()
  return sessionMap[sessionId] ?? null
}
