import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Response } from '@/components/ai-elements/response'
import type { UIMessage } from '@ai-sdk/ui-utils'

interface AssistantMessageProps {
  content: string
  parts?: UIMessage['parts']
  streaming?: boolean
}

export const AssistantMessage = React.memo<AssistantMessageProps>(
  ({ content, parts, streaming = false }) => {
    const [copied, setCopied] = useState(false)
    const safeContent = (content ?? '')
      .trimStart()
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2 max

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy message:', err)
      }
    }

    // Simple immediate display - no artificial delays
    const showThinking = streaming && !safeContent

    return (
      <div className="flex justify-start group">
        <div className="flex items-start gap-3 w-full">
          {/* Bot icon removed per user request */}
          
          {/* Message Content - Simple, fast rendering */}
          <div className="flex-1 ml-1">
            {showThinking ? (
              // Thinking animation - aligned with AI response start position
              <div className="flex items-center justify-start ml-0">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            ) : (
              // Content rendering - single Response component for both streaming and complete
              <div className="markdown">
                <Response className="text-primary" parseIncompleteMarkdown={false}>
                  {safeContent}
                </Response>
                {/* Typing indicator - simple conditional, no state */}
                {streaming && safeContent && (
                  <div className="flex gap-1 mt-2">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Copy Button - appears on hover when complete */}
          {content && !streaming && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopy}
                aria-label={copied ? "Message copied" : "Copy message"}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if content or streaming actually changed
    return prevProps.content === nextProps.content && 
           prevProps.streaming === nextProps.streaming
  }
)

AssistantMessage.displayName = 'AssistantMessage'
