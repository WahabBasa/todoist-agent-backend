"use client";

import React, { useRef, useState, useEffect } from 'react'
import { cn } from "@/lib/utils"
import { Id } from "../../../convex/_generated/dataModel"
import { AssistantMessage } from './AssistantMessage'
import { ChatInput } from './ChatInput'
import { ChatGreeting } from './ChatGreeting'
import { useChat } from '../../context/chat'
import type { UiMsg } from '../../store/chatStore'
import { useAutoScroll } from '../../hooks/use-auto-scroll'

// Separate-row rendering; no turn grouping

export function Chat() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
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

  const {
    containerRef: messagesAreaRef,
    handleScroll,
    handleTouchStart,
    scrollToBottom,
    shouldAutoScroll,
  } = useAutoScroll([messages, isLoading])

  // No turn grouping; render rows directly
  
  // UI state (composition and enter key handling)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)

  // Auto-scroll when messages or loading change
  useEffect(() => {
    if (shouldAutoScroll && (messages.length > 0 || isLoading)) {
      scrollToBottom()
    }
  }, [messages, isLoading, shouldAutoScroll, scrollToBottom])

  // Wrapper for form submission to match ChatInput interface
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSubmit(e as React.FormEvent) // Use the hook's handleSubmit
  }

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(false)
  }

  const handleClearChat = () => {
    setInput("") // Clear local input
    clearChat() // Use context's clearChat
  }

  return (
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Messages Container - ChatHub Pattern */}
      <div
        className={cn(
          "flex flex-col w-full items-center h-[100dvh] overflow-y-auto scrollbar-hide scroll-smooth pt-12 pb-32"
        )}
        ref={messagesAreaRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        id="chat-container"
      >
        <div className="w-full md:w-[740px] lg:w-[760px] px-8 py-2 flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-4 w-full items-start">
            {messages.map((m, idx) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="flex items-start gap-3 w-full">
                      <div className="message-bubble-user"><div className="whitespace-normal break-words">{(m.content ?? '').trimStart()}</div></div>
                    </div>
                  </div>
                )
              }
              const isLast = idx === messages.length - 1
              const streaming = isLoading && isLast
              return (
                <AssistantMessage
                  key={m.id}
                  content={m.content}
                  parts={m.parts}
                  streaming={streaming}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Background mask to hide text that scrolls behind input area */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-background z-[5] pointer-events-none" />
      
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
            onChange={handleInputChange}
            onSubmit={handleFormSubmit}
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
