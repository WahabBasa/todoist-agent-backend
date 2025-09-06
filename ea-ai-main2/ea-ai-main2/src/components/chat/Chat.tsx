import { useEffect, useMemo, useRef, useState } from 'react'
import { useAction, useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { TypingIndicator } from './TypingIndicator'
import { ChatInput } from './ChatInput'
import { ChatGreeting } from './ChatGreeting'
import { useSidebar } from '../ui/sidebar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  sessionId?: Id<"chatSessions"> | null
}

export function Chat({ sessionId }: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Sidebar state for positioning context (no longer needed for fixed input)
  const { state, isMobile } = useSidebar()
  
  // Convex integration with session support
  const chatWithAI = useAction(api.ai.chatWithAI)
  const createDefaultSession = useMutation(api.chatSessions.createDefaultSession)
  const updateChatTitle = useMutation(api.chatSessions.updateChatTitleFromMessage)
  
  // Simplified query approach - single conversation query
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {})
  
  // Single query that handles both session-specific and default conversations
  const activeConversation = useQuery(
    api.conversations.getConversationBySession, 
    sessionId 
      ? { sessionId } // Use provided session ID
      : defaultSession 
        ? { sessionId: defaultSession._id } // Use default session ID when available
        : "skip" // Skip query if no session available
  )
  
  console.log('🔍 Query state:', { 
    sessionId, 
    hasDefaultSession: !!defaultSession, 
    defaultSessionId: defaultSession?._id,
    hasActiveConversation: !!activeConversation,
    messageCount: activeConversation?.messages?.length || 0
  })
  
  // Simplified state management following Gemini clone pattern
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false) // For backend processing
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false) // Track if user has started chatting

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

  // Simplified UI state - derived from messages
  const isEmpty = messages.length === 0
  const hasStartedChat = messages.length > 0
  const shouldShowCentered = isEmpty && !hasUserInteracted // Show centered only if empty AND user hasn't interacted

  // Natural scroll behavior following Gemini clone pattern
  useEffect(() => {
    const scrollArea = messagesAreaRef.current
    if (!scrollArea) return
    
    // Simple scroll to bottom when messages update or when loading
    if (messages.length > 0 || isLoading) {
      console.log('📜 Natural scroll: Scrolling to bottom')
      requestAnimationFrame(() => {
        scrollArea.scrollTo({
          top: scrollArea.scrollHeight,
          behavior: 'smooth'
        })
      })
    }
  }, [messages, isLoading])

  // Linear handleSubmit following Gemini clone pattern - trust Convex reactivity
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const inputValue = input.trim()
    setInput("") // Clear input immediately
    setIsLoading(true) // Show loading state
    setHasUserInteracted(true) // Trigger immediate UI transition
    
    console.log('📝 User message submitted:', inputValue)

    try {
      let currentSessionId = sessionId
      
      // If no session ID provided, use or create default session
      if (!currentSessionId) {
        if (defaultSession) {
          currentSessionId = defaultSession._id
          console.log('📋 Using existing default session:', currentSessionId)
        } else {
          // Create default session only when user starts chatting
          console.log('📋 Creating new default session')
          currentSessionId = await createDefaultSession()
        }
      } else {
        console.log('📋 Using provided session:', currentSessionId)
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
        useHaiku: false,
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
      
      // Handle tool results feedback
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
      
      console.log('✅ AI response completed - trusting Convex reactivity for UI updates')
      
    } catch (error) {
      console.error("Chat error:", error)
      
      // Enhanced error handling with specific messages
      let errorMessage = "Failed to send message"
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again."
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Too many requests. Please wait a moment before trying again."
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          errorMessage = "Authentication error. Please refresh the page and try again."
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. The AI may be busy, please try again."
        }
      }
      
      toast.error(errorMessage)
      console.log('❌ AI response failed')
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

  const handleClearChat = () => {
    if (messages.length === 0) return
    
    // Clear state
    setInput("")
    
    // Trigger a chat history refresh (this will clear messages from DB)
    window.dispatchEvent(new CustomEvent('clear-chat-requested'))
    
    toast.success("Chat cleared")
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      </header>

      {/* Messages Area - Scrollable Only */}
      <div className="flex-1 overflow-hidden">
        {/* Messages Scroll Area */}
        <div ref={messagesAreaRef} className="h-full overflow-y-auto pb-32">
          <div ref={messagesContainerRef} className="max-w-4xl mx-auto px-4 py-6 space-y-1">
            {/* Messages from Convex */}
            {messages.map((message) => (
              message.role === 'user' ? (
                <UserMessage key={message.id} content={message.content} />
              ) : (
                <AssistantMessage key={message.id} content={message.content} />
              )
            ))}

            {/* Thinking indicator - show when loading */}
            <TypingIndicator show={isLoading} />
          </div>
        </div>
      </div>

      {/* Dynamic Input Container - ChatHub Pattern */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 w-full flex flex-col items-center z-10",
        "justify-end md:justify-center px-2 md:px-4 pb-4 pt-16 gap-2",
        "bg-gradient-to-t from-background via-background/95 to-transparent",
        "transition-all duration-500 ease-in-out",
        shouldShowCentered && "top-0"
      )}>
        {/* Content Container with Constrained Width */}
        <div className="w-full md:w-[700px] lg:w-[720px] flex flex-col gap-3">
          {/* Greeting - Only show when centered */}
          {shouldShowCentered && <ChatGreeting />}
          
          {/* Input Container */}
          <div className={cn(
            "w-full p-4",
            "border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-design-lg",
            shouldShowCentered && "border-t-0 bg-transparent backdrop-blur-none rounded-design-lg"
          )}>
          <ChatInput
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onClear={handleClearChat}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            isLoading={isLoading}
            disabled={isLoading}
            placeholder="Ask a question..."
            showClearButton={messages.length > 0}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const form = e.currentTarget.closest('form')
                form?.requestSubmit()
              }
            }}
          />
          </div>
        </div>
      </div>
    </div>
  )
}