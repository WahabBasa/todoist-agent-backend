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
      className="flex items-center space-x-3 p-system-3 rounded-lg theme-bg-ultra-light backdrop-blur-sm border theme-border-light shadow-sm hover:shadow-md theme-hover transition-all duration-200"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => handleToggleTask(task._id as string, isCompleted)}
        className="w-5 h-5 rounded-md checkbox-primary-blue border-2 border-gray-400 hover:border-gray-500"
      />
      
      <div className="flex flex-col items-start flex-1">
        <div className="flex items-center gap-2 w-full">
          <h3 
            className={`text-system-base font-system-medium ${
              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          {task.priority && task.priority !== 3 && (
            <Badge 
              variant={getPriorityVariant(task.priority)}
              className="text-system-xs font-system-medium"
            >
              {getPriorityLabel(task.priority)}
            </Badge>
          )}
        </div>
        
        {task.description && (
          <p className="text-system-sm text-foreground/85 mt-0.5">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-system-3 mt-1.5 text-system-xs text-foreground/75">
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span 
                className={
                  task.dueDate < Date.now() && !isCompleted 
                    ? 'text-red-600' 
                    : ''
                }
              >
                {formatDate(task.dueDate)}
              </span>
            </div>
          )}
          {task.estimatedTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m
              </span>
            </div>
          )}
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.map((tag, index) => (
                <span key={index} className="text-xs text-foreground/70">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const AddTaskButton = () => (
    <button 
      className="flex items-center gap-2 p-3 text-left w-full theme-bg-extra-light border border-dashed theme-border-light theme-hover transition-all duration-200 rounded-lg mt-2"
      onClick={() => setShowAddTask(true)}
    >
      <Plus className="h-4 w-4 text-muted-foreground/70" />
      <span className="text-sm text-muted-foreground/70">
        Add task
      </span>
    </button>
  );

  return (
    <div className="h-screen theme-bg-light">
      <div className="max-w-system-content mx-auto space-y-4 px-system-8 pt-system-16 pb-system-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-system-xl font-system-semibold text-foreground">Inbox</h1>
        </div>

        {/* Incomplete Tasks */}
        <div className="space-y-2">
        {inboxTasks.length === 0 && !showAddTask ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 theme-bg-extra-light border theme-border-light rounded-xl flex items-center justify-center mb-4">
              <InboxIcon className="h-6 w-6 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Your inbox is empty
            </h3>
            <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm">
              When you add a task, it'll show up here.
            </p>
            <Button 
              onClick={() => setShowAddTask(true)}
              size="sm"
              className="text-sm btn-primary-blue"
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