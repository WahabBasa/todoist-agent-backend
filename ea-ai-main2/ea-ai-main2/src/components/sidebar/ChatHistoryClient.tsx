import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useQuery, useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { Id } from "../../../convex/_generated/dataModel"

import { ChatMenuItem } from './ChatMenuItem'
import { ChatHistorySkeleton } from './ChatHistorySkeleton'
import { ClearHistoryAction } from './ClearHistoryAction'

interface ChatSession {
  _id: Id<"chatSessions">
  userId: Id<"users">
  title: string
  createdAt: number
  lastMessageAt: number
  messageCount: number
  isDefault?: boolean
}

interface ChatHistoryResponse {
  sessions: ChatSession[]
  hasMore: boolean
  nextOffset: number | null
}

interface ChatHistoryClientProps {
  onChatSelect?: (sessionId: Id<"chatSessions">) => void
  currentSessionId?: Id<"chatSessions"> | null
}

export function ChatHistoryClient({ onChatSelect, currentSessionId }: ChatHistoryClientProps) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()

  // Convex queries and actions
  const chatSessions = useQuery(api.chatSessions.getChatSessions, { 
    limit: 20, 
    offset: 0 
  }) as ChatHistoryResponse | undefined

  const deleteChatAction = useAction(api.chatSessions.deleteChatSession)
  const clearAllChatsAction = useAction(api.chatSessions.clearAllChatSessions)

  const fetchInitialChats = useCallback(async () => {
    if (chatSessions === undefined) {
      setIsLoading(true)
      return
    }
    
    setIsLoading(true)
    try {
      if (chatSessions) {
        setChats(chatSessions.sessions)
        setNextOffset(chatSessions.nextOffset)
      } else {
        setChats([])
        setNextOffset(null)
      }
    } catch (error) {
      console.error('Failed to load initial chats:', error)
      toast.error('Failed to load chat history.')
      setNextOffset(null)
    } finally {
      setIsLoading(false)
    }
  }, [chatSessions])

  useEffect(() => {
    fetchInitialChats()
  }, [fetchInitialChats])

  // Listen for chat history updates (similar to Morphic's event system)
  useEffect(() => {
    const handleHistoryUpdate = () => {
      startTransition(() => {
        fetchInitialChats()
      })
    }
    window.addEventListener('chat-history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('chat-history-updated', handleHistoryUpdate)
    }
  }, [fetchInitialChats])

  const fetchMoreChats = useCallback(async () => {
    if (isLoading || nextOffset === null) return

    setIsLoading(true)
    try {
      // In a real implementation, we'd need a separate query for pagination
      // For now, this is a placeholder for the infinite scroll functionality
      console.log('Fetching more chats with offset:', nextOffset)
      
      // This would need to be implemented in Convex as a separate query
      // const moreChatSessions = await convex.query(api.chatSessions.getChatSessions, {
      //   limit: 20,
      //   offset: nextOffset
      // })
      
      // setChats(prevChats => [...prevChats, ...moreChatSessions.sessions])
      // setNextOffset(moreChatSessions.nextOffset)
    } catch (error) {
      console.error('Failed to load more chats:', error)
      toast.error('Failed to load more chat history.')
      setNextOffset(null)
    } finally {
      setIsLoading(false)
    }
  }, [nextOffset, isLoading])

  // Infinite scroll observer
  useEffect(() => {
    const observerRefValue = loadMoreRef.current
    if (!observerRefValue || nextOffset === null || isPending) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading && !isPending) {
          fetchMoreChats()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(observerRefValue)

    return () => {
      if (observerRefValue) {
        observer.unobserve(observerRefValue)
      }
    }
  }, [fetchMoreChats, nextOffset, isLoading, isPending])

  const handleDeleteChat = async (sessionId: Id<"chatSessions">) => {
    try {
      await deleteChatAction({ sessionId })
      setChats(prevChats => prevChats.filter(chat => chat._id !== sessionId))
      toast.success('Chat deleted successfully')
      
      // Trigger history update event
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    } catch (error) {
      console.error('Failed to delete chat:', error)
      toast.error('Failed to delete chat')
    }
  }

  const handleClearAll = async () => {
    try {
      const result = await clearAllChatsAction({})
      setChats([])
      toast.success(`Cleared ${result.deletedSessions} chat sessions`)
      
      // Trigger history update event
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    } catch (error) {
      console.error('Failed to clear chats:', error)
      toast.error('Failed to clear chat history')
    }
  }

  const isHistoryEmpty = !isLoading && !chats.length && nextOffset === null

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex items-center justify-between w-full padding-secondary">
        <div className="text-secondary">History</div>
        <ClearHistoryAction 
          onClearAll={handleClearAll}
          empty={isHistoryEmpty} 
        />
      </div>
      
      <div className="flex-1 overflow-y-auto mb-2 relative scrollbar-hide">
        {isHistoryEmpty && !isPending ? (
          <div className="padding-secondary text-tertiary text-center">
            No chat history
          </div>
        ) : (
          <div className="gap-tertiary flex flex-col">
            {chats.map((chat: ChatSession) => (
              <ChatMenuItem 
                key={chat._id} 
                chat={chat}
                isActive={currentSessionId === chat._id}
                onSelect={() => onChatSelect?.(chat._id)}
                onDelete={() => handleDeleteChat(chat._id)}
              />
            ))}
          </div>
        )}
        <div ref={loadMoreRef} style={{ height: '1px' }} />
        {(isLoading || isPending) && (
          <div className="padding-secondary">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}