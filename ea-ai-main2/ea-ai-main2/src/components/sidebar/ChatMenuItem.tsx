import { useState } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"

import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"

interface ChatSession {
  _id: Id<"chatSessions">
  userId: Id<"users">
  title: string
  createdAt: number
  lastMessageAt: number
  messageCount: number
  isDefault?: boolean
}

interface ChatMenuItemProps {
  chat: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

export function ChatMenuItem({ chat, isActive, onSelect, onDelete }: ChatMenuItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleDelete = () => {
    setShowDeleteDialog(false)
    onDelete()
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center gap-tertiary rounded-design-md p-1.5 cursor-pointer hover:bg-muted/50",
          "transition-all duration-200 mb-0", // Use design system transition and add margin bottom
          isActive && "bg-muted"
        )}
        onClick={onSelect}
      >
        {/* Chat content */}
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium font-sans text-muted-foreground truncate">
            {chat.title}
          </div>
        </div>

        {/* Menu button - only show on hover or when active */}
        <div className={cn(
          "flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          isActive && "opacity-100"
        )}>
          {!chat.isDefault && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-utility hover:text-secondary rounded-design-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-design-md">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive text-tertiary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteDialog(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{chat.title}"? This action cannot be undone and will permanently remove all messages in this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}