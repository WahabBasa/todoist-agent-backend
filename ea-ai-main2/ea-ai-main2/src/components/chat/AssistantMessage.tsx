import React, { useState } from 'react'
import { Bot, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Response } from '@/components/ai-elements/response'
import type { UIMessage } from '@ai-sdk/ui-utils'

interface AssistantMessageProps {
  content: string
  parts?: UIMessage['parts']
  streaming?: boolean
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content,
  parts,
  streaming = false
}) => {
  const [copied, setCopied] = useState(false)
  const safeContent = (content ?? '').trimStart()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }

  return (
    <div className="flex justify-start mb-6 group">
      <div className="flex items-start gap-3 max-w-[88%] w-full">
        {/* AI Avatar */}
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          aria-label="AI assistant avatar"
        >
          <Bot size={20} />
        </div>
        
        {/* Message Content */}
        <div className="flex-1 grid">
          {/* Streaming view */}
          <div className={(streaming ? 'opacity-100' : 'opacity-0 pointer-events-none') + ' transition-opacity duration-150 col-start-1 row-start-1'}>
            {safeContent ? (
              <div className="flex items-center gap-2">
                <div className="text-primary whitespace-normal break-words leading-relaxed">{safeContent}</div>
                <div className="flex gap-1 ml-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-tertiary text-xs ml-2">Thinking...</span>
              </div>
            )}
          </div>
          {/* Final markdown view */}
          <div className={(!streaming ? 'opacity-100' : 'opacity-0 pointer-events-none') + ' transition-opacity duration-150 col-start-1 row-start-1'}>
            <div className="markdown">
              <Response className="text-primary">{safeContent}</Response>
            </div>
          </div>
        </div>

        {/* Copy Button - appears on hover */}
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
}