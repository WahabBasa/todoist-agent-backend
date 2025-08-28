import { useEffect, useMemo, useRef, useState } from 'react'
import { useAction, useQuery, useMutation } from "convex/react"
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
  
  // Convex integration with session support
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
      // Ignore other role types
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

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

  // Session-aware handleSubmit for Convex integration
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setIsLoading(true)
    const inputValue = input.trim()
    setInput("")

    try {
      let currentSessionId = sessionId
      
      // If no session ID provided, use or create default session
      if (!currentSessionId) {
        if (defaultSession) {
          currentSessionId = defaultSession._id
        } else {
          // Create default session only when user starts chatting
          currentSessionId = await createDefaultSession()
        }
      }

      // Create current time context from user's browser
      const currentTimeContext = {
        currentTime: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toLocaleString(),
        timestamp: Date.now(),
        source: "user_browser"
      }

      // Send message with session context and current time
      const result = await chatWithAI({ 
        message: inputValue, 
        useHaiku,
        sessionId: currentSessionId,
        currentTimeContext
      })
      
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
      
      // Handle tool results feedback (preserve existing logic)
      if (result && typeof result === 'object' && 'toolResults' in result && Array.isArray((result as any).toolResults)) {
        const toolResults = (result as any).toolResults
        if (toolResults.length > 0) {
          const successfulToolCalls = toolResults.filter((tc: any) => tc.success)
          if (successfulToolCalls.length > 0) {
            toast.success(`Executed ${successfulToolCalls.length} action(s) successfully`)
          }
          
          const failedToolCalls = toolResults.filter((tc: any) => !tc.success)
          if (failedToolCalls.length > 0) {
            toast.error(`${failedToolCalls.length} action(s) failed`)
          }
        }
      }

      // Trigger chat history update
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
      
    } catch (error) {
      console.error("Chat error:", error)
      toast.error("Failed to send message")
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
        isLoading={isLoading}
        scrollContainerRef={scrollContainerRef}
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