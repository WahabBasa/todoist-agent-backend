import { useEffect, useMemo, useRef, useState } from 'react'
import { useAction, useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import { ConversationTurn } from './ConversationTurn'
import { ChatInput } from './ChatInput'
import { ChatGreeting } from './ChatGreeting'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ConversationTurnData {
  id: string
  userMessage: string
  aiMessage?: string
  isThinking: boolean
}

interface ChatProps {
  sessionId?: Id<"chatSessions"> | null
}

export function Chat({ sessionId }: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
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
  
  // Simplified state management following ChatHub pattern
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false) // For backend processing
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const [currentUserMessage, setCurrentUserMessage] = useState<string | null>(null) // Track message being processed

  // Convert existing conversation messages to conversation turns (ChatHub pattern)
  const conversationTurns = useMemo(() => {
    const turns: ConversationTurnData[] = []
    
    if (activeConversation?.messages) {
      const allMessages = ((activeConversation.messages as any[]) || [])
        .filter(msg => msg.role === "user" || msg.role === "assistant")
        .map((msg, index) => ({
          id: `${msg.timestamp}-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.timestamp
        }))
      
      // Group messages into conversation turns (user message + AI response)
      let currentUserMessage: Message | null = null
      
      for (const message of allMessages) {
        if (message.role === 'user') {
          // Start a new conversation turn
          currentUserMessage = message
        } else if (message.role === 'assistant' && currentUserMessage) {
          // Complete the conversation turn
          turns.push({
            id: currentUserMessage.id,
            userMessage: currentUserMessage.content,
            aiMessage: message.content,
            isThinking: false
          })
          currentUserMessage = null
        }
      }
      
      // Handle incomplete turn (user message without AI response yet)
      if (currentUserMessage) {
        turns.push({
          id: currentUserMessage.id,
          userMessage: currentUserMessage.content,
          aiMessage: undefined,
          isThinking: isLoading // Show thinking if we're currently processing
        })
      }
    }
    
    // Handle the case where user just sent first message and it's not in DB yet
    if (turns.length === 0 && currentUserMessage && isLoading) {
      turns.push({
        id: `temp-${Date.now()}`,
        userMessage: currentUserMessage,
        aiMessage: undefined,
        isThinking: true
      })
    }
    
    return turns
  }, [activeConversation, isLoading, currentUserMessage])

  // Simple fresh session detection based on conversation turns
  const isFreshSession = conversationTurns.length === 0 && !isLoading
  
  // Debug logging for centering state
  console.log('🐛 Debug centering:', { 
    conversationTurns: conversationTurns.length,
    isFreshSession: isFreshSession,
    isLoading: isLoading,
    sessionId: sessionId || 'null',
    hasDefaultSession: !!defaultSession,
    defaultSessionId: defaultSession?._id || 'none'
  })

  // Auto-scroll when conversation turns change or when loading
  useEffect(() => {
    const scrollArea = messagesAreaRef.current
    if (!scrollArea) return
    
    if (conversationTurns.length > 0 || isLoading) {
      console.log('📜 Auto-scroll: Scrolling to bottom')
      requestAnimationFrame(() => {
        scrollArea.scrollTop = scrollArea.scrollHeight
      })
    }
  }, [conversationTurns, isLoading])

  // Handle form submission with Convex integration (preserved exactly)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const inputValue = input.trim()
    setInput("") // Clear input immediately
    setCurrentUserMessage(inputValue) // Track the message being processed
    setIsLoading(true) // Show loading state
    
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
      
      // Update chat title if this is the first conversation turn
      if (conversationTurns.length === 0 && currentSessionId) {
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
      setCurrentUserMessage(null) // Clear the current message state
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
    if (conversationTurns.length === 0) return
    
    // Clear state
    setInput("")
    
    // Trigger a chat history refresh (this will clear messages from DB)
    window.dispatchEvent(new CustomEvent('clear-chat-requested'))
    
    toast.success("Chat cleared")
  }

  return (
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Messages Container - ChatHub Pattern */}
      <div
        className="flex flex-col w-full items-center h-[100dvh] overflow-y-auto no-scrollbar pt-[60px] pb-[200px]"
        ref={messagesAreaRef}
        id="chat-container"
      >
        <div ref={messagesContainerRef} className="w-full md:w-[735px] lg:w-[756px] pl-8 pr-4 py-2 flex flex-1 flex-col gap-24">
          <div className="flex flex-col gap-8 w-full items-start">
            {/* Conversation Turns - ChatHub Pattern */}
            {conversationTurns.map((turn, index) => (
              <ConversationTurn
                key={turn.id}
                id={turn.id}
                userMessage={turn.userMessage}
                aiMessage={turn.aiMessage}
                isThinking={turn.isThinking}
                isLast={index === conversationTurns.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Background mask to hide text that scrolls behind input area - positioned below input box, avoiding scrollbar */}
      <div className="absolute bottom-0 left-0 h-20 bg-background z-5 pointer-events-none" style={{ right: '20px' }} />
      
      {/* Chat Input - ChatHub Simple Positioning Pattern */}
      <div
        className={cn(
          "w-full flex flex-col items-center absolute bottom-0 px-2 md:px-4 pb-2 pt-16 right-0 gap-2",
          "transition-all ease-in-out duration-1000 left-0 z-10",
          isFreshSession && "top-0 justify-center" // Full height centering like ChatHub
        )}
      >
        {/* Greeting - Only show when fresh session */}
        {isFreshSession && <ChatGreeting />}
        
        {/* Input Container with 5% increased width */}
        <div className="w-full md:w-[735px] lg:w-[756px] mx-auto flex flex-col gap-3">
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
            showClearButton={conversationTurns.length > 0}
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
  )
}