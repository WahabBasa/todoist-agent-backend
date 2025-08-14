import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ChevronDown, Settings, LogOut, Bell } from "lucide-react"
import { useAuthActions } from "@convex-dev/auth/react"

interface UserProfileProps {
  userName?: string
}

export function UserProfile({ userName = "Abdul" }: UserProfileProps) {
  const { signOut } = useAuthActions()

  return (
    <div className="flex items-center justify-between p-3 border-b border-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-auto p-2 group-data-[collapsible=icon]:hidden">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-500 text-white text-sm">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{userName}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Collapsed state - show only avatar */}
      <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-500 text-white text-sm">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      
      <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
        <SidebarTrigger className="h-8 w-8" />
      </div>
      
      {/* Collapsed trigger */}
      <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-3 group-data-[collapsible=icon]:right-2">
        <SidebarTrigger className="h-8 w-8" />
      </div>
    </div>
  )
}