import { useEffect, useMemo, useRef, useState } from 'react'
import { useAction, useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import Textarea from 'react-textarea-autosize'
import { ArrowUp, Square } from 'lucide-react'
import { Button } from "../ui/button"

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

  // Custom scroll behavior - scroll to latest message (question or last backend message)
  useEffect(() => {
    const wrapper = document.querySelector('.wrapper') as HTMLElement
    if (wrapper) {
      // Scroll to optimistic question message if it exists
      if (question && questionRef.current) {
        const messageTop = questionRef.current.offsetTop
        const targetScrollTop = Math.max(0, messageTop - 50)
        
        wrapper.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
        
        // Show thinking animation after scroll completes
        if (isLoading) {
          const timer = setTimeout(() => {
            setShowThinking(true)
          }, 300)
          return () => clearTimeout(timer)
        }
      }
      // Scroll to last message when new backend messages arrive
      else if (messages.length > 0) {
        const lastMessage = document.querySelector('.message:last-of-type') as HTMLElement
        if (lastMessage) {
          const messageTop = lastMessage.offsetTop
          const targetScrollTop = Math.max(0, messageTop - 50)
          
          wrapper.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          })
        }
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
      toast.error("Failed to send message")
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

  return (
    <div className="chat-page">
      <div className="wrapper">
        <div className="chat">
          {/* LAYER 1: Historical messages - vertical stacking */}
          {messages.map((message, i) => (
            <div
              key={message.id}
              className={cn(
                "message",
                message.role === "user" ? "user" : "assistant"
              )}
            >
              {message.content}
            </div>
          ))}

          {/* LAYER 2: Active conversation - ChatGPT clone pattern */}
          {question && <div ref={questionRef} className="message user">{question}</div>}
          
          {/* Thinking animation - shows after scroll completes */}
          {showThinking && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" />
                <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
              <span className="text-xs">Thinking...</span>
            </div>
          )}
          
          {/* Spacer - pushes form higher from bottom */}
          <div style={{ flex: 1, minHeight: '10vh' }}></div>
          
          {/* Form as part of scrollable content - ChatGPT clone pattern */}
          <form className="new-form" onSubmit={handleSubmit} ref={formRef}>
            <div className="form-container">
              <Textarea
                ref={inputRef}
                name="input"
                rows={2}
                maxRows={5}
                tabIndex={0}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="Ask a question..."
                spellCheck={false}
                value={input}
                disabled={isLoading}
                className="form-textarea"
                onChange={handleInputChange}
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
                    const textarea = e.target as HTMLTextAreaElement
                    textarea.form?.requestSubmit()
                  }
                }}
              />
              
              <Button
                type={isLoading ? 'button' : 'submit'}
                size="icon"
                className={cn(
                  'form-submit-button',
                  isLoading ? 'animate-pulse' : ''
                )}
                disabled={input.length === 0 && !isLoading}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}