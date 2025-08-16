import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
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

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "text-red-600 bg-red-50 border-red-200";
      case 2: return "text-orange-600 bg-orange-50 border-orange-200";
      case 3: return "text-blue-600 bg-blue-50 border-blue-200";
      case 4: return "text-green-600 bg-green-50 border-green-200";
      default: return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (inboxTasks === undefined || completedTasks === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  const TaskItem = ({ task, isCompleted }: { task: any; isCompleted: boolean }) => (
    <div
      key={task._id}
      className="flex items-center space-x-3 border-b border-gray-100 p-3 animate-in fade-in hover:bg-gray-50/50 transition-colors"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => handleToggleTask(task._id as string, isCompleted)}
        className="w-5 h-5 rounded-xl"
      />
      
      <div className="flex flex-col items-start flex-1">
        <div className="flex items-center gap-2 w-full">
          <h3 
            className={`text-sm font-medium ${
              isCompleted ? 'line-through text-foreground/30' : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          {task.priority && task.priority !== 3 && (
            <Badge 
              variant="outline" 
              className={`text-xs ${getPriorityColor(task.priority)}`}
            >
              {getPriorityLabel(task.priority)}
            </Badge>
          )}
        </div>
        
        {task.description && (
          <p className="text-xs text-foreground/70 mt-1">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-2 text-xs text-foreground/70">
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
      className="flex items-center gap-2 p-3 text-left w-full hover:bg-gray-50/50 transition-colors border-b border-gray-100"
      onClick={() => setShowAddTask(true)}
    >
      <Plus className="h-4 w-4 text-primary hover:bg-primary hover:rounded-xl hover:text-white transition-colors" />
      <span className="text-sm font-light text-foreground/70">
        Add task
      </span>
    </button>
  );

  return (
    <div className="xl:px-40">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Inbox</h1>
      </div>

      {/* Incomplete Tasks */}
      <div className="flex flex-col gap-0">
        {inboxTasks.length === 0 && !showAddTask ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <InboxIcon className="h-8 w-8 text-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Your inbox is empty
            </h3>
            <p className="text-foreground/70 mb-6 max-w-sm">
              When you add a task, it'll show up here.
            </p>
            <Button 
              onClick={() => setShowAddTask(true)}
              variant="outline"
              className="border-gray-200 hover:bg-gray-50"
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
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4 p-3">
            <h2 className="text-sm font-medium text-foreground/70">
              Completed ({completedTasks.length})
            </h2>
          </div>
          <div className="flex flex-col gap-0">
            {completedTasks.map((task) => (
              <TaskItem key={task._id} task={task} isCompleted={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}