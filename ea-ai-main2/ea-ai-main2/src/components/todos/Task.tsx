import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Calendar, Clock, Tag, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Type guard to differentiate between tasks and subtasks
function isSubTodo(
  data: any
): boolean {
  return "parentId" in data && data.parentId != null;
}

interface TaskProps {
  data: any; // Task or SubTodo
  showDetails?: boolean;
  showSubtasks?: boolean;
  subtasks?: any[];
  onToggleSubtasks?: () => void;
  onAddSubtask?: () => void;
}

export function Task({ 
  data, 
  showDetails = false, 
  showSubtasks = false,
  subtasks = [],
  onToggleSubtasks,
  onAddSubtask
}: TaskProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get the task name - support both TaskVex (taskName) and current system (title)
  const taskName = data.taskName || data.title;
  const dueDate = data.dueDate;
  const priority = data.priority;
  const isCompleted = data.isCompleted;
  
  // Use appropriate mutations based on task type
  const checkTask = useMutation(isSubTodo(data) ? api.subTodos.checkSubTodo : api.tasks.checkATodo);
  const uncheckTask = useMutation(isSubTodo(data) ? api.subTodos.uncheckSubTodo : api.tasks.uncheckATodo);
  
  const handleToggleComplete = async () => {
    try {
      if (isCompleted) {
        await uncheckTask({ 
          [isSubTodo(data) ? 'subTodoId' : 'taskId']: data._id 
        });
        toast.success("Task marked as incomplete");
      } else {
        await checkTask({ 
          [isSubTodo(data) ? 'subTodoId' : 'taskId']: data._id 
        });
        toast.success("Task completed!");
      }
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const formatDueDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString();
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800 border-red-200";
      case 2: return "bg-orange-100 text-orange-800 border-orange-200";
      case 3: return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 4: return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
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

  return (
    <div className="group">
      <Card className="p-3 hover:shadow-sm transition-shadow border-l-4 border-l-accent/20 hover:border-l-accent/40">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-0.5">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleToggleComplete}
              className="w-4 h-4 rounded-full border-2"
            />
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            {/* Task Title and Expand Button */}
            <div className="flex items-center gap-2 mb-1">
              {!isSubTodo(data) && subtasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsExpanded(!isExpanded);
                    onToggleSubtasks?.();
                  }}
                  className="w-4 h-4 p-0 hover:bg-accent/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              )}
              <h3 
                className={`text-sm font-medium truncate ${
                  isCompleted ? 'line-through text-foreground/50' : 'text-foreground'
                }`}
              >
                {taskName}
              </h3>
            </div>

            {/* Task Details */}
            {(showDetails || data.description) && (
              <p className="text-xs text-foreground/70 mb-2 line-clamp-2">
                {data.description}
              </p>
            )}

            {/* Task Metadata */}
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              {dueDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDueDate(dueDate)}</span>
                </div>
              )}
              
              {priority && priority !== 3 && (
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1.5 py-0.5 ${getPriorityColor(priority)}`}
                >
                  {getPriorityLabel(priority)}
                </Badge>
              )}
              
              {data.estimatedTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{data.estimatedTime}m</span>
                </div>
              )}

              {data.tags && data.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>{data.tags[0]}</span>
                  {data.tags.length > 1 && (
                    <span className="text-foreground/40">+{data.tags.length - 1}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions (for main tasks only) */}
          {!isSubTodo(data) && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddSubtask}
                className="w-6 h-6 p-0 hover:bg-accent/50"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Subtasks */}
        {!isSubTodo(data) && isExpanded && subtasks.length > 0 && (
          <div className="mt-3 ml-7 space-y-2">
            {subtasks.map((subtask) => (
              <Task
                key={subtask._id}
                data={subtask}
                showDetails={false}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}