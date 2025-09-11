import React from 'react'
import { User, Bot, Copy, Check, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'

interface ConversationTurnProps {
  id: string
  userMessage: string
  aiMessage?: string
  isThinking?: boolean
  isLast?: boolean
}

export const ConversationTurn: React.FC<ConversationTurnProps> = ({
  id,
  userMessage,
  aiMessage,
  isThinking = false,
  isLast = false
}) => {
  const [copied, setCopied] = React.useState(false)
  
  // Check for empty responses
  const isEmptyResponse = !aiMessage || aiMessage.trim() === '';

  const handleCopy = async () => {
    if (!aiMessage || isEmptyResponse) return
    
    try {
      await navigator.clipboard.writeText(aiMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* User Message */}
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[98%]">
          {/* User Avatar */}
          <div 
            className="flex-shrink-0 w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center"
            aria-label="User avatar"
          >
            <User size={20} className="text-muted-foreground" />
          </div>
          
          {/* User Message Card */}
          <div className="bg-secondary border border-border rounded-design-lg px-4 py-3 shadow-sm">
            <p className="text-primary whitespace-pre-wrap break-words">
              {userMessage}
            </p>
          </div>
        </div>
      </div>

      {/* AI Response Area */}
      <div className="flex justify-start group">
        <div className="flex items-start gap-3 max-w-[98%] w-full">
          {/* AI Avatar */}
          <div 
            className={`flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center ${
              isThinking ? 'animate-pulse' : ''
            }`}
            aria-label="AI assistant avatar"
          >
            <Bot size={20} />
          </div>
          
          {/* AI Content or Thinking Indicator */}
          <div className="flex-1">
            {isThinking ? (
              /* Thinking Animation - ChatHub Style */
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
                <span className="text-tertiary text-xs ml-2">Thinking...</span>
              </div>
            ) : isEmptyResponse ? (
              /* Empty Response State */
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle size={16} />
                <span className="text-sm">No response was generated. Please try again.</span>
              </div>
            ) : (
              /* AI Response */
              <div className="text-primary whitespace-pre-wrap break-words">
                {aiMessage}
              </div>
            )}
          </div>

          {/* Copy Button - only show when AI response exists, is not empty, and not thinking */}
          {aiMessage && !isThinking && !isEmptyResponse && (
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
    </div>
  )
}