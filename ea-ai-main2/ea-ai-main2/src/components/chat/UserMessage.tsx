import React from 'react'
import { CollapsibleMessage } from './CollapsibleMessage'

interface UserMessageProps {
  content: string
}

export const UserMessage: React.FC<UserMessageProps> = ({
  content
}) => {
  return (
    <CollapsibleMessage role="user">
      <div className="flex flex-col gap-2 w-full">
        <div className="bg-secondary rounded-design-md px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-design-md bg-primary text-primary-foreground flex items-center justify-center text-utility font-medium">
              U
            </div>
            <p className="text-primary whitespace-pre-wrap break-words flex-1">
              {content}
            </p>
          </div>
        </div>
      </div>
    </CollapsibleMessage>
  )
}