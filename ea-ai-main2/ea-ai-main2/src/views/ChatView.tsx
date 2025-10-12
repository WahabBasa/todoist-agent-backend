"use client";

import { useEffect } from "react";
import { Chat } from "../components/chat/Chat";
import { CollapsibleSidebar } from "../components/layout/CollapsibleSidebar";
import { SettingsView } from "./SettingsView";
import { AdminDashboard } from "./AdminDashboard";
import { useSessions } from "../context/sessions";
import { SidebarProvider } from "../components/ui/sidebar";

export function ChatView() {
  // Get everything from SessionsContext - no props needed
  const { activeView, setActiveView, isAdmin } = useSessions();

  useEffect(() => {
    if (activeView === "admin" && !isAdmin) {
      setActiveView("chat");
    }
  }, [activeView, isAdmin, setActiveView]);
  
  console.log('🔄 [DEBUG] Active view changed:', activeView);
  
  return (
    <SidebarProvider>
      <div className="w-full h-[100%] bg-background rounded-xl flex flex-row relative overflow-hidden">
        {/* Unified Collapsible Sidebar */}
        <CollapsibleSidebar />
        
        {/* Main Content - Chat, Settings, or Admin Dashboard */}
        <div className="flex-1 relative overflow-hidden">
          {activeView === "settings" ? (
            <SettingsView onBackToChat={() => setActiveView("chat")} />
          ) : activeView === "admin" ? (
            <div className="h-full overflow-y-auto">
              <AdminDashboard />
            </div>
          ) : (
            <Chat />
          )}
        </div>
      </div>
    </SidebarProvider>
  )
}