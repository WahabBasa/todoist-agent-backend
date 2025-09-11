import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "../ErrorBoundary";
import { useSessions } from "../../context/sessions";
import { useState } from "react";

interface ChatHistoryProps {
  className?: string;
}

interface ChatSessionItemProps {
  session: {
    _id: string;
    title: string;
    lastMessageAt: number;
    messageCount: number;
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ChatSessionItem({ session, isActive, onSelect, onDelete, isLoading }: ChatSessionItemProps & { isLoading?: boolean }) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-foreground",
        isLoading && "opacity-70"
      )}
      onClick={isLoading ? undefined : onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className="text-sm font-sans font-medium text-utility truncate">{session.title}</span>
        </div>
      </div>
      
      {!isLoading && (
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
      )}
    </div>
  );
}

export function ChatHistory({ className }: ChatHistoryProps) {
  // ChatHub pattern: Get everything from centralized SessionsContext
  const {
    currentSessionId,
    sessions,
    selectSession,
    deleteSession
  } = useSessions();
  
  // Track loading state for session switching
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(null);

  const handleChatSelect = async (sessionId: string) => {
    setSwitchingSessionId(sessionId);
    try {
      await selectSession(sessionId as any);
    } finally {
      setSwitchingSessionId(null);
    }
  };

  const handleDeleteChat = async (sessionId: string) => {
    await deleteSession(sessionId as any);
  };

  return (
    <ErrorBoundary fallback={<div className="p-4 text-sm text-muted-foreground">Chat history unavailable</div>}>
      <div className={cn("flex flex-col h-full min-h-0", className)}>
        {/* Sessions List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0 scrollbar-dark pb-2">
          {sessions?.map((session) => (
            <ChatSessionItem
              key={session._id}
              session={session}
              isActive={currentSessionId === session._id}
              onSelect={() => handleChatSelect(session._id)}
              onDelete={() => handleDeleteChat(session._id)}
              isLoading={switchingSessionId === session._id}
            />
          ))}
          
          {sessions?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-sans">No conversations yet</p>
              <p className="text-xs font-sans">Start a new chat to see your history here</p>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}