"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "../ErrorBoundary";
import { useSessions } from "../../context/sessions";
import { useState } from "react";
import { ChatMenuItem } from "../sidebar/ChatMenuItem";
import { SidebarMenu } from "../ui/sidebar";

interface ChatHistoryProps {
  className?: string;
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
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-dark pb-2">
          <SidebarMenu className="space-y-1">
            {sessions?.map((session) => (
              <ChatMenuItem
                key={session._id}
                chat={session as any}
                isActive={currentSessionId === session._id}
                onSelect={() => void handleChatSelect(session._id)}
                onDelete={() => void handleDeleteChat(session._id)}
                isDeleting={switchingSessionId === session._id}
                canDelete={true}
              />
            ))}
          </SidebarMenu>
          
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