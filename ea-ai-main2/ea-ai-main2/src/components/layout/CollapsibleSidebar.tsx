import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Plus,
  Settings,
  Moon,
  Sun,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { UserProfile } from "../nav/UserProfile";
import { ChatHistory } from "../chat/ChatHistory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  activeView: "chat" | "settings";
  onViewChange: (view: "chat" | "settings") => void;
  onNewChat?: () => void;
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
  onOpenSettings?: () => void;
}

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
          "w-full justify-start gap-3 h-10 sidebar-item",
          collapsed ? "w-10 px-0 justify-center" : "px-3"
        )}
        onClick={onClick}
      >
        <div className="shrink-0">{icon}</div>
        {!collapsed && <span className="text-sm">{label}</span>}
      </Button>
      {children}
    </div>
  );
}

export function CollapsibleSidebar({
  activeView,
  onViewChange,
  onNewChat,
  currentSessionId,
  onChatSelect,
  onOpenSettings,
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const createChatSession = useMutation(api.chatSessions.createChatSession);

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
    try {
      const newSessionId = await createChatSession({});
      onViewChange("chat");
      onNewChat?.();
      onChatSelect?.(newSessionId);
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      toast.success("New chat started");
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat. Please try again.");
    }
  };

  const sidebarWidth = collapsed ? "w-14" : "w-72";

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 border-r border-border transition-all duration-300 ease-in-out",
        sidebarWidth
      )}
    >
      {/* Header with Toggle Button */}
      <div className="p-2 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 mx-auto"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </Button>
      </div>

      {/* Main Actions */}
      <div className="flex flex-col p-2 space-y-1">
        <SidebarMenuItem
          icon={<Plus size={20} />}
          label="New Chat"
          onClick={handleNewChat}
          collapsed={collapsed}
        />

        <SidebarMenuItem
          icon={<Settings size={20} />}
          label="Settings"
          onClick={() => onOpenSettings?.()}
          collapsed={collapsed}
        />

        <SidebarMenuItem
          icon={<MoreHorizontal size={20} />}
          label="More"
          collapsed={collapsed}
        >
          <DropdownMenu
            open={dropdownOpen}
            onOpenChange={(open) => {
              setDropdownOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              <div className="absolute inset-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-[200px]"
              align={collapsed ? "start" : "end"}
              side={collapsed ? "right" : "bottom"}
              sideOffset={4}
            >
              <DropdownMenuItem onClick={() => {}}>About</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>Feedback</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>Support</DropdownMenuItem>
              <div className="my-1 h-[1px] bg-border w-full" />
              <DropdownMenuItem
                onClick={() => {
                  setTheme(theme === "light" ? "dark" : "light");
                }}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                <span className="ml-2">
                  Switch to {theme === "light" ? "dark" : "light"} mode
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </div>

      {/* Chat History - Only in expanded state */}
      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-2 py-1 shrink-0">
            <div className="text-xs font-medium text-muted-foreground px-2 py-2">
              Recent Chats
            </div>
          </div>
          <div className="flex-1 min-h-0 px-2">
            <ChatHistory
              currentSessionId={currentSessionId}
              onChatSelect={onChatSelect}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Footer with User Profile */}
      <div className="mt-auto shrink-0 p-2 border-t border-border">
        <UserProfile onOpenSettings={onOpenSettings} collapsed={collapsed} />
      </div>
    </div>
  );
}