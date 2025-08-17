import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickTaskModal({ isOpen, onClose }: QuickTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTask = useMutation(api.tasks.createTask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      });
      
      toast.success("Task added to inbox!");
      
      // Reset form and close modal
      setTitle("");
      setDescription("");
      setPriority(3);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority(3);
    onClose();
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "High";
      case 2: return "Medium";
      case 3: return "Normal";
      case 4: return "Low";
      default: return "Normal";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "priority-blue font-semibold"; // High priority - bold blue
      case 2: return "priority-blue"; // Medium priority - blue
      case 3: return "priority-blue"; // Normal priority - blue
      case 4: return "priority-blue opacity-70"; // Low priority - muted blue
      default: return "priority-blue";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg border border-gray-200 shadow-lg bg-white">
        <DialogHeader className="border-b border-gray-200 pb-3 sm:pb-4">
          <DialogTitle className="text-lg font-medium text-main">Quick Add Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 pt-2">
          <div className="space-y-2">
            <Input
              placeholder="Task name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="border-border text-base text-primary font-medium focus:border-ring/50 focus:ring-ring/20"
            />
          </div>
          
          <div className="space-y-2">
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none border-border text-base text-secondary focus:border-gray-300 focus:ring-0"
            />
          </div>
          
          <div className="space-y-2">
            <Select value={priority.toString()} onValueChange={(value) => setPriority(Number(value))}>
              <SelectTrigger className="border-border focus:border-gray-300 focus:ring-0">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="text-sm border-border text-secondary"
                    >
                      {getPriorityLabel(priority)}
                    </Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-border">
                <SelectItem value="1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm text-primary font-semibold">
                      High
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm text-main">
                      Medium
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm text-main">
                      Normal
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm text-tertiary">
                      Low
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              className="flex-1 border-border text-secondary hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
              className="flex-1 btn-primary-blue border-0"
            >
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}