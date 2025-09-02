import { useRef } from 'react'
import Textarea from 'react-textarea-autosize'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  isComposing: boolean
  enterDisabled: boolean
  onCompositionStart: () => void
  onCompositionEnd: () => void
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  showScrollToBottomButton,
  scrollContainerRef,
  isComposing,
  enterDisabled,
  onCompositionStart,
  onCompositionEnd
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)


  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0 chat-transition',
        messages.length > 0 
          ? 'sticky bottom-0 px-2 pb-4' 
          : 'flex items-center justify-center min-h-[60vh] px-6'
      )}
    >
      
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl w-full mx-auto relative"
      >
        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-design-md shadow-md transition-all duration-200"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div className="relative flex flex-col w-full gap-primary bg-muted rounded-design-lg border border-input">
          <Textarea
            ref={inputRef}
            id="chat-input"
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder="Ask a question..."
            spellCheck={false}
            value={input ?? ''}
            disabled={isLoading}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-primary placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onChange={handleInputChange}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (!input?.trim() || input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
          />

          {/* Bottom control bar - Morphic-style */}
          <div className="flex items-center justify-between padding-primary">
            <div className="flex items-center gap-primary">
              <div className="text-utility text-muted-foreground">
                Claude 3.5 Sonnet
              </div>
            </div>
            <div className="flex items-center gap-primary">
              <Button
                type={isLoading ? 'button' : 'submit'}
                size="icon"
                variant="ghost"
                className={cn(
                  'rounded-design-md btn-blue-primary transition-all duration-200',
                  isLoading ? 'animate-pulse' : ''
                )}
                disabled={(!input || input.length === 0) && !isLoading}
                onClick={isLoading ? () => {} : undefined}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}