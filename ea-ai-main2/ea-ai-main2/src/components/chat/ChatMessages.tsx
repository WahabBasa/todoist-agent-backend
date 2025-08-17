import { useEffect, useMemo, useState } from 'react'
import { cn } from "@/lib/utils"
import { RenderMessage } from './RenderMessage'
import { PromptSuggestions } from "../ui/prompt-suggestions"

// Import section structure interface
interface ChatSection {
  id: string
  userMessage: Message
  assistantMessages: Message[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatMessagesProps {
  sections: ChatSection[]
  onQuerySelect: (query: string) => void
  isLoading: boolean
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function ChatMessages({
  sections,
  onQuerySelect,
  isLoading,
  scrollContainerRef
}: ChatMessagesProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  
  const suggestions = [
    "Create a task to review the quarterly report",
    "Show me all my active tasks",
    "Create a project for the website redesign",
    "Delete the 'Old Project'",
    "Mark all high priority tasks as completed",
    "Move all marketing tasks to the Website Redesign project"
  ]

  const handleAppend = async (message: { role: "user"; content: string }) => {
    onQuerySelect(message.content)
  }

  // Morphic-style state management for message sections
  useEffect(() => {
    // Auto-open the last section when new messages arrive
    if (sections.length > 0) {
      const lastSection = sections[sections.length - 1]
      if (lastSection.userMessage.role === 'user') {
        setOpenStates(prev => ({ ...prev, [lastSection.id]: true }))
      }
    }
  }, [sections])

  // Get all messages as a flattened array for better indexing
  const allMessages = useMemo(() => sections.flatMap(section => [
    section.userMessage,
    ...section.assistantMessages
  ]), [sections])

  const lastUserIndex = allMessages.length - 1 - 
    [...allMessages].reverse().findIndex(msg => msg.role === 'user')

  // Enhanced loading detection
  const showLoading = isLoading && sections.length > 0 && 
    sections[sections.length - 1].assistantMessages.length === 0

  const getIsOpen = (id: string) => {
    const baseId = id.endsWith('-related') ? id.slice(0, -8) : id
    const index = allMessages.findIndex(msg => msg.id === baseId)
    return openStates[id] ?? index >= lastUserIndex
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  if (!sections.length) {
    return (
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        role="list"
        aria-roledescription="chat messages"
        className="relative size-full pt-14"
      >
        {/* Empty State - Enhanced with Morphic styling */}
        <div className="h-full flex flex-col items-center justify-center p-6">
          <div className="text-center mb-6 animate-in fade-in-50 duration-500">
            <h3 className="text-lg font-medium text-foreground mb-2">Start a conversation</h3>
            <p className="text-base text-muted-foreground max-w-md">
              Ask me to create tasks, manage projects, or help with your workflow
            </p>
          </div>
          
          <div className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-700 delay-150">
            <PromptSuggestions
              label="Quick actions:"
              append={handleAppend}
              suggestions={suggestions}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id="scroll-container"
      ref={scrollContainerRef}
      role="list"
      aria-roledescription="chat messages"
      className={cn(
        'relative size-full pt-14',
        sections.length > 0 ? 'flex-1 overflow-y-auto' : ''
      )}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="chat-section mb-8"
            style={
              sectionIndex === sections.length - 1
                ? { minHeight: 'calc(-228px + 100dvh)' }
                : {}
            }
          >
            {/* User message with enhanced styling */}
            <div className="flex flex-col gap-4 mb-4">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={getIsOpen}
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
              />
              {showLoading && (
                <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in-50 duration-300">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" />
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Assistant messages with enhanced transitions */}
            {section.assistantMessages.map((assistantMessage, index) => (
              <div 
                key={assistantMessage.id} 
                className={cn(
                  "flex flex-col gap-4",
                  index === 0 ? "animate-in slide-in-from-left-2 duration-500" : ""
                )}
              >
                <RenderMessage
                  message={assistantMessage}
                  messageId={assistantMessage.id}
                  getIsOpen={getIsOpen}
                  onOpenChange={handleOpenChange}
                  onQuerySelect={onQuerySelect}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}