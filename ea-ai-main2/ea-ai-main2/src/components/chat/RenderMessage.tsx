import { Response } from '@/components/ai-elements/response'
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
  isOptimistic?: boolean // Indicates this is an optimistic update that should animate in
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  isOptimistic = false
}: RenderMessageProps) {
  
  if (message.role === 'user') {
    return (
      <div className={`flex flex-col gap-2 w-full ${
        isOptimistic ? 'animate-in slide-in-from-bottom-2 fade-in-0 duration-300' : ''
      }`}>
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

  // Assistant message - clean Morphic-style layout
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="max-w-none">
        <div className="markdown">
          <Response className="text-primary">{message.content}</Response>
        </div>
      </div>
    </div>
  )
}