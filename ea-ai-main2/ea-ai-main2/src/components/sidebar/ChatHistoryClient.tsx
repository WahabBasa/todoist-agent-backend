import { useTransition } from 'react'
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
  const [isPending, startTransition] = useTransition()

  // Convex queries and actions - render directly from this reactive data source
  const chatSessions = useQuery(api.chatSessions.getChatSessions, { 
    limit: 20, 
    offset: 0 
  }) as ChatHistoryResponse | undefined

  const deleteChatAction = useAction(api.chatSessions.deleteChatSession)
  const clearAllChatsAction = useAction(api.chatSessions.clearAllChatSessions)

  // Direct reactive data access - no intermediate state needed
  const chats = chatSessions?.sessions || []
  const nextOffset = chatSessions?.nextOffset || null
  const isLoading = chatSessions === undefined

  // Pagination would be handled by updating the useQuery parameters
  // For now, we return all chats as the backend is configured to do so

  // Infinite scroll would be implemented when backend pagination is added
  // Currently returning all sessions so no infinite scroll needed

  const handleDeleteChat = async (sessionId: Id<"chatSessions">) => {
    try {
      await deleteChatAction({ sessionId })
      toast.success('Chat deleted successfully')
      // Convex reactivity will automatically update the UI
    } catch (error) {
      console.error('Failed to delete chat:', error)
      toast.error('Failed to delete chat')
    }
  }

  const handleClearAll = async () => {
    try {
      const result = await clearAllChatsAction({})
      toast.success(`Cleared ${result.deletedSessions} chat sessions`)
      // Convex reactivity will automatically update the UI
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
        {/* Infinite scroll placeholder - will be implemented when backend pagination is added */}
        {(isLoading || isPending) && (
          <div className="padding-secondary">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}