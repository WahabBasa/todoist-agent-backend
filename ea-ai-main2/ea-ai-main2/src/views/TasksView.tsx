import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { TodoList } from "../components/todos/TodoList";
import { AddTaskInline } from "../components/todos/AddTaskInline";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock,
  AlertCircle,
  Calendar,
  Filter,
  SortAsc,
  BarChart3
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function TasksView() {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<Id<"tasks"> | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("priority");
  const [groupBy, setGroupBy] = useState<"none" | "project" | "date" | "priority">("none");
  
  const stats = useQuery(api.tasks.getTaskStats);
  const projects = useQuery(api.projects.getProjects);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Tasks</h1>
          <p className="text-sm text-foreground/60">Manage and organize your tasks</p>
        </div>
        <Button onClick={() => setIsAddingTask(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* Task Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-foreground/60">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-foreground/60">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-foreground/60">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-xs text-foreground/60">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.recurring}</p>
                  <p className="text-xs text-foreground/60">Recurring</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Task Form */}
      {isAddingTask && (
        <AddTaskInline
          isOpen={isAddingTask}
          onClose={() => setIsAddingTask(false)}
          onTaskCreated={() => setIsAddingTask(false)}
        />
      )}

      {/* Add Subtask Form */}
      {addingSubtaskFor && (
        <AddTaskInline
          isOpen={true}
          onClose={() => setAddingSubtaskFor(null)}
          parentTaskId={addingSubtaskFor}
          onTaskCreated={() => setAddingSubtaskFor(null)}
        />
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Project Filter */}
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-2 block">Project</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    <div className="flex items-center gap-2">
                      {project.color && (
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                      )}
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-2 block">Priority</label>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="1">High Priority</SelectItem>
                <SelectItem value="2">Medium Priority</SelectItem>
                <SelectItem value="3">Normal Priority</SelectItem>
                <SelectItem value="4">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-2 block">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="createdAt">Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Group By */}
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-2 block">Group By</label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="date">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Circle className="w-3 h-3" />
            Active
            {stats && (
              <Badge variant="secondary" className="text-xs">
                {stats.active}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Today
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Overdue
            {stats && stats.overdue > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" />
            Completed
            {stats && (
              <Badge variant="secondary" className="text-xs">
                {stats.completed}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <TodoList
            showCompleted={false}
            groupBy={groupBy}
            onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
          />
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          <TodoList
            filter="today"
            showCompleted={false}
            groupBy={groupBy}
            onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
          />
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <TodoList
            filter="overdue"
            showCompleted={false}
            groupBy={groupBy}
            onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <TodoList
            showCompleted={true}
            groupBy={groupBy}
            onAddSubtask={(taskId) => setAddingSubtaskFor(taskId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}