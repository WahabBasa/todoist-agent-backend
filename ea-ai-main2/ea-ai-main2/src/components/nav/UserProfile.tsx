import { useState } from "react"
import { UserButton } from "@clerk/clerk-react"
import { useUser } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { SettingsModal } from "../SettingsModal"

export function UserProfile() {
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return null
  }

  return (
    <div className="padding-secondary flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => setShowSettingsModal(true)}
        className="text-tertiary"
      >
        <Settings className="h-4 w-4" />
      </Button>
      
      <UserButton 
        afterSignOutUrl="/"
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
      
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  )
}