import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { MessageSquare, X, Clock } from "lucide-react";
import { AnimatePresence } from "framer-motion";
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
import { useSessions } from "../../context/sessions";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSessionStore } from "../../store/sessionStore";
import { useChatStore } from "../../store/chatStore";

interface HistorySidebarProps {
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
}

export const HistorySidebar = ({ 
  currentSessionId, 
  onChatSelect 
}: HistorySidebarProps) => {
  const [open, setOpen] = useState(false);
  const { sessions, currentSessionId: storeCurrentId, selectSession, deleteSession } = useSessions();
  const [deletingIds, setDeletingIds] = useState<Set<Id<"chatSessions">>>(new Set());
  const clearBySession = useMutation(api.conversations.clearConversationsBySession);
  const updateSessionMeta = useMutation(api.chatSessions.updateChatSession);

  const activeSessionId = currentSessionId ?? storeCurrentId;

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    if (onChatSelect) {
      onChatSelect(sessionId);
    } else {
      selectSession(sessionId);
    }
    setOpen(false); // Close drawer after selection
  };

  const handleDeleteChat = async (sessionId: Id<"chatSessions">) => {
    try {
      // 1. Mark as deleting (for visual state - disable interaction)
      setDeletingIds(prev => new Set(prev).add(sessionId));
      
      // 2. Delete from backend immediately (no artificial delay)
      await deleteSession(sessionId);
      
      // 4. Clean up deleting state
      setDeletingIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
      
      // 5. Show success toast
      toast.success("Chat deleted successfully");
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
      
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setDeletingIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
      toast.error("Failed to delete chat. Please try again.");
    }
  };

  const handleClearChat = async (sessionId: Id<"chatSessions">) => {
    try {
      await clearBySession({ sessionId });
      await updateSessionMeta({ sessionId, messageCount: 0, lastMessageAt: Date.now() });
      // Update local stores for immediate UX
      useSessionStore.getState().actions.setHasMessages(sessionId, false);
      useSessionStore.getState().actions.bumpSessionStats(sessionId, { setMessageCount: 0, lastMessageAt: Date.now() });
      // If clearing the active session, clear chat UI instance as well
      if (activeSessionId === sessionId) {
        useChatStore.getState().clear(String(sessionId));
      }
      toast.success("Chat messages cleared");
      window.dispatchEvent(new CustomEvent('chat-history-updated'));
    } catch (error) {
      console.error("Failed to clear chat messages:", error);
      toast.error("Failed to clear messages. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10">
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
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock size={18} />
              Recent History
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </Button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <ChatMenuItem
                  key={session._id}
                  chat={session}
                  isActive={activeSessionId === session._id}
                  onSelect={() => handleChatSelect(session._id)}
                  onDelete={() => handleDeleteChat(session._id)}
                  isDeleting={deletingIds.has(session._id)}
                  onClear={() => handleClearChat(session._id)}
                  canDelete={true}
                />
              ))}
            </AnimatePresence>
            
            {sessions.length === 0 && (
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
