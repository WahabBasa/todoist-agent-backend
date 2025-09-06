import { UserButton } from "@clerk/clerk-react"
import { useUser } from "@clerk/clerk-react"
import { cn } from "@/lib/utils"

interface UserProfileProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
}

export function UserProfile({ collapsed = false }: UserProfileProps) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return null
  }

  return (
    <div className={cn(
      "flex items-center transition-all",
      collapsed ? "justify-center" : "justify-between gap-2 px-2"
    )}>
      {!collapsed && user && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate">
            {user.firstName || user.username || "User"}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      )}
      
      <div id="clerk-user-button">
        <UserButton 
          afterSignOutUrl="/"
          userProfileProps={{
            additionalOAuthScopes: {
              google: [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
              ],
            },
          }}
          appearance={{
            elements: {
              avatarBox: collapsed ? "h-8 w-8" : "h-10 w-10",
              userButtonPopoverCard: "bg-card border-border",
              userButtonPopoverActions__manageAccount: "text-foreground hover:bg-accent",
              userButtonPopoverActions__signOut: "text-foreground hover:bg-accent",
              userButtonPopoverActionButton: "hover:bg-accent",
              userButtonPopoverActionButtonText: "text-foreground",
            },
          }}
        />
      </div>
    </div>
  )
}