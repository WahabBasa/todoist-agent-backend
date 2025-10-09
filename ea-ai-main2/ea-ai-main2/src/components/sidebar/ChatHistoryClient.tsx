import { useState } from 'react'
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { Id } from "../../../convex/_generated/dataModel"

import { ChatMenuItem } from './ChatMenuItem'
import { ChatHistorySkeleton } from './ChatHistorySkeleton'
import { ClearHistoryAction } from './ClearHistoryAction'
import { useSessions } from '../../context/sessions'
import { useSessionStore } from '../../store/sessionStore'
import { useChatStore } from '../../store/chatStore'

interface ChatHistoryClientProps {
  onChatSelect?: (sessionId: Id<"chatSessions">) => void
  currentSessionId?: Id<"chatSessions"> | null
}

export function ChatHistoryClient({ onChatSelect, currentSessionId }: ChatHistoryClientProps) {
  const { sessions, currentSessionId: storeCurrentId, selectSession, deleteSession, isLoadingSessions } = useSessions()
  const clearAllChats = useMutation(api.chatSessions.clearAllChatSessions)
  const clearBySession = useMutation(api.conversations.clearConversationsBySession)
  const updateSessionMeta = useMutation(api.chatSessions.updateChatSession)

  const [deletingIds, setDeletingIds] = useState<Set<Id<"chatSessions">>>(new Set())

  const activeSessionId = currentSessionId ?? storeCurrentId
  const visibleChats = sessions.filter((session) => !deletingIds.has(session._id))

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    if (onChatSelect) {
      onChatSelect(sessionId)
    } else {
      selectSession(sessionId)
    }
  }

  const handleDeleteChat = async (sessionId: Id<"chatSessions">) => {
    try {
      setDeletingIds((prev) => new Set(prev).add(sessionId))
      await deleteSession(sessionId)
      toast.success('Chat deleted successfully')
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(sessionId); return next })
    } catch (error) {
      console.error('Failed to delete chat:', error)
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(sessionId); return next })
      toast.error('Failed to delete chat')
    }
  }

  const handleClearChat = async (sessionId: Id<"chatSessions">) => {
    try {
      await clearBySession({ sessionId })
      await updateSessionMeta({ sessionId, messageCount: 0, lastMessageAt: Date.now() })
      useSessionStore.getState().actions.setHasMessages(sessionId, false)
      useSessionStore.getState().actions.bumpSessionStats(sessionId, { setMessageCount: 0, lastMessageAt: Date.now() })
      if (activeSessionId === sessionId) {
        useChatStore.getState().clear(String(sessionId))
      }
      toast.success('Chat messages cleared')
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    } catch (error) {
      console.error('Failed to clear messages:', error)
      toast.error('Failed to clear messages')
    }
  }

  const handleClearAll = async () => {
    try {
      if (sessions.length) {
        const toRemove = sessions.filter((session) => !session.isDefault).map((session) => session._id)
        if (toRemove.length) {
          setDeletingIds((prev) => new Set([...Array.from(prev), ...toRemove]))
        }
      }
      const result = await clearAllChats({})
      toast.success(`Cleared ${result.deletedSessions} chat sessions`)
      setDeletingIds(new Set())
    } catch (error) {
      console.error('Failed to clear chats:', error)
      setDeletingIds(new Set())
      toast.error('Failed to clear chat history')
    }
  }

  const isHistoryEmpty = !isLoadingSessions && visibleChats.length === 0

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex items-center justify-between w-full p-3 mb-3">
        <div className="text-secondary">History</div>
        <ClearHistoryAction
          onClearAll={handleClearAll}
          empty={isHistoryEmpty}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto mb-3 relative scrollbar-hide">
        {isHistoryEmpty ? (
          <div className="p-3 text-tertiary text-center">
            No chat history
          </div>
        ) : (
          <div className="gap-tertiary flex flex-col">
            {visibleChats.map((chat) => (
              <ChatMenuItem
                key={chat._id}
                chat={chat}
                isActive={activeSessionId === chat._id}
                onSelect={() => handleChatSelect(chat._id)}
                onDelete={() => void handleDeleteChat(chat._id)}
                onClear={() => void handleClearChat(chat._id)}
                canDelete={true}
                isDeleting={deletingIds.has(chat._id)}
              />
            ))}
          </div>
        )}
        {isLoadingSessions && (
          <div className="p-3">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}