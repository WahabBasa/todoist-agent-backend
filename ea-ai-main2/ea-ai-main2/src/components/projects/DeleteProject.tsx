import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, AlertTriangle, Folder, CheckSquare } from "lucide-react";
import { toast } from "sonner";

interface DeleteProjectProps {
  project: {
    _id: Id<"projects">;
    name: string;
    type?: "user" | "system";
    taskCount?: number;
    completedTaskCount?: number;
  };
  trigger?: React.ReactNode;
  onProjectDeleted?: () => void;
}

export function DeleteProject({ 
  project, 
  trigger, 
  onProjectDeleted 
}: DeleteProjectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get detailed project information including tasks
  const projectDetails = useQuery(api.projects.getProjectDetails, {
    projectId: project._id
  });
  
  const deleteProjectOnly = useMutation(api.projects.deleteProject);
  const deleteProjectAndTasks = useMutation(api.projects.deleteProjectAndTasks);

  const handleDeleteProject = async (includeTasksAndSubtasks: boolean = false) => {
    try {
      if (includeTasksAndSubtasks) {
        await deleteProjectAndTasks({ projectId: project._id });
        toast.success("Project and all tasks deleted successfully!");
      } else {
        await deleteProjectOnly({ id: project._id });
        toast.success("Project deleted successfully!");
      }

      setIsOpen(false);
      onProjectDeleted?.();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      if (error.message?.includes("Cannot delete project with existing tasks")) {
        toast.error("Cannot delete project with existing tasks. Delete tasks first or use 'Delete with tasks' option.");
      } else if (error.message?.includes("system")) {
        toast.error("Cannot delete system projects.");
      } else {
        toast.error("Failed to delete project");
      }
    }
  };

  const taskCount = projectDetails?.taskCount || project.taskCount || 0;
  const completedTaskCount = projectDetails?.completedTaskCount || project.completedTaskCount || 0;
  const activeTaskCount = taskCount - completedTaskCount;
  const isSystemProject = project.type === "system";

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isSystemProject}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete Project
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the project "{project.name}"? This action cannot be undone.
              </p>

              {isSystemProject && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">System Project</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    This is a system project and cannot be deleted.
                  </p>
                </div>
              )}

              {!isSystemProject && taskCount > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <Folder className="w-4 h-4" />
                    <span className="text-sm font-medium">Project Contains Tasks</span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-red-700">
                    <div className="flex items-center justify-between">
                      <span>Total Tasks:</span>
                      <Badge variant="outline" className="text-xs">
                        {taskCount}
                      </Badge>
                    </div>
                    
                    {activeTaskCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Active Tasks:</span>
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                          {activeTaskCount}
                        </Badge>
                      </div>
                    )}
                    
                    {completedTaskCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Completed Tasks:</span>
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                          <CheckSquare className="w-3 h-3 mr-1" />
                          {completedTaskCount}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                    <p className="font-medium">⚠️ Warning:</p>
                    <p>Deleting with tasks will permanently remove all tasks and their subtasks.</p>
                  </div>
                </div>
              )}

              {!isSystemProject && taskCount === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckSquare className="w-4 h-4" />
                    <span className="text-sm">This project is empty and safe to delete.</span>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isSystemProject && (
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            
            {taskCount === 0 ? (
              <AlertDialogAction
                onClick={() => handleDeleteProject(false)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Project
              </AlertDialogAction>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteProject(false)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete Project Only
                </Button>
                <AlertDialogAction
                  onClick={() => handleDeleteProject(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete with {taskCount} Tasks
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        )}

        {isSystemProject && (
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}