import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

// AI SDK Elements imports
import { Conversation, ConversationContent, ConversationScrollButton } from "../components/ai-elements/conversation";
import { Message, MessageContent } from "../components/ai-elements/message";
import { Response } from "../components/ai-elements/response";
import { PromptInput, PromptInputTextarea, PromptInputToolbar, PromptInputSubmit } from "../components/ai-elements/prompt-input";

// Keep existing prompt suggestions for now
import { PromptSuggestions } from "../components/ui/prompt-suggestions";

export function ChatView() {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useHaiku] = useState(false);
  
  const chatWithAI = useAction(api.ai.chatWithAI);
  const conversation = useQuery(api.conversations.getConversation);

  // Convert existing conversation messages to display format
  const messages = conversation ? 
    ((conversation.messages as any[]) || [])
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map((msg, index) => ({
        id: `${msg.timestamp}-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }))
    : [];

  const handleSubmit = async (inputValue: string) => {
    if (!inputValue.trim() || isGenerating) return;

    setIsGenerating(true);
    setInput("");

    try {
      const result = await chatWithAI({ message: inputValue.trim(), useHaiku });
      
      // Handle tool results feedback
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

  const handleAppend = async (message: { role: "user"; content: string }) => {
    await handleSubmit(message.content);
  };

  const suggestions = [
    "Create a task to review the quarterly report",
    "Show me all my active tasks",
    "Create a project for the website redesign",
    "Delete the 'Old Project'",
    "Mark all high priority tasks as completed",
    "Move all marketing tasks to the Website Redesign project"
  ];

  // Show loading state while conversation is loading
  if (conversation === undefined) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-base">Loading conversation...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Conversation className="flex-1 relative">
        <ConversationContent className="p-4">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[60vh]">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-foreground mb-2">Start a conversation</h3>
                <p className="text-base text-muted-foreground max-w-md">
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
            /* Messages */
            <div className="max-w-3xl mx-auto space-y-3 px-8">
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.role === 'assistant' ? (
                      <Response>{message.content}</Response>
                    ) : (
                      message.content
                    )}
                  </MessageContent>
                </Message>
              ))}
              
              {/* Loading indicator */}
              {isGenerating && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Thinking...</span>
                    </div>
                  </MessageContent>
                </Message>
              )}
            </div>
          )}
        </ConversationContent>
        
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="bg-background p-6 flex justify-center">
        <div className="w-full max-w-3xl">
          <PromptInput 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const inputValue = formData.get('message') as string;
              if (inputValue) {
                handleSubmit(inputValue);
              }
            }}
            className="bg-card/90 border-0 rounded-xl shadow-lg"
          >
            <PromptInputTextarea 
              name="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[60px] resize-none"
            />
            <PromptInputToolbar>
              <PromptInputSubmit
                className="absolute right-2 bottom-2"
                disabled={isGenerating}
                status={isGenerating ? 'streaming' : 'ready'}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}