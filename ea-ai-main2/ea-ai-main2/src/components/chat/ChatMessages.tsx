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

  // Show loading indicator for new user messages waiting for assistant response
  const showLoading = isLoading && sections.length > 0 && 
    sections[sections.length - 1].assistantMessages.length === 0

  if (!sections.length) {
    return (
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        role="list"
        aria-roledescription="chat messages"
        className="relative size-full pt-14"
      >
        {/* Empty State - Centered */}
        <div className="h-full flex flex-col items-center justify-center p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium text-foreground mb-2">Start a conversation</h3>
            <p className="text-base text-muted-foreground max-w-md">
              Ask me to create tasks, manage projects, or help with your workflow
            </p>
          </div>
          
          <div className="w-full max-w-md">
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
        'flex-1 overflow-y-auto'
      )}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="chat-section mb-12"
            style={
              sectionIndex === sections.length - 1
                ? { minHeight: 'calc(-228px + 100dvh)' }
                : {}
            }
          >
            {/* User message */}
            <div className="flex flex-col gap-4 mb-6">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
              />
              {showLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map(assistantMessage => (
              <div key={assistantMessage.id} className="flex flex-col gap-4 mb-6">
                <RenderMessage
                  message={assistantMessage}
                  messageId={assistantMessage.id}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}