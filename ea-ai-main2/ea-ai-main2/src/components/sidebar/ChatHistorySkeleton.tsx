import { Skeleton } from "../ui/skeleton"

export function ChatHistorySkeleton() {
  return (
    <div className="gap-tertiary flex flex-col">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-secondary padding-secondary">
          <Skeleton className="w-4 h-4 rounded-design-sm" />
          <div className="flex-1 gap-tertiary flex flex-col">
            <Skeleton className="h-4 w-3/4 rounded-design-sm" />
            <Skeleton className="h-3 w-1/2 rounded-design-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}