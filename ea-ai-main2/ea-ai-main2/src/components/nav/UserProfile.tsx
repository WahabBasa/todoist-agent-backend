"use client";

import { useUser, useClerk } from "@clerk/clerk-react"
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { User, Settings, LogOut } from "lucide-react"

interface UserProfileProps {
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  collapsed?: boolean;
  isAdmin?: boolean;
}

export function UserProfile({ collapsed = false, onOpenSettings, onOpenAdmin, isAdmin = false }: UserProfileProps) {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()

  if (!isLoaded) {
    return null
  }

  if (!user) {
    return null
  }

  const handleSignOut = () => {
    try {
      localStorage.removeItem('taskai_current_session_id');
    } catch {}
    void signOut({ redirectUrl: '/' })
  }

  const userInitials = user.firstName && user.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user.firstName 
      ? user.firstName[0].toUpperCase()
      : user.username 
        ? user.username[0].toUpperCase()
        : "U"

  return (
    <div className={cn(
      "flex items-center transition-all",
      collapsed ? "justify-center" : "justify-between gap-2 px-1"
    )}>
      {!collapsed && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-sans font-medium text-foreground truncate">
            {user.firstName || user.username || "User"}
          </span>
          <span className="text-xs font-sans text-muted-foreground truncate">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-10 p-0 rounded-full">
            <Avatar className={cn("h-8 w-8")}>
              <AvatarImage src={user.imageUrl} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="min-w-[200px]" 
          align={collapsed ? "start" : "end"}
          side={collapsed ? "right" : "top"}
          sideOffset={8}
        >
          <div className="px-2 py-1.5">
            <p className="text-sm font-sans font-medium text-foreground">
              {user.firstName || user.username || "User"}
            </p>
            <p className="text-xs font-sans text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpenSettings?.()}>
            <Settings className="mr-2 h-4 w-4" />
            <span className="font-sans">Settings</span>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => onOpenAdmin?.()}>
              <User className="mr-2 h-4 w-4" />
              <span className="font-sans">Admin Dashboard</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="font-sans">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}