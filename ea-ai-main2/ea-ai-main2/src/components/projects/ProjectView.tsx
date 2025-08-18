import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { TodoList } from "../todos/TodoList";
import { AddTaskInline } from "../todos/AddTaskInline";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Plus, 
  Folder, 
  CheckCircle2, 
  Circle, 
  Calendar,
  BarChart3,
  Settings,
  Edit
} from "lucide-react";
import { AddProjectDialog } from "./AddProjectDialog";
import { DeleteProject } from "./DeleteProject";

interface ProjectViewProps {
  projectId: Id<"projects">;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<Id<"tasks"> | null>(null);

  const project = useQuery(api.projects.getProjectDetails, { projectId });
  
  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Folder className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-foreground/60">Loading project...</p>
        </div>
      </div>
    );
  }

  const completionPercentage = project.taskCount > 0 
    ? Math.round((project.completedTaskCount / project.taskCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: project.color || "#64748b" }}
              />
              <div>
                <h1 className="text-xl font-semibold">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-foreground/60 mt-1">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
            
            {/* Project Actions */}
            <div className="flex items-center gap-2">
              <AddProjectDialog 
                editProject={project}
                trigger={
                  <Button size="sm" variant="outline" className="gap-2">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                }
              />
              <DeleteProject project={project} />
            </div>
          </div>

          {/* Project Stats */}
          <div className="flex items-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-foreground/70">
                {project.taskCount - project.completedTaskCount} active
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-foreground/70">
                {project.completedTaskCount} completed
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-foreground/70">
                {completionPercentage}% complete
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {project.taskCount > 0 && (
            <div className="w-full bg-accent/20 rounded-full h-2 mt-3">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Project Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Tasks</h2>
          <Button 
            onClick={() => setIsAddingTask(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>

        {/* Add Task Form */}
        {isAddingTask && (
          <AddTaskInline
            isOpen={isAddingTask}
            onClose={() => setIsAddingTask(false)}
            defaultProjectId={projectId}
            onTaskCreated={() => setIsAddingTask(false)}
          />
        )}

        {/* Add Subtask Form */}
        {addingSubtaskFor && (
          <AddTaskInline
            isOpen={true}
            onClose={() => setAddingSubtaskFor(null)}
            parentTaskId={addingSubtaskFor}
            defaultProjectId={projectId}
            onTaskCreated={() => setAddingSubtaskFor(null)}
          />
        )}

        {/* Tasks Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Circle className="w-3 h-3" />
              Active
              <Badge variant="secondary" className="text-xs">
                {project.taskCount - project.completedTaskCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              Completed
              <Badge variant="secondary" className="text-xs">
                {project.completedTaskCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Folder className="w-3 h-3" />
              All
              <Badge variant="secondary" className="text-xs">
                {project.taskCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <TodoList
              projectId={projectId}
              showCompleted={false}
              groupBy="none"
              onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
            />
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <TodoList
              projectId={projectId}
              showCompleted={true}
              groupBy="none"
              onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
            />
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="space-y-6">
              {/* Active Tasks */}
              <div>
                <h3 className="text-sm font-medium text-foreground/70 mb-3 flex items-center gap-2">
                  <Circle className="w-3 h-3" />
                  Active Tasks
                </h3>
                <TodoList
                  projectId={projectId}
                  showCompleted={false}
                  groupBy="none"
                  onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
                />
              </div>

              {/* Completed Tasks */}
              {project.completedTaskCount > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground/70 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed Tasks
                  </h3>
                  <TodoList
                    projectId={projectId}
                    showCompleted={true}
                    groupBy="none"
                    onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Empty State */}
        {project.taskCount === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Folder className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground/80 mb-2">
                  No tasks in this project yet
                </h3>
                <p className="text-sm text-foreground/60 mb-6">
                  Create your first task to get started on this project.
                </p>
                <Button 
                  onClick={() => setIsAddingTask(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create First Task
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}