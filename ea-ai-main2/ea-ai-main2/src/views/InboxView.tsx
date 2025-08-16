import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton } from "../components/ui/skeleton";
import { QuickTaskModal } from "../components/QuickTaskModal";
import { Plus, Inbox as InboxIcon, Calendar, Clock } from "lucide-react";

export function InboxView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  
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
      className="flex items-center space-x-3 p-2.5 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors duration-200"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => handleToggleTask(task._id as string, isCompleted)}
        className="w-4 h-4 rounded-md"
      />
      
      <div className="flex flex-col items-start flex-1">
        <div className="flex items-center gap-2 w-full">
          <h3 
            className={`text-sm font-medium ${
              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          {task.priority && task.priority !== 3 && (
            <Badge 
              variant={getPriorityVariant(task.priority)}
              className="text-xs"
            >
              {getPriorityLabel(task.priority)}
            </Badge>
          )}
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/70">
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
                <span key={index} className="text-xs">
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
      className="flex items-center gap-2 p-2.5 text-left w-full hover:bg-muted/30 transition-colors duration-200 rounded-md border border-dashed border-muted-foreground/30 mt-2"
      onClick={() => setShowAddTask(true)}
    >
      <Plus className="h-4 w-4 text-muted-foreground/70" />
      <span className="text-sm text-muted-foreground/70">
        Add task
      </span>
    </button>
  );

  return (
    <div className="h-full py-4">
      <div className="max-w-3xl mx-auto space-y-4 px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
        </div>

        {/* Incomplete Tasks */}
        <div className="space-y-1">
        {inboxTasks.length === 0 && !showAddTask ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted/40 rounded-xl flex items-center justify-center mb-4">
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
              className="text-sm"
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

        {/* Completed Tasks */}
        {completedTasks && completedTasks.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-medium text-muted-foreground/80">
                Completed ({completedTasks.length})
              </h2>
            </div>
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <TaskItem key={task._id} task={task} isCompleted={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}