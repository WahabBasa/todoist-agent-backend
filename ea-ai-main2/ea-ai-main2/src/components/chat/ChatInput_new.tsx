import React, { useRef, forwardRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Button } from '../ui/button'
import Textarea from 'react-textarea-autosize'
import { cn } from '@/lib/utils'

// Claude-inspired clean input design with blue accents

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
    <div className={cn("w-full mb-4", className)}>
      <div 
        className="relative rounded-xl p-2 flex"
        style={{ 
          backgroundColor: "var(--medium-dark)",
          border: "1px solid var(--medium-dark)"
        }}
      >
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="w-full flex items-end gap-2"
        >
          {/* Main input area */}
          <Textarea
            ref={ref}
            name="input"
            rows={1}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onFocus={() => { try { console.debug('[UI] <ChatInput> focused'); } catch {} }}
            placeholder={placeholder}
            spellCheck={false}
            value={value}
            disabled={disabled || isLoading}
            className={cn(
              "bg-transparent w-full focus:outline-none text-base px-2 py-1",
              "resize-none border-0 min-h-[2rem] max-h-[120px]",
              "scrollbar-hide leading-relaxed"
            )}
            style={{
              color: "var(--soft-off-white)",
            }}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
          
          {/* Right side buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Submit Button */}
            {!isLoading ? (
              <Button
                type="submit"
                className="text-white rounded-md w-8 h-8 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                style={{
                  backgroundColor: "var(--primary-blue)",
                  focusRingColor: "var(--primary-blue)"
                }}
                disabled={(((value?.trim?.().length ?? 0) === 0) && !isLoading) || disabled}
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </Button>
            ) : (
              <Button
                type="button"
                className="text-white rounded-md w-8 h-8 flex items-center justify-center animate-pulse"
                style={{ backgroundColor: "var(--primary-blue)" }}
                disabled
              >
                <Square className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'
