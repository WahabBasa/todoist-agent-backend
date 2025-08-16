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
      case 1: return "text-red-600 bg-red-50 border-red-200";
      case 2: return "text-orange-600 bg-orange-50 border-orange-200";
      case 3: return "text-blue-600 bg-blue-50 border-blue-200";
      case 4: return "text-green-600 bg-green-50 border-green-200";
      default: return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-gray-200 shadow-sm">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-lg font-medium">Quick Add Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Input
              placeholder="Task name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="border-gray-200 text-sm font-medium focus:border-gray-300 focus:ring-0"
            />
          </div>
          
          <div className="space-y-2">
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none border-gray-200 text-xs focus:border-gray-300 focus:ring-0"
            />
          </div>
          
          <div className="space-y-2">
            <Select value={priority.toString()} onValueChange={(value) => setPriority(Number(value))}>
              <SelectTrigger className="border-gray-200 focus:border-gray-300 focus:ring-0">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs border-gray-200 ${getPriorityColor(priority)}`}
                    >
                      {getPriorityLabel(priority)}
                    </Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-gray-200">
                <SelectItem value="1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-red-600 bg-red-50 border-red-200">
                      High
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-orange-600 bg-orange-50 border-orange-200">
                      Medium
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 border-blue-200">
                      Normal
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-green-600 bg-green-50 border-green-200">
                      Low
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              className="flex-1 border-gray-200 text-foreground/70 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
              className="flex-1 bg-primary hover:bg-primary/90 text-white border-0"
            >
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}