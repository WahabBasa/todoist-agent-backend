import { Chat } from "../components/chat/Chat"
import { CollapsibleSidebar } from "../components/layout/CollapsibleSidebar"
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
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Unified Collapsible Sidebar */}
      <CollapsibleSidebar
        activeView={activeView}
        onViewChange={onViewChange}
        onNewChat={onNewChat}
        currentSessionId={currentSessionId}
        onChatSelect={onChatSelect}
        onOpenSettings={onOpenSettings}
      />
      
      {/* Main Chat Content */}
      <div className="flex-1">
        <Chat sessionId={sessionId} />
      </div>
    </div>
  )
}