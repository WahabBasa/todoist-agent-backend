"use client";

// Claude-inspired collapsible sidebar with blue accents and smooth transitions

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { UserProfile } from "../nav/UserProfile";
import { ChatHistory } from "../chat/ChatHistory";
import { cn } from "@/lib/utils";
import { useSessions } from "../../context/sessions";

// Claude-style sidebar with blue accents and smooth transitions

interface SidebarMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  collapsed: boolean;
  className?: string;
  children?: React.ReactNode;
}

function SidebarMenuItem({ 
  icon, 
  label, 
  onClick, 
  collapsed, 
  className,
  children
}: SidebarMenuItemProps) {
  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 h-10 hover:bg-white/10 transition-colors",
          collapsed ? "w-10 px-0 justify-center" : "px-3"
        )}
        onClick={onClick}
      >
        <div className="shrink-0" style={{ color: "var(--neutral-stone)" }}>{icon}</div>
        {!collapsed && (
          <span className="text-sm font-medium transition-opacity duration-150 delay-150">
            {label}
          </span>
        )}
      </Button>
      {children}
    </div>
  );
}

export function CollapsibleSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  
  // Get everything from SessionsContext
  const { 
    currentSessionId, 
    createNewSession, 
    selectSession, 
    setActiveView,
    isAdmin
  } = useSessions();

  // Load collapse state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed !== null) {
      setCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // Save collapse state to localStorage
  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newCollapsed));
  };

  const handleNewChat = async () => {
    // Use SessionsContext - handles everything
    await createNewSession();
  };

  // Claude-style dimensions: 48px collapsed, 246px expanded (safer fit for buttons)
  const sidebarWidth = collapsed ? "w-[48px]" : "w-[246px]";

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 transition-all ease-in-out py-1.5",
        collapsed ? "px-0" : "px-2",
        sidebarWidth
      )}
      style={{
        backgroundColor: "var(--dark-charcoal)",
        borderRight: "1px solid var(--color-border)",
        transitionDuration: "300ms"
      }}
    >
      {/* Header with Toggle Button */}
      <div className="shrink-0">
        <div className={cn(
          "mb-3 flex w-full",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <Button
            variant="ghost"
            className={cn(
              "hover:bg-white/10 transition-colors",
              collapsed ? "p-0 w-full justify-center" : "p-1 justify-start"
            )}
            onClick={toggleCollapsed}
          >
            <PanelLeftClose 
              className="w-[15px] h-[15px]" 
              style={{ color: "var(--neutral-stone)" }}
            />
          </Button>
        </div>

        {/* New Chat Button - Direct Render for Better Visibility */}
        <div className={cn(
          "flex items-center w-full mb-3",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <div
            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shrink-0 transition-all cursor-pointer"
            style={{ backgroundColor: "var(--primary-blue)" }}
            onClick={handleNewChat}
          >
            <Plus className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span 
              className="ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-150"
              style={{ color: "var(--soft-off-white)" }}
            >
              New chat
            </span>
          )}
        </div>
      </div>

      {/* Recents Section - Only in expanded state */}
      <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="mt-4 w-full">
          <h3
            className={cn(
              "px-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-opacity duration-150",
              collapsed ? "opacity-0" : "opacity-100 delay-150"
            )}
            style={{ color: "var(--neutral-stone)" }}
          >
            Recents
          </h3>
          <div
            className={cn(
              "mt-2 space-y-1 transition-opacity duration-150",
              collapsed ? "opacity-0" : "opacity-100 delay-150"
            )}
          >
            {!collapsed && (
              <div className="px-0">
                <ChatHistory className="h-full text-sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with User Profile */}
      <div className="mt-auto w-full shrink-0">
        <UserProfile
          onOpenSettings={() => setActiveView("settings")}
          onOpenAdmin={isAdmin ? () => setActiveView("admin") : undefined}
          isAdmin={isAdmin}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}