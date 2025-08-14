import { useState } from "react"
import { Chat } from "@/components/ui/chat"
import { Button } from "@/components/ui/button"

// Test component to verify shadcn-chatbot-kit installation
export function ChatKitTest() {
  const [messages, setMessages] = useState([
    {
      id: "1",
      role: "assistant" as const,
      content: "Hello! The shadcn-chatbot-kit is successfully installed and configured. You can now use all the chat components including:\n\n- **Chat**: Main chat interface\n- **MessageInput**: Auto-resizing input with file attachments\n- **MessageList**: Scrollable message list\n- **PromptSuggestions**: Clickable suggestions\n- **TypingIndicator**: Animated typing dots\n- **MarkdownRenderer**: Syntax highlighting support\n- **AudioVisualizer**: Voice input visualization",
      createdAt: new Date(),
    }
  ])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const handleSubmit = (event?: { preventDefault?: () => void }) => {
    if (event?.preventDefault) {
      event.preventDefault()
    }
    
    if (!input.trim()) return

    // Add user message
    const userMessage = {
      id: String(messages.length + 1),
      role: "user" as const,
      content: input,
      createdAt: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsGenerating(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage = {
        id: String(messages.length + 2),
        role: "assistant" as const,
        content: `You said: "${input}"\n\nThis is a test response to verify the chat functionality is working properly. The shadcn-chatbot-kit components are responding correctly!`,
        createdAt: new Date(),
      }
      setMessages(prev => [...prev, aiMessage])
      setIsGenerating(false)
    }, 1500)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const stop = () => {
    setIsGenerating(false)
  }

  const append = (message: { role: "user"; content: string }) => {
    const newMessage = {
      id: String(messages.length + 1),
      role: message.role,
      content: message.content,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">shadcn-chatbot-kit Test</h2>
        <p className="text-sm text-muted-foreground">
          Testing the installed chat components
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Chat
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isGenerating={isGenerating}
          stop={stop}
          append={append}
          suggestions={[
            "Test basic chat functionality",
            "Check markdown rendering with **bold** text",
            "Verify typing indicators work"
          ]}
          className="h-full"
        />
      </div>
    </div>
  )
}