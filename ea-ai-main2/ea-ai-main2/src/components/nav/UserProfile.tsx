import { UserButton } from "@clerk/clerk-react"
import { useUser } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

interface UserProfileProps {
  onOpenSettings?: () => void;
}

export function UserProfile({ onOpenSettings }: UserProfileProps) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return null
  }

  return (
    <div className="padding-secondary flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={onOpenSettings}
        className="text-tertiary"
      >
        <Settings className="h-4 w-4" />
      </Button>
      
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
              avatarBox: "h-8 w-8",
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