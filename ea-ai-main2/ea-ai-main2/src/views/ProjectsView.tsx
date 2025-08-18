import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ProjectView } from "../components/projects/ProjectView";
import { AddProjectDialog } from "../components/projects/AddProjectDialog";
import { DeleteProject } from "../components/projects/DeleteProject";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Input } from "../components/ui/input";
import { 
  Folder, 
  Plus, 
  Search,
  CheckCircle2,
  Circle,
  MoreVertical,
  Edit,
  Star
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export function ProjectsView() {
  const [selectedProject, setSelectedProject] = useState<Id<"projects"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const projects = useQuery(api.projects.getProjects);

  // Filter projects based on search
  const filteredProjects = projects?.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate system and user projects
  const systemProjects = filteredProjects?.filter(p => p.type === "system") || [];
  const userProjects = filteredProjects?.filter(p => p.type === "user") || [];

  if (selectedProject) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedProject(null)}
          className="gap-2"
        >
          ← Back to Projects
        </Button>
        <ProjectView projectId={selectedProject} />
      </div>
    );
  }

  if (projects === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-foreground/60">Organize your tasks into projects</p>
        </div>
        <AddProjectDialog
          trigger={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          }
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40 w-4 h-4" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* System Projects */}
      {systemProjects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="text-lg font-medium">System Projects</h2>
            <Badge variant="secondary" className="text-xs">
              {systemProjects.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemProjects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onSelect={setSelectedProject}
              />
            ))}
          </div>
        </div>
      )}

      {/* User Projects */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Folder className="w-4 h-4" />
          <h2 className="text-lg font-medium">Your Projects</h2>
          <Badge variant="secondary" className="text-xs">
            {userProjects.length}
          </Badge>
        </div>

        {userProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userProjects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onSelect={setSelectedProject}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Folder className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground/80 mb-2">
                  No projects yet
                </h3>
                <p className="text-sm text-foreground/60 mb-6">
                  Create your first project to organize your tasks.
                </p>
                <AddProjectDialog
                  trigger={
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Create First Project
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Stats */}
      {(systemProjects.length > 0 || userProjects.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-foreground/60">Total Projects</div>
              <div className="text-2xl font-bold text-accent">
                {systemProjects.length + userProjects.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-foreground/60">Total Tasks</div>
              <div className="text-2xl font-bold text-blue-500">
                {[...systemProjects, ...userProjects].reduce((total, p) => total + (p.taskCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-foreground/60">Completed Tasks</div>
              <div className="text-2xl font-bold text-green-500">
                {[...systemProjects, ...userProjects].reduce((total, p) => total + (p.completedTaskCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: any;
  onSelect: (id: Id<"projects">) => void;
  showActions?: boolean;
}

function ProjectCard({ project, onSelect, showActions = false }: ProjectCardProps) {
  const completionPercentage = project.taskCount > 0 
    ? Math.round((project.completedTaskCount / project.taskCount) * 100)
    : 0;

  const activeTaskCount = project.taskCount - project.completedTaskCount;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div 
            className="flex items-center gap-3 flex-1 min-w-0"
            onClick={() => onSelect(project._id)}
          >
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color || "#64748b" }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-foreground/60 truncate mt-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          
          {showActions && project.type !== "system" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <AddProjectDialog 
                    editProject={project}
                    trigger={
                      <div className="flex items-center gap-2 w-full">
                        <Edit className="w-4 h-4" />
                        Edit Project
                      </div>
                    }
                  />
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <DeleteProject project={project} />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent 
        className="space-y-3"
        onClick={() => onSelect(project._id)}
      >
        {/* Task Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-orange-500" />
            <span className="text-foreground/70">
              {activeTaskCount} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-foreground/70">
              {project.completedTaskCount} done
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {project.taskCount > 0 ? (
          <div className="space-y-2">
            <Progress value={completionPercentage} className="h-2" />
            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span>{completionPercentage}% complete</span>
              <span>{project.taskCount} total tasks</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-foreground/50">No tasks yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}