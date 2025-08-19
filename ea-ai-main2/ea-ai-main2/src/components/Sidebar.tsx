import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MessageCirclePlus, MessageSquare } from "lucide-react";
import { useState } from "react";
import { UserProfile } from "./nav/UserProfile";
import { ChatHistoryClient } from "./sidebar/ChatHistoryClient";
import { NewChatButton } from "./sidebar/NewChatButton";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarRail,
} from "./ui/sidebar";

interface AppSidebarProps {
  activeView: "chat";
  onViewChange: (view: "chat") => void;
  onNewChat?: () => void;
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
}

export function AppSidebar({ 
  activeView, 
  onViewChange, 
  onNewChat,
  currentSessionId,
  onChatSelect 
}: AppSidebarProps) {
  const createChatSession = useMutation(api.chatSessions.createChatSession);

  const handleNewChat = async () => {
    try {
      // Create a new chat session
      const newSessionId = await createChatSession({});
      
      // Notify parent components
      onViewChange("chat");
      onNewChat?.();
      onChatSelect?.(newSessionId);
      
      // Trigger history update event for other components
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat. Please try again.");
    }
  };

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    onChatSelect?.(sessionId);
    onViewChange("chat");
  };


  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      {/* App Header */}
      <SidebarHeader className="flex flex-col gap-secondary padding-secondary">
        <div className="flex flex-row justify-between items-center">
          <h1 className="text-secondary group-data-[collapsible=icon]:hidden">TaskAI</h1>
          <SidebarTrigger />
        </div>
        {/* New Chat Button */}
        <div className="group-data-[collapsible=icon]:hidden">
          <NewChatButton onClick={handleNewChat} />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col overflow-hidden px-0 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center">
        {/* Chat History Section */}
        <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden px-3">
          <ChatHistoryClient 
            currentSessionId={currentSessionId}
            onChatSelect={handleChatSelect}
          />
        </div>
      </SidebarContent>

      {/* Account at Bottom */}
      <SidebarFooter className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <UserProfile />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}