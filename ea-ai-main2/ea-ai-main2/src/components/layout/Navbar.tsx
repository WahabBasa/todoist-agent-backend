import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Plus,
  MessageSquare,
  Settings,
  Moon,
  Sun,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { UserProfile } from "../nav/UserProfile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTheme } from "next-themes";

interface NavbarProps {
  activeView: "chat" | "settings";
  onViewChange: (view: "chat" | "settings") => void;
  onNewChat?: () => void;
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
  onOpenSettings?: () => void;
}

export function Navbar({ 
  activeView, 
  onViewChange, 
  onNewChat,
  currentSessionId,
  onChatSelect,
  onOpenSettings
}: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
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

  const renderNewSession = () => {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="min-w-8 h-8"
        onClick={handleNewChat}
      >
        <Plus size={20} />
      </Button>
    );
  };

  return (
    <div className="absolute z-[50] flex flex-col justify-center items-center gap-3 pb-6 md:p-3 top-0 bottom-0 left-0 border-r border-zinc-50 dark:border-white/5">
      <div className="flex flex-row gap-2 items-center">
        {renderNewSession()}
      </div>

      {/* Chat history now in persistent sidebar */}

      <div className="flex-1" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          onOpenSettings?.();
        }}
        className="h-8 w-8"
      >
        <Settings size={20} />
      </Button>

      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          document.body.style.pointerEvents = "auto";
          setIsOpen(open);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-[250px] text-sm md:text-base mr-2"
          align="end"
          side="left"
          sideOffset={4}
        >
          <DropdownMenuItem onClick={() => {}}>About</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>Feedback</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>Support</DropdownMenuItem>
          <div className="my-1 h-[1px] bg-black/10 dark:bg-white/10 w-full" />

          <DropdownMenuItem
            onClick={() => {
              setTheme(theme === "light" ? "dark" : "light");
            }}
          >
            {theme === "light" ? (
              <Moon size={18} />
            ) : (
              <Sun size={18} />
            )}
            Switch to {theme === "light" ? "dark" : "light"} mode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserProfile onOpenSettings={onOpenSettings} />
    </div>
  );
}