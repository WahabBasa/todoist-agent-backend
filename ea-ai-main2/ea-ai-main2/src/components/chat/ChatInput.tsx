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
    <div className={cn("w-full", className)}>
      <form 
        ref={formRef}
        onSubmit={onSubmit}
        className="relative"
      >
        <div className="relative flex items-end bg-muted border border-input rounded-design-lg p-3 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
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
              "flex-1 min-h-[2.5rem] resize-none border-0 bg-transparent px-0 py-2",
              "text-primary placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-0",
              "scrollbar-hide"
            )}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
          
          <div className="flex items-center gap-1 ml-2">
            {/* Clear Button */}
            {showClearButton && onClear && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClear}
                disabled={disabled || isLoading}
              >
                <Trash2 size={16} />
              </Button>
            )}
            
            {/* Submit Button */}
            <Button
              type={isLoading ? 'button' : 'submit'}
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-md',
                'bg-primary hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isLoading && 'animate-pulse'
              )}
              disabled={(value.trim().length === 0 && !isLoading) || disabled}
            >
              {isLoading ? (
                <Square size={16} />
              ) : (
                <ArrowUp size={16} />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'