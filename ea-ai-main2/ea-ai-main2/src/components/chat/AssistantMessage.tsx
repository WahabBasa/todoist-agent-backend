import React from 'react'
import { CollapsibleMessage } from './CollapsibleMessage'

interface AssistantMessageProps {
  content: string
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content
}) => {
  return (
    <CollapsibleMessage role="assistant" showIcon={false}>
      <div className="flex flex-col gap-2 w-full">
        <div className="max-w-none">
          <div className="text-primary whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>
    </CollapsibleMessage>
  )
}