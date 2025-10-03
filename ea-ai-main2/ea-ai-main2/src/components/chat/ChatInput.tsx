import React, { useRef, forwardRef } from 'react'
import { ArrowUp, Square, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import Textarea from 'react-textarea-autosize'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onClear?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  onCompositionStart?: () => void
  onCompositionEnd?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  className?: string
  showClearButton?: boolean
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({
  value,
  onChange,
  onSubmit,
  onClear,
  isLoading = false,
  disabled = false,
  placeholder = "Ask a question...",
  onCompositionStart,
  onCompositionEnd,
  onKeyDown,
  className,
  showClearButton = false
}, ref) => {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className={cn("w-full transition-all duration-300 ease-in-out", className)}>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="relative"
      >
        {/* ChatHub-style input container - Original multi-row design */}
        <div className="flex flex-col items-start gap-0 focus-within:ring-2 ring-primary/20 ring-offset-2 ring-offset-background bg-muted w-full border border-border rounded-2xl overflow-hidden transition-all duration-300 ease-in-out shadow-lg">
          
          {/* Main input row */}
          <div className="flex flex-row items-end pl-3 md:pl-4 pr-2 py-2 w-full gap-0">
            <Textarea
              ref={ref}
              name="input"
              rows={1}
              maxRows={5}
              tabIndex={0}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              placeholder={placeholder}
              spellCheck={false}
              value={value}
              disabled={disabled || isLoading}
              className={cn(
                "w-full min-h-8 text-sm md:text-base max-h-[120px] overflow-y-auto outline-none focus:outline-none p-1",
                "resize-none border-0 bg-transparent",
                "text-foreground placeholder:text-muted-foreground",
                "no-scrollbar leading-relaxed"
              )}
              onChange={onChange}
              onKeyDown={onKeyDown}
            />

            {/* Buttons row - only show when not loading */}
            {!isLoading && (
              <div className="flex items-center gap-1 ml-2">
                {/* Clear Button */}
                {showClearButton && onClear && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-design-md"
                    onClick={onClear}
                    disabled={disabled || isLoading}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {/* Bottom row with submit button */}
          <div className="flex flex-row items-center w-full justify-end gap-0 pt-1 pb-2 px-2">
            <div className="flex-1"></div>

            {!isLoading && (
              <Button
                type="submit"
                size="icon"
                className={cn(
                  'h-8 w-8 shrink-0 rounded-full shadow-sm',
                  "btn-blue-primary",
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={(((value?.trim?.().length ?? 0) === 0) && !isLoading) || disabled}
              >
                <ArrowUp size={16} />
              </Button>
            )}

            {isLoading && (
              <Button
                type="button"
                size="icon"
                className={cn(
                  'h-8 w-8 shrink-0 rounded-full shadow-sm',
                  'btn-blue-primary',
                  'animate-pulse'
                )}
                disabled
              >
                <Square size={16} />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'