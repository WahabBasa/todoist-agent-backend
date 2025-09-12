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

// No props needed - everything from contexts

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
          "w-full justify-start gap-3 h-10 sidebar-item hover:bg-accent/50 transition-colors",
          collapsed ? "w-10 px-0 justify-center" : "px-3"
        )}
        onClick={onClick}
      >
        <div className="shrink-0">{icon}</div>
        {!collapsed && <span className="text-sm font-sans font-medium text-foreground">{label}</span>}
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
    activeView, 
    setActiveView 
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

  const sidebarWidth = collapsed ? "w-12" : "w-80";

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 border-r border-border transition-all duration-300 ease-in-out",
        sidebarWidth
      )}
    >
      {/* Header with Toggle Button */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn("mx-auto h-10 w-10")}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </Button>
      </div>

      {/* Main Actions */}
      <div className="flex flex-col px-2 pb-3">
        <SidebarMenuItem
          icon={<Plus size={20} />}
          label="New Chat"
          onClick={handleNewChat}
          collapsed={collapsed}
        />
      </div>

      {/* Chat History - Only in expanded state */}
      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col transition-opacity duration-300 ease-in-out">
          <div className="px-3 py-2 shrink-0">
            <div className="text-xs font-sans font-medium text-muted-foreground px-2 py-1">
              Recents
            </div>
          </div>
          <div className="flex-1 min-h-0 px-3">
            <ChatHistory className="h-full" />
          </div>
        </div>
      )}

      {/* Footer with User Profile */}
      <div className="mt-auto shrink-0 p-3">
        <UserProfile
          onOpenSettings={() => setActiveView("settings")}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}