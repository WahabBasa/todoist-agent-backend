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
      "flex items-center transition-all w-full",
      collapsed ? "justify-center px-0" : "justify-between gap-3 px-2"
    )}>
      {!collapsed && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate">
            {user.firstName || user.username || "User"}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn(
            "rounded-full transition-all shrink-0",
            collapsed ? "h-[35px] w-[35px] p-0" : "h-[43px] w-[43px] p-0"
          )}>
            <Avatar className={cn(collapsed ? "h-[26px] w-[26px]" : "h-[35px] w-[35px]")}>
              <AvatarImage src={user.imageUrl} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
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