import { Chat } from "../components/chat/Chat"
import { CollapsibleSidebar } from "../components/layout/CollapsibleSidebar"
import { SettingsView } from "./SettingsView"
import { useSessions } from "../context/sessions"

export function ChatView() {
  // Get everything from SessionsContext - no props needed
  const { activeView, setActiveView } = useSessions();
  return (
    <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
      {/* Unified Collapsible Sidebar */}
      <CollapsibleSidebar />
      
      {/* Main Content - Chat or Settings */}
      <div className="flex-1 relative overflow-hidden">
        {activeView === "settings" ? (
          <SettingsView onBackToChat={() => setActiveView("chat")} />
        ) : (
          <Chat />
        )}
      </div>
    </div>
  )
}