import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { QuickTaskModal } from "../components/QuickTaskModal";
import { Plus, Inbox as InboxIcon, Calendar, Clock, Save, X } from "lucide-react";

export function InboxView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  const inboxTasks = useQuery(api.tasks.getInboxTasks, { completed: false });
  const completedTasks = useQuery(api.tasks.getInboxTasks, { completed: true });
  const updateTask = useMutation(api.tasks.updateTask);

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    try {
      await updateTask({
        id: taskId as any,
        isCompleted: !isCompleted,
      });
      toast.success(isCompleted ? "Task marked as active" : "Task completed!");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleTaskClick = (task: any, isCompleted: boolean) => {
    if (isCompleted) return; // Don't expand completed tasks
    
    if (expandedTaskId === task._id) {
      // Collapse if already expanded
      setExpandedTaskId(null);
      setEditingTask(null);
    } else {
      // Expand and set editing state
      setExpandedTaskId(task._id);
      setEditingTask({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        tags: task.tags ? task.tags.join(', ') : ''
      });
    }
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;
    
    try {
      await updateTask({
        id: editingTask._id as any,
        title: editingTask.title,
        description: editingTask.description || undefined,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).getTime() : undefined,
        estimatedTime: editingTask.estimatedTime || undefined,
        tags: editingTask.tags ? editingTask.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : undefined
      });
      
      toast.success("Task updated!");
      setExpandedTaskId(null);
      setEditingTask(null);
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleCancelEdit = () => {
    setExpandedTaskId(null);
    setEditingTask(null);
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

  const getPriorityVariant = (priority: number) => {
    switch (priority) {
      case 1: return "outline" as const; // High priority - subtle red outline
      case 2: return "secondary" as const; // Medium priority - muted
      case 3: return "secondary" as const; // Normal priority - muted
      case 4: return "secondary" as const; // Low priority - muted
      default: return "secondary" as const;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (inboxTasks === undefined || completedTasks === undefined) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 px-8">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const TaskItem = ({ task, isCompleted }: { task: any; isCompleted: boolean }) => (
    <div
      key={task._id}
      className="group flex items-start gap-3 py-1.5 px-2 hover:bg-accent/50 transition-colors duration-150 border-l-2 border-transparent hover:border-l-primary border-b border-border"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => handleToggleTask(task._id as string, isCompleted)}
        className="mt-0.5 w-4 h-4 rounded-sm border border-input hover:border-ring"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 
            className={`text-sm font-medium truncate ${
              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          
          {/* Compact priority indicator */}
          {task.priority && task.priority !== 3 && (
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              task.priority === 1 ? 'bg-red-400' : 
              task.priority === 2 ? 'bg-orange-400' : 'bg-blue-400'
            }`} />
          )}
        </div>
        
        {/* Description on same line if short, or below if longer */}
        {task.description && (
          <p className="text-meta mt-0.5 truncate">
            {task.description}
          </p>
        )}
        
        {/* Compact metadata - only show on hover or if has due date */}
        {(task.dueDate || task.estimatedTime || (task.tags && task.tags.length > 0)) && (
          <div className="flex items-center gap-2 mt-1 text-meta">
            {task.dueDate && (
              <span 
                className={`flex items-center gap-1 ${
                  task.dueDate < Date.now() && !isCompleted 
                    ? 'text-destructive font-medium' 
                    : ''
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m
              </span>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="flex gap-1">
                {task.tags.slice(0, 2).map((tag, index) => (
                  <span key={index} className="text-meta">
                    #{tag}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="text-meta">+{task.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const AddTaskButton = () => (
    <div className="flex items-center gap-3 py-1.5 px-2 hover:bg-accent/50 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground border-l-2 border-transparent border-b border-border"
      onClick={() => setShowAddTask(true)}
    >
      <div className="w-4 h-4 flex items-center justify-center">
        <Plus className="h-3 w-3" />
      </div>
      <span className="text-sm font-medium">Add task</span>
    </div>
  );

  return (
    <div className="h-screen bg-background">
      <div className="max-w-3xl mx-auto space-y-4 px-8 pt-16 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
        </div>

        {/* Incomplete Tasks */}
        <div className="space-y-0 bg-card rounded-lg border border-border overflow-hidden">
        {inboxTasks.length === 0 && !showAddTask ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center mb-4">
              <InboxIcon className="h-6 w-6 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Your inbox is empty
            </h3>
            <p className="text-secondary-content mb-6 max-w-sm">
              When you add a task, it'll show up here.
            </p>
            <Button 
              onClick={() => setShowAddTask(true)}
              size="sm"
              className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add your first task
            </Button>
          </div>
        ) : (
          <>
            {inboxTasks.map((task) => (
              <TaskItem key={task._id} task={task} isCompleted={false} />
            ))}
          </>
        )}
        
        {/* Add Task Section */}
        {showAddTask ? (
          <QuickTaskModal 
            isOpen={true}
            onClose={() => setShowAddTask(false)}
          />
        ) : (
          inboxTasks.length > 0 && <AddTaskButton />
        )}
        </div>

      </div>
    </div>
  );
}