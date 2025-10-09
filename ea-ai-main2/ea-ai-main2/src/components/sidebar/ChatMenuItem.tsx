import { useState, useEffect } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"

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
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"

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
  isDeleting?: boolean
  // New: clear messages for this chat (used when default/only session)
  onClear?: () => void
  // New: whether deletion is allowed (e.g., not default and not only session)
  canDelete?: boolean
}

export function ChatMenuItem({ chat, isActive, onSelect, onDelete, isDeleting, onClear, canDelete = !chat.isDefault }: ChatMenuItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const updateSession = useMutation(api.chatSessions.updateChatSession)
  const [isEditing, setIsEditing] = useState(false)
  const [tempTitle, setTempTitle] = useState(chat.title)
  const [pointerType, setPointerType] = useState<"mouse" | "touch" | "pen" | null>(null)

  // Keep local tempTitle in sync with server title when not editing
  useEffect(() => {
    if (!isEditing) {
      setTempTitle(chat.title)
    }
  }, [chat.title, isEditing])

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

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTempTitle(chat.title)
    setIsEditing(true)
  }

  const commitRename = async () => {
    const next = tempTitle.trim().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ')
    setIsEditing(false)
    if (!next || next === chat.title) return
    try {
      await updateSession({ sessionId: chat._id, title: next })
    } catch (e) {
      // Revert local edit on failure
      setTempTitle(chat.title)
    }
  }

  return (
    <>
      <SidebarMenuItem asChild>
        <motion.li
          initial={{ opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100, transition: { duration: 0.3, ease: "easeInOut" } }}
          layout
          className="relative"
          onPointerDown={(event) => {
            setPointerType(event.pointerType as "mouse" | "touch" | "pen")
          }}
        >
          <SidebarMenuButton isActive={isActive || isEditing} attention="secondary" size="default" asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 p-2"
              onClick={(e) => {
                if (!isDeleting && !isEditing) onSelect();
              }}
            >
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    className="h-6 w-full bg-transparent outline-none text-[0.92rem] font-medium text-muted-foreground"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsEditing(false);
                        setTempTitle(chat.title);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  // Always display the latest server title when not editing
                  <div className="text-[0.92rem] font-medium font-sans truncate">{chat.title}</div>
                )}
              </div>
            </button>
          </SidebarMenuButton>

          <DropdownMenu>
            <SidebarMenuAction asChild showOnHover>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-utility hover:text-secondary rounded-design-sm"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Chat options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </SidebarMenuAction>
            <DropdownMenuContent align="end" className="w-48 rounded-design-md">
              <DropdownMenuItem className="text-tertiary" onClick={handleRenameStart}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-tertiary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClear) onClear();
                }}
              >
                Clear messages
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive text-tertiary"
                disabled={!canDelete}
                onClick={(e) => {
                  if (!canDelete) return;
                  e.stopPropagation();
                  setShowDeleteDialog(true)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {canDelete ? 'Delete chat' : 'Delete chat (disabled)'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.li>
      </SidebarMenuItem>

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
