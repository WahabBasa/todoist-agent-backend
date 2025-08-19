import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from "../ui/button"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"

interface ClearHistoryActionProps {
  onClearAll: () => void
  empty: boolean
}

export function ClearHistoryAction({ onClearAll, empty }: ClearHistoryActionProps) {
  const [showClearDialog, setShowClearDialog] = useState(false)

  const handleClear = () => {
    setShowClearDialog(false)
    onClearAll()
  }

  if (empty) {
    return null
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-design-sm"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-utility">
            Clear all chats
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-design-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-secondary">Clear All Chat History</AlertDialogTitle>
            <AlertDialogDescription className="text-tertiary">
              Are you sure you want to clear all chat history? This action cannot be undone and will permanently remove all your conversations except the default chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-secondary">
            <AlertDialogCancel className="text-tertiary rounded-design-md">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-tertiary rounded-design-md"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}