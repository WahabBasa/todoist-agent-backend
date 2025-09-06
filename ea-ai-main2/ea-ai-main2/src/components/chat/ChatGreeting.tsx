interface ChatGreetingProps {
  className?: string
}

export function ChatGreeting({ className = "" }: ChatGreetingProps) {
  return (
    <div className={`flex flex-col items-center text-center mb-8 ${className}`}>
      <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6">
        <div className="text-2xl font-bold">T</div>
      </div>
      <h2 className="text-2xl font-semibold mb-3">Welcome to TaskAI</h2>
      <p className="text-muted-foreground text-lg max-w-2xl">
        Your intelligent task management assistant. Ask me anything about organizing your work, managing projects, or planning your day.
      </p>
    </div>
  )
}