"use client";

import React, { useRef, useState, useEffect } from 'react'
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import { ConversationTurn } from './ConversationTurn'
import { ChatInput } from './ChatInput'
import { ChatGreeting } from './ChatGreeting'
import { useChat } from '../../context/chat'

// Helper interface for conversation turn
interface ConversationTurnData {
  id: string;
  userMessage: string;
  aiMessage?: string;
  isThinking: boolean;
}

export function Chat() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  
  // Get simplified chat state from new context
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    isFreshSession,
    clearChat,
    error,
    isRetriable,
    reload
  } = useChat()

  // Convert messages to conversation turns for compatibility
  const conversationTurns = React.useMemo((): ConversationTurnData[] => {
    const turns: ConversationTurnData[] = [];
    
    // Group messages into user-assistant pairs
    let i = 0;
    while (i < messages.length) {
      const currentMessage = messages[i];
      
      if (currentMessage.role === 'user') {
        // Look for the next assistant message
        const assistantMessage = messages[i + 1];
        
        turns.push({
          id: currentMessage.id,
          userMessage: currentMessage.content,
          aiMessage: (assistantMessage?.role === 'assistant') ? assistantMessage.content : undefined,
          isThinking: false
        });
        
        // Skip the assistant message if we found one
        i += (assistantMessage?.role === 'assistant') ? 2 : 1;
      } else {
        i++;
      }
    }
    
    // Add thinking state for loading
    if (isLoading && turns.length > 0) {
      const lastTurn = turns[turns.length - 1];
      if (!lastTurn.aiMessage) {
        lastTurn.isThinking = true;
      }
    }
    
    return turns;
  }, [messages, isLoading])
  
  // Debug: Log conversation turns
  React.useEffect(() => {
    console.log('💬 [FRONTEND DEBUG] Conversation turns updated:', {
      count: conversationTurns.length,
      turns: conversationTurns.map(turn => ({
        id: turn.id,
        userMessage: turn.userMessage.substring(0, 30) + '...',
        hasAiMessage: !!turn.aiMessage,
        aiMessagePreview: turn.aiMessage ? turn.aiMessage.substring(0, 30) + '...' : null,
        isThinking: turn.isThinking
      }))
    });
  }, [conversationTurns]);
  
  // UI state (composition and enter key handling)
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

  // Wrapper for form submission to match ChatInput interface
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSubmit(e as React.FormEvent) // Use the hook's handleSubmit
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
    setInput("") // Clear local input
    clearChat() // Use context's clearChat
  }

  // Log input lifecycle at UI level
  useEffect(() => {
    try { console.debug('[UI] isLoading =', isLoading); } catch {}
  }, [isLoading]);

  const onChangeDebug = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try { console.debug('[UI] onChange, isLoading=', isLoading, 'len=', e?.target?.value?.length); } catch {}
    handleInputChange(e);
  }, [isLoading, handleInputChange]);

  return (
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Messages Container - ChatHub Pattern */}
      <div
        className={cn(
          "flex flex-col w-full items-center h-[100dvh] overflow-y-auto no-scrollbar scroll-smooth pt-12 pb-32",
          "transition-all duration-500 ease-out",
          !isContentVisible && "opacity-0",
          isContentVisible && "opacity-100"
        )}
        ref={messagesAreaRef}
        id="chat-container"
      >
        <div className="w-full md:w-[740px] lg:w-[760px] px-8 py-2 flex flex-1 flex-col gap-8">
          <div className="flex flex-col gap-8 w-full items-start">
            {/* Conversation Turns - Original Layout */}
            {conversationTurns.map((turn, index) => (
              <ConversationTurn
                key={turn.id}
                id={turn.id}
                userMessage={turn.userMessage}
                aiMessage={turn.aiMessage}
                isThinking={turn.isThinking}
                isLast={index === conversationTurns.length - 1}
                error={error}
                isRetriable={isRetriable}
                onRetry={reload}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Background mask to hide text that scrolls behind input area */}
      <div className="absolute bottom-0 left-0 h-32 bg-background z-5 pointer-events-none" style={{ right: '20px' }} />
      
      {/* Chat Input - ChatHub Simple Positioning Pattern */}
      <div
        className={cn(
          "w-full flex flex-col items-center absolute bottom-0 px-3 md:px-4 pb-2 pt-16 right-0 gap-2",
          "transition-all ease-in-out duration-300 left-0 z-10",
          isFreshSession && "top-0 justify-center" // Full height centering like ChatHub
        )}
      >
        {/* Greeting - Only show when fresh session */}
        {isFreshSession && <ChatGreeting />}
        
        {/* Input Container */}
        <div className="w-full md:w-[740px] lg:w-[760px] mx-auto flex flex-col gap-3">
          <ChatInput
            ref={inputRef}
            value={input}
            onChange={onChangeDebug}
            onSubmit={handleFormSubmit}
            onClear={handleClearChat}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            isLoading={isLoading}
            disabled={isLoading}
            placeholder="Ask a question..."
            showClearButton={conversationTurns.length > 0}
            onKeyDown={e => {
              try { console.debug('[UI] onKeyDown key=', e.key, 'isLoading=', isLoading); } catch {}
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if ((input ?? "").trim().length === 0) {
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