import React from 'react'
import { User } from 'lucide-react'

interface UserMessageProps {
  content: string
}

export const UserMessage: React.FC<UserMessageProps> = ({
  content
}) => {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[88%]">
        {/* User Avatar */}
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center"
          aria-label="User avatar"
        >
          <User size={20} className="text-muted-foreground" />
        </div>
        
        {/* Message Card */}
        <div 
          className="border border-border rounded-design-lg px-4 py-3 shadow-sm"
          style={{ backgroundColor: '#000000' }}
        >
          <p className="text-primary whitespace-pre-wrap break-words" style={{ fontSize: '17px' }}>
            {content}
          </p>
        </div>
      </div>
    </div>
  )
}