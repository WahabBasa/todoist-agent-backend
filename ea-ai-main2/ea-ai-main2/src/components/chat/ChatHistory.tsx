import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { MessageSquare, Clock, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "../ErrorBoundary";

interface ChatHistoryProps {
  currentSessionId?: Id<"chatSessions"> | null;
  onChatSelect?: (sessionId: Id<"chatSessions">) => void;
  className?: string;
}

interface ChatSessionItemProps {
  session: {
    _id: Id<"chatSessions">;
    title: string;
    lastMessageAt: number;
    messageCount: number;
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ChatSessionItem({ session, isActive, onSelect, onDelete }: ChatSessionItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-foreground"
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{session.title}</span>
        </div>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock size={10} />
          <span>{new Date(session.lastMessageAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>{session.messageCount} messages</span>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={12} />
      </Button>
    </div>
  );
}

export function ChatHistory({ currentSessionId, onChatSelect, className }: ChatHistoryProps) {
  // Get chat sessions from Convex
  const sessions = useQuery(api.chatSessions.getChatSessions, {});
  const deleteChatSession = useMutation(api.chatSessions.deleteChatSession);

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    onChatSelect?.(sessionId);
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
    <ErrorBoundary fallback={<div className="p-4 text-sm text-muted-foreground">Chat history unavailable</div>}>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-dark">
          {sessions?.sessions?.map((session) => (
            <ChatSessionItem
              key={session._id}
              session={session}
              isActive={currentSessionId === session._id}
              onSelect={() => handleChatSelect(session._id)}
              onDelete={() => handleDeleteChat(session._id)}
            />
          ))}
          
          {sessions?.sessions?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a new chat to see your history here</p>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}