import { useState, useRef, useEffect } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

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

  const renderToolCall = (toolCall: { name: string; args: any; result: any }) => {
    const isSuccess = toolCall.result !== null && toolCall.result !== undefined;
    const resultDisplay = isSuccess ? JSON.stringify(toolCall.result, null, 2) : "Not found or failed.";

    return (
      <div 
        key={`${toolCall.name}-${JSON.stringify(toolCall.args)}`}
        className={`
          p-3 rounded-lg border-l-4 mt-2 text-left
          ${isSuccess 
            ? 'bg-success/10 border-success text-success-content' 
            : 'bg-error/10 border-error text-error-content'
          }
        `}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold font-mono text-sm">{toolCall.name}</span>
          <div className={`badge badge-sm ${isSuccess ? 'badge-success' : 'badge-error'}`}>
            {isSuccess ? 'Success' : 'Failed'}
          </div>
        </div>
        <div className="text-xs font-mono opacity-80 collapse">
            <input type="checkbox" className="min-h-0" /> 
            <div className="collapse-title text-xs p-0 min-h-0 font-medium">
                Show Details
            </div>
            <div className="collapse-content p-0">
                <p><strong>Arguments:</strong> {JSON.stringify(toolCall.args, null, 2)}</p>
                <p><strong>Result:</strong> {resultDisplay}</p>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none bg-base-100 border-b border-base-300 p-4">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">AI Task Assistant</h2>
            <p className="text-sm text-base-content/70">
              Ask me to create tasks, manage projects, or help with your workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm text-error hover:bg-error/20"
              onClick={handleClearChat}
              title="Clear chat history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <span className="label-text text-xs">
                  {useHaiku ? 'Claude 3.5 Haiku' : 'Claude 3.5 Sonnet'}
                </span>
                <input 
                  type="checkbox" 
                  className="toggle toggle-sm toggle-primary" 
                  checked={useHaiku}
                  onChange={(e) => setUseHaiku(e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2">Welcome to TaskAI</h3>
              <p className="text-base-content/70 mb-6">
                I'm your AI task management assistant. I can help you create tasks, 
                organize projects, and manage your workflow through natural language.
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-base-200 rounded-lg p-3">
                  <strong>Try asking:</strong>
                  <ul className="mt-2 space-y-1 text-left">
                    <li>• "Create a task to review the quarterly report"</li>
                    <li>• "Show me my active tasks"</li>
                    <li>• "Create a project for the website redesign"</li>
                    <li>• "Delete the 'Old Project'"</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
              >
                <div className="chat-image avatar">
                  <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                </div>
                <div className="chat-header">
                  {msg.role === "user" ? "You" : "AI Assistant"}
                  <time className="text-xs opacity-50 ml-2">
                    {formatTimestamp(msg.timestamp)}
                  </time>
                </div>
                <div className={`chat-bubble ${
                  msg.role === "user" 
                    ? "chat-bubble-primary" 
                    : "chat-bubble-secondary"
                }`}>
                  {typeof msg.content === 'string' && (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                  
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.toolCalls.map((toolCall, tcIndex) => (
                        <div key={tcIndex}>
                          {renderToolCall(toolCall)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat chat-start">
                <div className="chat-image avatar">
                  <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                    🤖
                  </div>
                </div>
                <div className="chat-bubble chat-bubble-secondary">
                  <div className="flex items-center gap-2">
                    <span className="loading loading-dots loading-sm"></span>
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none bg-base-100 border-t border-base-300 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="input input-bordered flex-1"
            placeholder="Ask me to create a task, show your projects, or help with your workflow..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={!message.trim() || isLoading}
          >
            {isLoading ? '' : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        <div className="text-xs text-center text-base-content/50 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}