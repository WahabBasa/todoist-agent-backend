interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface RenderMessageProps {
  message: Message
  messageId?: string
}

export function RenderMessage({
  message
}: RenderMessageProps) {
  
  if (message.role === 'user') {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="bg-secondary rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              U
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words flex-1">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Assistant message - clean Morphic-style layout
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="prose prose-sm max-w-none text-foreground">
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  )
}