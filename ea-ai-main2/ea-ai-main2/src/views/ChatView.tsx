import { Chat } from "../components/chat/Chat"
import { Id } from "../../convex/_generated/dataModel"

interface ChatViewProps {
  sessionId?: Id<"chatSessions"> | null
}

export function ChatView({ sessionId }: ChatViewProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <Chat sessionId={sessionId} />
    </div>
  )
}