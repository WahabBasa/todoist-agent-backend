import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { QuickTaskModal } from "../components/QuickTaskModal";
import { Plus, Inbox as InboxIcon } from "lucide-react";

export function InboxView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const inboxTasks = useQuery(api.tasks.getInboxTasks, { completed: false });
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

  if (inboxTasks === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <InboxIcon className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              {inboxTasks.length} {inboxTasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {inboxTasks.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <InboxIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Your inbox is empty
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                When you add a task, it'll show up here. Use the + button to get started.
              </p>
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first task
              </Button>
            </div>
          ) : (
            // Task List
            <div className="space-y-2">
              {inboxTasks.map((task) => (
                <Card key={task._id} className="p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.isCompleted}
                      onCheckedChange={() => handleToggleTask(task._id as string, task.isCompleted)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 
                          className={`font-medium ${
                            task.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(task.priority)}`}
                        >
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Added {formatDate(task._creationTime)}</span>
                        {task.dueDate && (
                          <span 
                            className={
                              task.dueDate < Date.now() && !task.isCompleted 
                                ? 'text-red-600' 
                                : ''
                            }
                          >
                            Due {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.estimatedTime && (
                          <span>
                            ⏱️ {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m
                          </span>
                        )}
                      </div>
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {task.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all p-0"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Quick Task Modal */}
      <QuickTaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}