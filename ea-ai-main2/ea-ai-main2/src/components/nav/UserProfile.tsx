import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronDown, Settings, LogOut } from "lucide-react"
import { useAuthActions } from "@convex-dev/auth/react"
import { SettingsModal } from "../SettingsModal"

interface UserProfileProps {
  userName?: string
}

export function UserProfile({ userName = "Abdul" }: UserProfileProps) {
  const { signOut } = useAuthActions()
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  return (
    <div className="padding-secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" attention="secondary" className="flex items-center h-auto w-full justify-start group-data-[collapsible=icon]:justify-center min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="account-blue text-white text-sm">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-secondary min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="text-secondary font-medium truncate">{userName}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setShowSettingsModal(true)} className="text-tertiary gap-tertiary padding-tertiary">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="text-tertiary gap-tertiary padding-tertiary">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  )
}