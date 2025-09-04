import { cn } from "@/lib/utils"
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

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
  pendingUserMessage: string | null
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function ChatMessages({
  sections,
  onQuerySelect,
  isLoading,
  pendingUserMessage,
  scrollContainerRef
}: ChatMessagesProps) {

  // Simple loading detection - show when loading and we have sections but last has no assistant response
  const showLoading = isLoading && (
    (sections.length > 0 && sections[sections.length - 1].assistantMessages.length === 0) ||
    pendingUserMessage !== null
  )

  // Show empty state for no content
  if (!sections.length && !pendingUserMessage) {
    return (
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        role="list"
        aria-roledescription="chat messages"
        className="relative size-full pt-14"
      >
        {/* Clean empty state */}
        <div className="h-full flex flex-col items-center justify-center p-6">
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
        'flex-1 overflow-y-auto'
      )}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {/* Render saved message sections */}
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
            {/* User message - stable component */}
            <div className="flex flex-col gap-4 mb-4">
              <UserMessage content={section.userMessage.content} />
            </div>

            {/* Assistant messages - stable components */}
            {section.assistantMessages.map((assistantMessage) => (
              <div key={assistantMessage.id} className="flex flex-col gap-4">
                <AssistantMessage content={assistantMessage.content} />
              </div>
            ))}
          </div>
        ))}

        {/* Pending user message section */}
        {pendingUserMessage && (
          <div className="chat-section mb-8">
            <div className="flex flex-col gap-4 mb-4">
              <UserMessage content={pendingUserMessage} />
              
              {/* Simple loading indicator */}
              {showLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" />
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-xs">Thinking...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}