import { useRef, useState, useEffect } from 'react'
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import { ConversationTurn } from './ConversationTurn'
import { ChatInput } from './ChatInput'
import { ChatGreeting } from './ChatGreeting'
import { useChat } from '../../context/chat'

export function Chat() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  
  // ChatHub pattern: Consumer-only - get everything from context
  const {
    conversationTurns,
    isLoading,
    isFreshSession,
    submitMessage,
    clearChat
  } = useChat()
  
  // Simple input state (only for UI)
  const [input, setInput] = useState("")
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  
  // Fixed: Simplified transition state management
  const [isContentVisible, setIsContentVisible] = useState(true)

  // No session management needed - handled by SessionsContext

  // Fixed: Simplified transition logic that ensures content becomes visible
  useEffect(() => {
    // Always ensure content is visible after a short delay
    // This prevents the content from being hidden indefinitely
    const timer = setTimeout(() => {
      setIsContentVisible(true)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [conversationTurns, isLoading])

  // Auto-scroll when messages change
  useEffect(() => {
    const scrollArea = messagesAreaRef.current
    if (!scrollArea) return
    
    if (conversationTurns.length > 0 || isLoading) {
      requestAnimationFrame(() => {
        scrollArea.scrollTop = scrollArea.scrollHeight
      })
    }
  }, [conversationTurns, isLoading])

  // ChatHub pattern: Simple form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput("") // Clear input immediately
    
    // Let context handle everything - don't await to avoid ESLint error
    submitMessage(message)
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
    setInput("")
    clearChat()
  }

  return (
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Messages Container - ChatHub Pattern */}
      <div
        className={cn(
          "flex flex-col w-full items-center h-[100dvh] overflow-y-auto no-scrollbar pt-[60px] pb-[280px]",
          "transition-opacity duration-300 ease-in-out",
          !isContentVisible && "opacity-0",
          isContentVisible && "opacity-100"
        )}
        ref={messagesAreaRef}
        id="chat-container"
      >
        <div className="w-full md:w-[735px] lg:w-[756px] pl-8 pr-4 py-2 flex flex-1 flex-col gap-24">
          <div className="flex flex-col gap-8 w-full items-start">
            {/* Conversation Turns - Single Source of Truth */}
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

      {/* Background mask to hide text that scrolls behind input area */}
      <div className="absolute bottom-0 left-0 h-40 bg-background z-5 pointer-events-none" style={{ right: '20px' }} />
      
      {/* Chat Input - ChatHub Simple Positioning Pattern */}
      <div
        className={cn(
          "w-full flex flex-col items-center absolute bottom-0 px-2 md:px-4 pb-2 pt-16 right-0 gap-2",
          "transition-all ease-in-out duration-300 left-0 z-10",
          isFreshSession && "top-0 justify-center" // Full height centering like ChatHub
        )}
      >
        {/* Greeting - Only show when fresh session */}
        {isFreshSession && <ChatGreeting />}
        
        {/* Input Container */}
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