import { useState, useRef, useEffect } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Trash2, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: any;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
}

export function ChatView() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useHaiku, setUseHaiku] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatWithAI = useAction(api.ai.chatWithAI);
  const clearConversation = useMutation(api.conversations.clearConversation);
  const conversation = useQuery(api.conversations.getConversation);
  
  // --- THIS IS THE FIX ---
  // Cast to `any[]` first for robustness before casting to `Message[]`
  const messages: Message[] = (conversation?.messages as any[]) || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);

    try {
      const result = await chatWithAI({ message: userMessage, useHaiku });
      
      if (result.toolResults && result.toolResults.length > 0) {
        const successfulToolCalls = result.toolResults.filter(tc => (tc as any).success);
        if (successfulToolCalls.length > 0) {
          toast.success(`Executed ${successfulToolCalls.length} action(s) successfully`);
        }
        
        const failedToolCalls = result.toolResults.filter(tc => !(tc as any).success);
        if (failedToolCalls.length > 0) {
          toast.error(`${failedToolCalls.length} action(s) failed`);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClearChat = async () => {
    try {
      await clearConversation();
      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Clear chat error:", error);
      toast.error("Failed to clear chat history");
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none bg-background border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <span className="text-lg">🤖</span>
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-semibold">AI Task Assistant</h2>
            <p className="text-sm text-muted-foreground">
              Ask me to create tasks, manage projects, or help with your workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              title="Clear chat history"
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor="haiku-toggle" className="text-xs cursor-pointer">
                {useHaiku ? 'Claude 3.5 Haiku' : 'Claude 3 Haiku'}
              </Label>
              <input
                id="haiku-toggle"
                type="checkbox"
                className="w-4 h-4"
                checked={useHaiku}
                onChange={(e) => setUseHaiku(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold mb-2">Welcome to TaskAI</h3>
                <p className="text-muted-foreground mb-6">
                  I'm your AI task management assistant. I can help you create tasks, 
                  organize projects, and manage your workflow through natural language.
                </p>
                <div className="space-y-2 text-sm">
                  <Card className="p-3">
                    <CardContent className="p-0">
                      <strong>Try asking:</strong>
                      <ul className="mt-2 space-y-1 text-left">
                        <li>• "Create a task to review the quarterly report"</li>
                        <li>• "Show me my active tasks"</li>
                        <li>• "Create a project for the website redesign"</li>
                        <li>• "Delete the 'Old Project'"</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages
                .filter(msg => msg.role === "user" || msg.role === "assistant")
                .map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-muted">
                      {msg.role === "user" ? "👤" : "🤖"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 max-w-[80%]">
                    <div className={`flex items-center gap-2 mb-1 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}>
                      <span className="text-sm font-medium">
                        {msg.role === "user" ? "You" : "AI Assistant"}
                      </span>
                      <time className="text-xs text-muted-foreground">
                        {formatTimestamp(msg.timestamp)}
                      </time>
                    </div>
                    <Card className={`${msg.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <CardContent className="p-3">
                        {typeof msg.content === 'string' && (
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-muted">
                      🤖
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 max-w-[80%]">
                    <Card className="bg-muted">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none bg-background border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            className="flex-1"
            placeholder="Ask me to create a task, show your projects, or help with your workflow..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            disabled={!message.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
        <div className="text-xs text-center text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}