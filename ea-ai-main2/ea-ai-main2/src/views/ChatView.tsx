import { useState } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { PromptSuggestions } from "../components/ui/prompt-suggestions";
import { MessageInput } from "../components/ui/message-input";
import { Card, CardContent } from "../components/ui/card";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt?: Date;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
}

export function ChatView() {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useHaiku, setUseHaiku] = useState(false);

  const chatWithAI = useAction(api.ai.chatWithAI);
  const conversation = useQuery(api.conversations.getConversation);
  
  // Only transform messages if conversation has loaded to prevent flash
  const messages: Message[] = conversation ? 
    ((conversation.messages as any[]) || [])
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map((msg, index) => ({
        id: `${msg.timestamp}-${index}`,
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        createdAt: new Date(msg.timestamp),
        timestamp: msg.timestamp,
        toolCalls: msg.toolCalls
      }))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput("");
    setIsGenerating(true);

    try {
      const result = await chatWithAI({ message: userMessage, useHaiku });
      
      // Check if result has toolResults property (handle different API response formats)
      if (result && typeof result === 'object' && 'toolResults' in result && Array.isArray((result as any).toolResults)) {
        const toolResults = (result as any).toolResults;
        if (toolResults.length > 0) {
          const successfulToolCalls = toolResults.filter((tc: any) => tc.success);
          if (successfulToolCalls.length > 0) {
            toast.success(`Executed ${successfulToolCalls.length} action(s) successfully`);
          }
          
          const failedToolCalls = toolResults.filter((tc: any) => !tc.success);
          if (failedToolCalls.length > 0) {
            toast.error(`${failedToolCalls.length} action(s) failed`);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleAppend = async (message: { role: "user"; content: string }) => {
    setInput(message.content);
    // Auto-submit the suggestion
    setIsGenerating(true);
    try {
      const result = await chatWithAI({ message: message.content, useHaiku });
      
      // Check if result has toolResults property (handle different API response formats)
      if (result && typeof result === 'object' && 'toolResults' in result && Array.isArray((result as any).toolResults)) {
        const toolResults = (result as any).toolResults;
        if (toolResults.length > 0) {
          const successfulToolCalls = toolResults.filter((tc: any) => tc.success);
          if (successfulToolCalls.length > 0) {
            toast.success(`Executed ${successfulToolCalls.length} action(s) successfully`);
          }
          
          const failedToolCalls = toolResults.filter((tc: any) => !tc.success);
          if (failedToolCalls.length > 0) {
            toast.error(`${failedToolCalls.length} action(s) failed`);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsGenerating(false);
      setInput("");
    }
  };


  const suggestions = [
    "Create a task to review the quarterly report",
    "Show me all my active tasks",
    "Create a project for the website redesign",
    "Delete the 'Old Project'",
    "Mark all high priority tasks as completed",
    "Move all marketing tasks to the Website Redesign project"
  ];


  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Messages Container - Full height, seamless background */}
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
            <div className="text-center mb-6">
              <div className="mb-3"></div>
              <h3 className="text-lg font-medium text-main mb-2">Start a conversation</h3>
              <p className="text-base text-secondary max-w-md">
                Ask me to create tasks, manage projects, or help with your workflow
              </p>
            </div>
            
            <div className="w-full max-w-md">
              <PromptSuggestions
                label="Quick actions:"
                append={handleAppend}
                suggestions={suggestions}
              />
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <div className="max-w-3xl mx-auto space-y-3 px-8">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    /* User Message - Left aligned within centered container */
                    <div className="flex justify-start">
                      <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 shadow-sm flex items-center gap-2 max-w-[90%]">
                        <Avatar className="w-5 h-5 flex-shrink-0">
                          <AvatarFallback className="bg-primary-foreground text-primary text-xs font-medium">W</AvatarFallback>
                        </Avatar>
                        <p className="text-base text-primary whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* AI Message - Left aligned within centered container */
                    <div className="flex justify-start">
                      <div className="bg-muted/30 rounded-lg px-3 py-2 max-w-[90%]">
                        <p className="text-base text-main whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing Indicator */}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-system-base text-lightness-secondary">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Typing...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Clean single border */}
      <div className="bg-background p-6 flex justify-center">
        <div className="w-full max-w-3xl">
          <form onSubmit={handleSubmit}>
            <MessageInput
              value={input}
              onChange={handleInputChange}
              isGenerating={isGenerating}
              placeholder="Type a message..."
              allowAttachments={false}
              className="bg-card/90 border-0 rounded-xl shadow-lg"
              stop={isGenerating ? () => setIsGenerating(false) : undefined}
            />
          </form>
        </div>
      </div>
    </div>
  );
}