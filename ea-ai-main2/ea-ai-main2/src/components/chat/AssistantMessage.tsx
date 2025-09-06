import React, { useState } from 'react'
import { Bot, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'

interface AssistantMessageProps {
  content: string
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content
}) => {
  const [copied, setCopied] = useState(false)

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
      <div className="flex items-start gap-3 max-w-[79%] w-full">
        {/* AI Avatar */}
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          aria-label="AI assistant avatar"
        >
          <Bot size={20} />
        </div>
        
        {/* Message Content */}
        <div className="flex-1">
          <div className="text-primary whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>

        {/* Copy Button - appears on hover */}
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
      </div>
    </div>
  )
}