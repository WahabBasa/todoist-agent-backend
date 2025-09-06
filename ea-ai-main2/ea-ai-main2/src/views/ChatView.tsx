import { Chat } from "../components/chat/Chat"
import { Navbar } from "../components/layout/Navbar"
import { Id } from "../../convex/_generated/dataModel"

interface ChatViewProps {
  sessionId?: Id<"chatSessions"> | null
  activeView: "chat" | "settings"
  onViewChange: (view: "chat" | "settings") => void
  onNewChat?: () => void
  currentSessionId?: Id<"chatSessions"> | null
  onChatSelect?: (sessionId: Id<"chatSessions">) => void
  onOpenSettings?: () => void
}

export function ChatView({ 
  sessionId, 
  activeView, 
  onViewChange, 
  onNewChat, 
  currentSessionId, 
  onChatSelect, 
  onOpenSettings 
}: ChatViewProps) {
  return (
    <div className="w-full h-[100%] bg-white dark:bg-zinc-800 rounded-xl flex flex-row relative overflow-hidden">
      {/* Internal Navbar - ChatHub Pattern */}
      <Navbar
        activeView={activeView}
        onViewChange={onViewChange}
        onNewChat={onNewChat}
        currentSessionId={currentSessionId}
        onChatSelect={onChatSelect}
        onOpenSettings={onOpenSettings}
      />
      
      {/* Chat Content */}
      <Chat sessionId={sessionId} />
    </div>
  )
}