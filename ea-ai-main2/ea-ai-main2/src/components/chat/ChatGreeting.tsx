interface ChatGreetingProps {
  className?: string
}

export function ChatGreeting({ className = "" }: ChatGreetingProps) {
  return (
    <div className={`text-center mb-6 ${className}`}>
      <p className="text-foreground text-base font-medium">
        How can I help you today?
      </p>
    </div>
  )
}