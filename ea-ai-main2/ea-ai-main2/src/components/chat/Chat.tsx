import { useEffect, useMemo, useRef, useState } from 'react'
import { useAction, useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"

import { ChatMessages } from './ChatMessages'
import { ChatPanel } from './ChatPanel'
import { useStreamingChat } from '@/hooks/use-streaming-chat'

// Define section structure (matching Morphic pattern)
interface ChatSection {
  id: string // User message ID
  userMessage: Message
  assistantMessages: Message[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  sessionId?: Id<"chatSessions"> | null
}

export function Chat({ sessionId }: ChatProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  
  // Streaming chat integration
  const { 
    streamingMessage, 
    isStreaming, 
    streamingError,
    sendStreamingMessage, 
    clearStreaming 
  } = useStreamingChat({ sessionId })
  
  // Convex integration with session support (keep for fallback and session management)
  const chatWithAI = useAction(api.ai.chatWithAI)
  const createDefaultSession = useMutation(api.chatSessions.createDefaultSession)
  const updateChatTitle = useMutation(api.chatSessions.updateChatTitleFromMessage)
  
  // Big-brain pattern: Query for default session (returns null if user not found)
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {})
  
  // Use session-aware conversation query or fallback to legacy
  const conversation = useQuery(api.conversations.getConversationBySession, 
    sessionId ? { sessionId } : { sessionId: undefined }
  )
  
  // Fallback to default session query if no session ID provided
  const defaultConversation = useQuery(api.conversations.getConversation, 
    sessionId ? undefined : {}
  )
  
  // Use the appropriate conversation data
  const activeConversation = sessionId ? conversation : defaultConversation
  
  // Local state for chat interface
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useHaiku] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  
  // Local pending user message for immediate UI feedback
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null)

  // Convert existing conversation messages to display format
  const messages = useMemo(() => {
    return activeConversation ? 
      ((activeConversation.messages as any[]) || [])
        .filter(msg => msg.role === "user" || msg.role === "assistant")
        .map((msg, index) => ({
          id: `${msg.timestamp}-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }))
      : []
  }, [activeConversation])

  // Convert messages array to sections array with streaming support
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    // Process existing conversation messages
    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    // Add pending user message + streaming response as new section
    if (pendingUserMessage) {
      const streamingSection: ChatSection = {
        id: pendingUserMessage.id,
        userMessage: pendingUserMessage,
        assistantMessages: streamingMessage ? [{
          id: streamingMessage.id,
          role: 'assistant',
          content: streamingMessage.content
        }] : []
      }
      result.push(streamingSection)
    }

    return result
  }, [messages, pendingUserMessage, streamingMessage])

  // Detect if scroll container is at the bottom (matching Morphic)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50 // threshold in pixels
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Set initial state

    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to the section when a new user message is sent (matching Morphic)
  useEffect(() => {
    if (sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // If the last message is from user, find the corresponding section
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages])

  // Streaming handleSubmit with immediate user message display
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isStreaming) return

    setIsLoading(true)
    const inputValue = input.trim()
    setInput("")

    try {
      // Handle session management
      let currentSessionId = sessionId
      if (!currentSessionId) {
        if (defaultSession) {
          currentSessionId = defaultSession._id
        } else {
          currentSessionId = await createDefaultSession()
        }
      }

      // Create pending user message for immediate UI feedback
      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        role: 'user',
        content: inputValue
      }
      
      // Immediately show user message in UI
      setPendingUserMessage(userMessage)

      // Start streaming response
      console.log('[Chat] Starting streaming for message:', inputValue.substring(0, 50) + '...')
      await sendStreamingMessage(inputValue, useHaiku)

      // Update chat title if this is the first message
      if (messages.length === 0 && currentSessionId) {
        try {
          await updateChatTitle({
            sessionId: currentSessionId,
            firstMessage: inputValue
          })
        } catch (error) {
          console.warn("Failed to update chat title:", error)
        }
      }

      // Trigger chat history update
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
      
    } catch (error) {
      console.error("Streaming chat error:", error)
      toast.error(streamingError || "Failed to send message")
      
      // Clear pending message on error
      setPendingUserMessage(null)
      clearStreaming()
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const onQuerySelect = (query: string) => {
    setInput(query)
  }

  // Cleanup completed streams and pending messages
  useEffect(() => {
    if (streamingMessage?.isComplete) {
      // Small delay to let user see the completed response
      const timer = setTimeout(() => {
        setPendingUserMessage(null)
        clearStreaming()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [streamingMessage?.isComplete, clearStreaming])

  // Handle streaming errors
  useEffect(() => {
    if (streamingError) {
      console.error('[Chat] Streaming error:', streamingError)
      toast.error('Streaming failed: ' + streamingError)
    }
  }, [streamingError])

  // Big-brain pattern: Show loading state while user authentication is resolving
  // defaultSession is undefined during auth loading, null when user not found/created yet
  if (activeConversation === undefined && !sessionId && defaultSession === undefined) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex items-center gap-secondary text-muted-foreground">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-tertiary">Loading conversation...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        sections={sections}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading || isStreaming}
        scrollContainerRef={scrollContainerRef}
        streamingMessageId={streamingMessage?.id}
        isStreaming={isStreaming}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading || isStreaming}
        messages={messages}
        showScrollToBottomButton={!isAtBottom}
        scrollContainerRef={scrollContainerRef}
        isComposing={isComposing}
        enterDisabled={enterDisabled}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  )
}