import { MessageCirclePlus } from 'lucide-react'
import { Button } from "../ui/button"

interface NewChatButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function NewChatButton({ onClick, disabled = false }: NewChatButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      className="w-full gap-secondary padding-secondary text-secondary rounded-design-md hover:bg-muted/50 transition-all duration-200"
    >
      <MessageCirclePlus className="h-4 w-4" />
      New Chat
    </Button>
  )
}