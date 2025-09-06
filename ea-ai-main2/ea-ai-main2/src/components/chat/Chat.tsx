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
  const questionRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Sidebar state for fixed input positioning
  const { state, isMobile } = useSidebar()
  
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
  
  // ChatGPT clone state pattern - simple and clean
  const [input, setInput] = useState("")
  const [question, setQuestion] = useState("") // Current user question (optimistic UI)
  const [isLoading, setIsLoading] = useState(false) // For backend processing
  const [showThinking, setShowThinking] = useState(false) // For thinking animation after scroll
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const [hasStartedChat, setHasStartedChat] = useState(false)

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

  // Enhanced UI state - empty chat detection and input positioning
  const isEmpty = messages.length === 0 && !question

  // Enhanced scroll behavior - works with fixed input architecture
  useEffect(() => {
    const scrollArea = messagesAreaRef.current
    if (scrollArea) {
      // Scroll to optimistic question message if it exists
      if (question && questionRef.current) {
        // Use scrollIntoView for precise positioning of user messages
        questionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        })
        
        // Show thinking animation after scroll completes
        if (isLoading) {
          const timer = setTimeout(() => {
            setShowThinking(true)
          }, 300)
          return () => clearTimeout(timer)
        }
      }
      // Scroll to bottom when new backend messages arrive
      else if (messages.length > 0) {
        // Scroll to bottom of messages area - fixed input stays visible
        scrollArea.scrollTo({
          top: scrollArea.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [messages, question, isLoading]) // Scroll on both optimistic and backend messages

  // Session-aware handleSubmit for Convex integration
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const inputValue = input.trim()
    setInput("")
    setQuestion(inputValue) // Show user message immediately (optimistic UI)
    setIsLoading(true)
    
    // Track that the chat has started for UI positioning
    if (isEmpty) {
      console.log('🎯 DEBUG: Starting new chat - isEmpty:', isEmpty, 'hasStartedChat:', hasStartedChat)
      setHasStartedChat(true)
    }

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

      // Clear optimistic UI once backend completes
      setQuestion("")
      setShowThinking(false)
      
      // Trigger chat history update
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
      
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
      setQuestion("") // Clear optimistic message on error
      setShowThinking(false)
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
    if (messages.length === 0 && !question) return
    
    // Clear optimistic state
    setQuestion("")
    setShowThinking(false)
    setInput("")
    setHasStartedChat(false)
    
    // Trigger a chat history refresh (this will clear messages from DB)
    window.dispatchEvent(new CustomEvent('clear-chat-requested'))
    
    toast.success("Chat cleared")
  }

  return (
    <>
      {/* Main Chat Container */}
      <div className="flex flex-col h-full w-full">
        {/* Header */}
        <header className="p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        </header>

        {/* Messages Area - Full height with bottom padding for fixed input */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Empty State Welcome */}
          {isEmpty && !hasStartedChat && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6">
                <div className="text-2xl font-bold">T</div>
              </div>
              <h2 className="text-2xl font-semibold mb-3">Welcome to TaskAI</h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
                Your intelligent task management assistant. Ask me anything about organizing your work, managing projects, or planning your day.
              </p>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div ref={messagesAreaRef} className="flex-1 overflow-y-auto pb-24">
            <div ref={messagesContainerRef} className="max-w-4xl mx-auto px-4 py-6 space-y-1">
              {/* Historical messages */}
              {messages.map((message) => (
                message.role === 'user' ? (
                  <UserMessage key={message.id} content={message.content} />
                ) : (
                  <AssistantMessage key={message.id} content={message.content} />
                )
              ))}

              {/* Optimistic user message */}
              {question && (
                <div ref={questionRef}>
                  <UserMessage content={question} />
                </div>
              )}

              {/* Typing indicator */}
              <TypingIndicator show={showThinking} />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Input Area - Outside main container, positioned fixed at bottom */}
      <div className={cn(
        "fixed bottom-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        // Adjust left positioning based on sidebar state
        isMobile || state === 'collapsed' ? 'left-0' : 'left-72'
      )}>
        <div className="max-w-4xl mx-auto p-4">
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
            showClearButton={messages.length > 0 || !!question}
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
    </>
  )
}