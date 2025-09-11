import { Skeleton } from "./skeleton"
import { cn } from "@/lib/utils"

interface AppLoadingProps {
  className?: string
  message?: string
}

export function AppLoading({ className, message = "Loading..." }: AppLoadingProps) {
  return (
    <div className={cn("h-full w-full flex items-center justify-center", className)}>
      <div className="text-center space-y-6 max-w-md mx-auto">
        {/* Logo with pulse animation */}
        <div className="w-12 h-12 mx-auto bg-primary rounded-lg flex items-center justify-center animate-pulse">
          <span className="text-primary-foreground font-semibold text-xl">T</span>
        </div>
        
        {/* Loading message */}
        <p className="text-muted-foreground animate-pulse">{message}</p>
        
        {/* Skeleton content to simulate layout */}
        <div className="space-y-4 mt-8">
          {/* Chat history skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </div>
          
          {/* Chat input skeleton */}
          <div className="flex gap-2 items-center">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}