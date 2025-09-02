import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation } from "convex/react"
import { useUser } from '@clerk/clerk-react'
import { useChat } from '@ai-sdk/react'
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"

import { ChatMessages } from './ChatMessages'
import { ChatPanel } from './ChatPanel'

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
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const { user } = useUser()
  
  // Convex integration for session management
  const createDefaultSession = useMutation(api.chatSessions.createDefaultSession)
  
  // Query for default session
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {})
  
  // Load initial conversation data
  const conversation = useQuery(api.conversations.getConversationBySession, 
    sessionId ? { sessionId } : { sessionId: undefined }
  )
  const defaultConversation = useQuery(api.conversations.getConversation, 
    sessionId ? undefined : {}
  )
  const activeConversation = sessionId ? conversation : defaultConversation

  // Get saved messages for initial state
  const savedMessages = useMemo(() => {
    if (!activeConversation?.messages) return []
    
    return (activeConversation.messages as any[])
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map((msg, index) => ({
        id: `${msg.timestamp}-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }))
  }, [activeConversation])

  // Vercel AI SDK useChat hook - pointing to our HTTP API route
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: aiHandleSubmit,
    isLoading,
    stop,
    append,
    setMessages,
    data
  } = useChat({
    api: '/convex-http/api/chat', // Points to our Convex HTTP route
    headers: async () => {
      // Get Clerk JWT token for authentication
      if (!user) throw new Error('User not authenticated')
      const token = await user.getToken()
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    },
    body: {
      sessionId: sessionId || (defaultSession?._id)
    },
    initialMessages: savedMessages,
    onFinish: async (message, options) => {
      // Note: Conversation saving is now handled in the chatStream.ts onFinish callback
      // Just trigger chat history update for UI refresh
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: (error) => {
      console.error('Chat error:', error)
      toast.error(`Chat error: ${error.message}`)
    }
  })

  // Convert messages array to sections array (matching Morphic pattern)
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

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
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    if (sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

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

      // Update the body with current session ID
      aiHandleSubmit(e, {
        body: {
          sessionId: currentSessionId
        }
      })

    } catch (error) {
      console.error("Chat submission error:", error)
      toast.error("Failed to send message")
    }
  }

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  // Show loading state while authentication is resolving
  if (!user || (activeConversation === undefined && !sessionId && defaultSession === undefined)) {
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
        isLoading={isLoading}
        scrollContainerRef={scrollContainerRef}
        isStreaming={isLoading}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
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