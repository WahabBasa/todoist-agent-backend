import React from 'react'
import { Bot } from 'lucide-react'

interface TypingIndicatorProps {
  show: boolean
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  show
}) => {
  if (!show) return null

  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start gap-3 max-w-[79%]">
        {/* AI Avatar with spinning animation */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-pulse">
          <Bot size={20} />
        </div>
        
        {/* Typing Animation */}
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
      </div>
    </div>
  )
}