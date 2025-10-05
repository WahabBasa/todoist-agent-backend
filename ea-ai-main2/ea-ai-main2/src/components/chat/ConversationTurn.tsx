import React from 'react'
import { User, Bot, Copy, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import type { UIMessage, ToolInvocationUIPart } from '@ai-sdk/ui-utils'

interface ConversationTurnProps {
  id: string
  userMessage: string
  aiMessage?: string
  aiParts?: UIMessage['parts']
  isThinking?: boolean
  isLast?: boolean
  error?: Error | null
  isRetriable?: boolean
  onRetry?: () => void
}

export const ConversationTurn: React.FC<ConversationTurnProps> = ({
  id,
  userMessage,
  aiMessage,
  aiParts: aiPartsProp,
  isThinking = false,
  isLast = false,
  error = null,
  isRetriable = false,
  onRetry
}) => {
  const toolParts = React.useMemo(() => {
    if (!Array.isArray(aiPartsProp)) return [] as ToolInvocationUIPart[]
    return aiPartsProp.filter((part): part is ToolInvocationUIPart => part?.type === 'tool-invocation')
  }, [aiPartsProp])

  const hasToolParts = toolParts.length > 0
  const activeTool = toolParts.some((part) => part.toolInvocation.state !== 'result')
  const thinkingState = isThinking || activeTool

  // Debug: Log what's being passed to this component
  React.useEffect(() => {
    console.log('🔄 [FRONTEND DEBUG] ConversationTurn component rendered:', {
      id,
      userMessagePreview: userMessage.substring(0, 50) + '...',
      hasAiMessage: !!aiMessage,
      aiMessagePreview: aiMessage ? aiMessage.substring(0, 50) + '...' : null,
      isThinking: thinkingState,
      isLast,
      isEmptyResponse: (!aiMessage || aiMessage.trim() === '') && !hasToolParts,
      toolParts: toolParts.map((part) => ({
        id: part.toolInvocation.toolCallId,
        state: part.toolInvocation.state,
        name: part.toolInvocation.toolName,
      })),
    });
  }, [id, userMessage, aiMessage, thinkingState, isLast, hasToolParts, toolParts]);
  
  const [copied, setCopied] = React.useState(false)
  
  // Check for empty responses
  const isEmptyResponse = (!aiMessage || aiMessage.trim() === '') && !hasToolParts;
  
  // Check if we should show retry button (error state on last message with no AI response and retriable error)
  const shouldShowRetry = isLast && error && isEmptyResponse && !thinkingState && isRetriable && onRetry;

  const handleCopy = () => {
    if (!aiMessage || isEmptyResponse) return
    
    try {
      void navigator.clipboard.writeText(aiMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  }

  const describeState = (state: ToolInvocationUIPart['toolInvocation']['state']) => {
    switch (state) {
      case 'result':
        return 'Completed';
      case 'partial-call':
        return 'Queued';
      case 'call':
      default:
        return 'Running';
    }
  }

  const formatStructured = (value: unknown) => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return (
    <div className="flex flex-col gap-8 w-full border-l-2 border-transparent hover:border-muted transition-colors">
      {/* User Message - Left aligned with avatar + bubble */}
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[92%]">
          {/* User Avatar */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full bg-muted border-2 border-border shadow-sm flex items-center justify-center"
            aria-label="User avatar"
          >
            <User size={20} className="text-muted-foreground" />
          </div>
          
          {/* User Message Bubble */}
          <div className="message-bubble-user">
            {userMessage}
          </div>
        </div>
      </div>

      {/* AI Response Area - Left aligned, no bubble (original clean design) */}
      <div className="flex justify-start group">
        <div className="flex items-start gap-3 max-w-[92%] w-full">
          {/* AI Avatar */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground border-2 border-primary shadow-sm flex items-center justify-center ${
              thinkingState ? 'animate-pulse' : ''
            }`}
            aria-label="AI assistant avatar"
          >
            <Bot size={20} />
          </div>
          
          {/* AI Content - Clean text design like reference */}
          <div className="flex-1">
            {thinkingState ? (
              /* Thinking Animation - ChatHub Style */
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce" />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-typing-dot-bounce"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
                <span className="text-tertiary text-xs ml-2">Thinking...</span>
              </div>
            ) : isEmptyResponse ? (
              /* Empty Response State with optional retry */
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle size={16} />
                <span className="text-sm">
                  {error ? `Error: ${error.message}` : 'No response was generated. Please try again.'}
                </span>
                {shouldShowRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="ml-2 h-7 px-3 text-xs"
                    aria-label="Retry message"
                  >
                    <RotateCcw size={12} className="mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ) : (
              /* AI Response */
              <div className="flex flex-col gap-4 text-primary">
                {aiMessage && aiMessage.trim() && (
                  <div className="whitespace-pre-wrap break-words leading-relaxed hyphens-auto space-y-3">
                    {aiMessage}
                  </div>
                )}
                {hasToolParts && (
                  <div className="flex flex-col gap-3">
                    {toolParts.map((part) => {
                      const { toolInvocation } = part
                      const args = toolInvocation.args
                      const result = (toolInvocation as any).result
                      return (
                        <div
                          key={toolInvocation.toolCallId}
                          className="rounded-design-md border border-border/60 bg-muted/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-primary">{toolInvocation.toolName || 'Tool'}</span>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {describeState(toolInvocation.state)}
                            </span>
                          </div>
                          {args !== undefined && (
                            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words bg-background/60 rounded-md p-2 border border-border/50">
                              {formatStructured(args)}
                            </pre>
                          )}
                          {result !== undefined && (
                            <pre className="text-sm whitespace-pre-wrap break-words border border-border/50 bg-background rounded-md p-3">
                              {typeof result === 'string' ? result : formatStructured(result)}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Copy Button - only show when AI response exists, is not empty, and not thinking */}
          {aiMessage && !thinkingState && !isEmptyResponse && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-design-md"
                onClick={handleCopy}
                aria-label={copied ? "Message copied" : "Copy message"}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}