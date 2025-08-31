interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface RenderMessageProps {
  message: Message
  messageId?: string
  getIsOpen?: (id: string) => boolean
  onOpenChange?: (id: string, open: boolean) => void
  onQuerySelect?: (query: string) => void
  isStreaming?: boolean
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  isStreaming
}: RenderMessageProps) {
  
  if (message.role === 'user') {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="bg-secondary rounded-design-md px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-design-md bg-primary text-primary-foreground flex items-center justify-center text-utility font-medium">
              U
            </div>
            <p className="text-primary whitespace-pre-wrap break-words flex-1">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Assistant message - clean Morphic-style layout with streaming support
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="max-w-none">
        <div className="text-primary whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="animate-pulse text-muted-foreground ml-1">▊</span>
          )}
        </div>
      </div>
    </div>
  )
}