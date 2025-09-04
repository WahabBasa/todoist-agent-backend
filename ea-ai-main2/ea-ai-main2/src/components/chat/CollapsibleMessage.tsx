import { cn } from "@/lib/utils"

interface CollapsibleMessageProps {
  children: React.ReactNode
  role: 'user' | 'assistant'
  showIcon?: boolean
}

export function CollapsibleMessage({
  children,
  role,
  showIcon = true
}: CollapsibleMessageProps) {
  return (
    <div className="flex">
      {showIcon && (
        <div className="relative flex flex-col items-center">
          <div className="w-6 h-6">
            {role === 'assistant' ? (
              <div className="w-6 h-6 rounded-design-md bg-primary text-primary-foreground flex items-center justify-center text-utility font-medium">
                AI
              </div>
            ) : (
              <div className="w-6 h-6 rounded-design-md bg-primary text-primary-foreground flex items-center justify-center text-utility font-medium">
                U
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex-1',
          role === 'assistant' ? 'px-0' : 'px-3'
        )}
      >
        {children}
      </div>
    </div>
  )
}