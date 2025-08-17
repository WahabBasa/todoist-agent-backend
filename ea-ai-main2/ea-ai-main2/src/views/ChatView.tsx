import { useState, useMemo, useRef, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import Textarea from 'react-textarea-autosize';
import { ArrowUp, Square, MessageCirclePlus, ChevronDown } from 'lucide-react';

// AI SDK Elements imports (keeping Message and Response components)
import { Message, MessageContent } from "../components/ai-elements/message";
import { Response } from "../components/ai-elements/response";

// UI Components
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

// Keep existing prompt suggestions for now
import { PromptSuggestions } from "../components/ui/prompt-suggestions";

// Define section structure interface
interface ChatSection {
  id: string; // User message ID
  userMessage: Message;
  assistantMessages: Message[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatView() {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useHaiku] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [enterDisabled, setEnterDisabled] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatWithAI = useAction(api.ai.chatWithAI);
  const conversation = useQuery(api.conversations.getConversation);

  // Convert existing conversation messages to display format
  const messages = useMemo(() => {
    return conversation ? 
      ((conversation.messages as any[]) || [])
        .filter(msg => msg.role === "user" || msg.role === "assistant")
        .map((msg, index) => ({
          id: `${msg.timestamp}-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }))
      : [];
  }, [conversation]);

  // Convert messages array to sections array using Morphic's pattern
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = [];
    let currentSection: ChatSection | null = null;

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection);
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        };
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message);
      }
      // Ignore other role types for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection);
    }

    return result;
  }, [messages]);

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const threshold = 50; // threshold in pixels
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true);
      } else {
        setIsAtBottom(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Set initial state

    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to bottom when messages change (user or assistant)
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        handleScrollToBottom();
      });
    }
  }, [messages.length]);

  // Initial scroll to bottom when conversation first loads
  useEffect(() => {
    if (messages.length > 0) {
      // Delay to ensure DOM is rendered
      setTimeout(() => {
        handleScrollToBottom();
      }, 100);
    }
  }, [conversation]);

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
    void handleSubmit(message.content);
  };

  const handleCompositionStart = () => setIsComposing(true);

  const handleCompositionEnd = () => {
    setIsComposing(false);
    setEnterDisabled(true);
    setTimeout(() => {
      setEnterDisabled(false);
    }, 300);
  };

  const handleNewChat = () => {
    // TODO: Implement new chat functionality
    setInput("");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      void handleSubmit(input.trim());
    }
  };

  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
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

  // Show loading state while conversation is loading
  if (conversation === undefined) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-base">Loading conversation...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
      data-testid="full-chat"
    >
      {/* Messages Container - Direct scroll container */}
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        role="list"
        aria-roledescription="chat messages"
        className="flex-1 overflow-y-auto pt-14"
      >
          {sections.length === 0 ? (
            /* Empty State - Centered */
            <div className="h-full flex flex-col items-center justify-center p-6">
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
            /* Messages - Scrollable */
            <div className="relative mx-auto w-full max-w-3xl px-4">
              {sections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className="chat-section mb-8"
                  style={
                    sectionIndex === sections.length - 1
                      ? { minHeight: 'calc(-228px + 100dvh)' }
                      : {}
                  }
                >
                  {/* User message */}
                  <div className="flex flex-col gap-4 mb-4">
                    <Message from={section.userMessage.role}>
                      <MessageContent>
                        {section.userMessage.content}
                      </MessageContent>
                    </Message>
                  </div>

                  {/* Assistant messages */}
                  {section.assistantMessages.map(assistantMessage => (
                    <div key={assistantMessage.id} className="flex flex-col gap-4 mb-4">
                      <Message from={assistantMessage.role}>
                        <MessageContent>
                          <Response>{assistantMessage.content}</Response>
                        </MessageContent>
                      </Message>
                    </div>
                  ))}
                </div>
              ))}
              
              {/* Loading indicator - show after last section */}
              {isGenerating && (
                <div className="mb-4">
                  <Message from="assistant">
                    <MessageContent>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Thinking...</span>
                      </div>
                    </MessageContent>
                  </Message>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Input Panel - Natural bottom position */}
      <div 
        className={cn(
          'w-full bg-background group/form-container shrink-0',
          messages.length > 0 ? 'px-2 pb-4' : 'px-6'
        )}
      >
        {messages.length === 0 && (
          <div className="mb-10 flex flex-col items-center gap-4">
            <div className="size-12 text-muted-foreground" />
            <p className="text-center text-3xl font-semibold">
              How can I help you today?
            </p>
          </div>
        )}
        
        <form onSubmit={onSubmit} className="max-w-3xl w-full mx-auto relative">
          {/* Scroll to bottom button - only shown when not at bottom */}
          {!isAtBottom && messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
              onClick={handleScrollToBottom}
              title="Scroll to bottom"
            >
              <ChevronDown size={16} />
            </Button>
          )}

          <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
            <Textarea
              name="input"
              rows={2}
              maxRows={5}
              tabIndex={0}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Ask a question..."
              spellCheck={false}
              value={input}
              disabled={isGenerating}
              className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !isComposing &&
                  !enterDisabled
                ) {
                  if (input.trim().length === 0) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  const textarea = e.target as HTMLTextAreaElement;
                  textarea.form?.requestSubmit();
                }
              }}
            />

            {/* Bottom control bar */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  Claude 3.5 Sonnet
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNewChat}
                    className="shrink-0 rounded-full group"
                    type="button"
                    disabled={isGenerating}
                  >
                    <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                  </Button>
                )}
                <Button
                  type={isGenerating ? 'button' : 'submit'}
                  size="icon"
                  variant="outline"
                  className={cn(isGenerating && 'animate-pulse', 'rounded-full')}
                  disabled={
                    (input.length === 0 && !isGenerating)
                  }
                  onClick={isGenerating ? () => {} : undefined}
                >
                  {isGenerating ? <Square size={20} /> : <ArrowUp size={20} />}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}