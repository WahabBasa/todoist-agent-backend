import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MessageCirclePlus, MessageSquare } from "lucide-react";
import { useState } from "react";
import { UserProfile } from "./nav/UserProfile";
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
}

export function AppSidebar({ activeView, onViewChange, onNewChat }: AppSidebarProps) {
  const conversations = useQuery(api.conversations.getConversation);
  const clearConversation = useMutation(api.conversations.clearConversation);

  const handleNewChat = async () => {
    try {
      await clearConversation();
      onViewChange("chat");
      onNewChat?.();
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
  };


  const navigationItems: Array<{
    id: string;
    label: string;
    icon: any;
    count?: number;
    onClick?: () => void;
  }> = [
    { 
      id: "chat", 
      label: "New Chat", 
      icon: MessageCirclePlus,
      onClick: handleNewChat
    }
  ];

  const handleItemClick = (viewId: "chat") => {
    onViewChange(viewId);
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      {/* App Header */}
      <SidebarHeader className="flex flex-row justify-between items-center padding-secondary">
        <h1 className="text-secondary font-semibold group-data-[collapsible=icon]:hidden">TaskAI</h1>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent className="flex flex-col overflow-hidden px-3 py-0">
        {/* Fixed Top Section */}
        <div>
          {/* Main Navigation */}
          <SidebarMenu className="gap-secondary">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    onClick={item.onClick || (() => handleItemClick(item.id as "chat"))}
                    isActive={activeView === item.id}
                    tooltip={item.label}
                    attention="secondary"
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <Badge 
                        variant="secondary"
                        className="ml-auto h-5 px-1.5 text-xs"
                      >
                        {item.count}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

          <SidebarSeparator />

          {/* Chat History Title */}
          <SidebarGroupLabel className="padding-utility">
            <span className="text-utility">Chat History</span>
          </SidebarGroupLabel>
        </div>

        {/* Scrollable Chat History Section */}
        <div className="flex-1 overflow-y-auto">
          <SidebarMenu className="gap-tertiary">
            {conversations?.messages?.filter(msg => msg.role === "user").map((message, index) => (
              <SidebarMenuItem key={index}>
                <SidebarMenuButton
                  onClick={() => handleItemClick("chat")}
                  tooltip={message.content.substring(0, 50)}
                  attention="tertiary"
                  className="h-auto justify-start"
                >
                  <span className="truncate text-left">
                    {message.content.substring(0, 40)}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )) || (
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="No chat history" attention="tertiary" className="justify-start">
                  <span className="text-muted-foreground">No chats yet</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </div>

      </SidebarContent>

      {/* Account at Bottom */}
      <SidebarFooter>
        <UserProfile />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}