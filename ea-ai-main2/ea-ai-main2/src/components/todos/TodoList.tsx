import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Task } from "./Task";
import { Skeleton } from "../ui/skeleton";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";

interface TodoListProps {
  projectId?: Id<"projects">;
  showCompleted?: boolean;
  filter?: "all" | "today" | "overdue" | "upcoming";
  groupBy?: "none" | "project" | "date" | "priority";
  showAddForm?: boolean;
  onAddSubtask?: (parentTaskId: Id<"tasks">) => void;
}

export function TodoList({ 
  projectId, 
  showCompleted = false, 
  filter = "all",
  groupBy = "none",
  showAddForm = false,
  onAddSubtask
}: TodoListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<Id<"tasks">>>(new Set());

  // Dynamic query selection based on filter
  const allTasks = useQuery(
    filter === "all" && !projectId ? api.tasks.getTasks : null,
    { completed: showCompleted }
  );
  
  const projectTasks = useQuery(
    projectId ? api.tasks.getTodosByProjectId : null,
    projectId ? { projectId } : "skip"
  );
  
  const todayTasks = useQuery(
    filter === "today" ? api.tasks.todayTodos : null
  );
  
  const overdueTasks = useQuery(
    filter === "overdue" ? api.tasks.overdueTodos : null
  );
  
  const upcomingTasks = useQuery(
    filter === "upcoming" ? api.tasks.getUpcomingTasks : null,
    filter === "upcoming" ? { days: 7 } : "skip"
  );

  // Get subtasks for expanded tasks
  const subtasksQueries = Array.from(expandedTasks).map(taskId => 
    useQuery(api.subTodos.getSubTodosByParentId, { parentId: taskId })
  );

  // Determine which tasks to display
  let tasks: any[] = [];
  if (projectId && projectTasks) {
    tasks = projectTasks;
  } else if (filter === "today" && todayTasks) {
    tasks = todayTasks;
  } else if (filter === "overdue" && overdueTasks) {
    tasks = overdueTasks;
  } else if (filter === "upcoming" && upcomingTasks) {
    tasks = upcomingTasks;
  } else if (allTasks) {
    tasks = allTasks;
  }

  // Apply completion filter
  const filteredTasks = tasks.filter(task => 
    showCompleted ? task.isCompleted : !task.isCompleted
  );

  const toggleTaskExpansion = (taskId: Id<"tasks">) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getSubtasksForTask = (taskId: Id<"tasks">) => {
    const taskIndex = Array.from(expandedTasks).indexOf(taskId);
    return taskIndex >= 0 && subtasksQueries[taskIndex] ? subtasksQueries[taskIndex] || [] : [];
  };

  // Group tasks based on groupBy prop
  const groupTasks = (tasks: any[]) => {
    if (groupBy === "none") {
      return { "": tasks };
    }

    if (groupBy === "project") {
      return tasks.reduce((groups, task) => {
        const projectName = task.projectName || "Inbox";
        if (!groups[projectName]) groups[projectName] = [];
        groups[projectName].push(task);
        return groups;
      }, {} as Record<string, any[]>);
    }

    if (groupBy === "date") {
      return tasks.reduce((groups, task) => {
        let dateGroup = "No Due Date";
        if (task.dueDate) {
          const date = new Date(task.dueDate);
          const today = new Date();
          if (date.toDateString() === today.toDateString()) {
            dateGroup = "Today";
          } else if (date < today) {
            dateGroup = "Overdue";
          } else {
            dateGroup = date.toLocaleDateString();
          }
        }
        if (!groups[dateGroup]) groups[dateGroup] = [];
        groups[dateGroup].push(task);
        return groups;
      }, {} as Record<string, any[]>);
    }

    if (groupBy === "priority") {
      return tasks.reduce((groups, task) => {
        const priority = task.priority || 3;
        const groupName = priority === 1 ? "High Priority" : 
                         priority === 2 ? "Medium Priority" :
                         priority === 4 ? "Low Priority" : "Normal Priority";
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(task);
        return groups;
      }, {} as Record<string, any[]>);
    }

    return { "": tasks };
  };

  // Loading states
  if (!tasks && (allTasks === undefined || projectTasks === undefined || 
      todayTasks === undefined || overdueTasks === undefined || upcomingTasks === undefined)) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const groupedTasks = groupTasks(filteredTasks);
  const hasNoTasks = Object.keys(groupedTasks).length === 0 || 
                    Object.values(groupedTasks).every(group => group.length === 0);

  // Empty states
  if (hasNoTasks) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
          {showCompleted ? (
            <CheckCircle className="w-6 h-6 text-accent" />
          ) : filter === "overdue" ? (
            <AlertCircle className="w-6 h-6 text-orange-500" />
          ) : filter === "today" ? (
            <Clock className="w-6 h-6 text-blue-500" />
          ) : (
            <Circle className="w-6 h-6 text-accent" />
          )}
        </div>
        <h3 className="text-sm font-medium text-foreground mb-2">
          {showCompleted ? "No completed tasks" : 
           filter === "overdue" ? "No overdue tasks" :
           filter === "today" ? "No tasks for today" :
           filter === "upcoming" ? "No upcoming tasks" :
           "No tasks yet"}
        </h3>
        <p className="text-xs text-foreground/60">
          {showCompleted ? "Complete some tasks to see them here" : 
           "Create your first task to get started"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
        <div key={groupName} className="space-y-2">
          {/* Group Header */}
          {groupName && groupBy !== "none" && (
            <div className="flex items-center gap-2 py-2">
              <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                {groupName}
              </h4>
              <Badge variant="secondary" className="text-xs">
                {groupTasks.length}
              </Badge>
            </div>
          )}

          {/* Tasks in Group */}
          <div className="space-y-2">
            {groupTasks.map((task) => (
              <Task
                key={task._id}
                data={task}
                showDetails={true}
                showSubtasks={expandedTasks.has(task._id)}
                subtasks={getSubtasksForTask(task._id)}
                onToggleSubtasks={() => toggleTaskExpansion(task._id)}
                onAddSubtask={() => onAddSubtask?.(task._id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}