import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { MessageSquare, X, Clock } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger 
} from "../ui/sheet";
import { ChatMenuItem } from "../sidebar/ChatMenuItem";

interface HistorySidebarProps {
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
}

export const HistorySidebar = ({ 
  currentSessionId, 
  onChatSelect 
}: HistorySidebarProps) => {
  const [open, setOpen] = useState(false);
  
  // Get chat sessions from Convex
  const sessions = useQuery(api.chatSessions.listSessions, {});
  const deleteChatSession = useMutation(api.chatSessions.deleteChatSession);

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    onChatSelect?.(sessionId);
    setOpen(false); // Close drawer after selection
  };

  const handleDeleteChat = async (sessionId: Id<"chatSessions">) => {
    try {
      await deleteChatSession({ sessionId });
      toast.success("Chat deleted successfully");
      
      // If the deleted chat was the current one, clear the current session
      if (currentSessionId === sessionId) {
        onChatSelect?.(null as any); // Clear current session
      }
      
      // Trigger history update event for other components
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MessageSquare size={20} />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="w-[320px] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Chat History</SheetTitle>
          <SheetDescription>Browse your recent conversations</SheetDescription>
        </SheetHeader>
        
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock size={18} />
              Recent History
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </Button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions?.map((session) => (
              <ChatMenuItem
                key={session._id}
                chat={session}
                isActive={currentSessionId === session._id}
                onSelect={() => handleChatSelect(session._id)}
                onDelete={() => handleDeleteChat(session._id)}
              />
            ))}
            
            {sessions?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start a new chat to see your history here</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};