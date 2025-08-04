import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { TaskList } from "./TaskList";
import { toast } from "sonner";

type TaskWithProject = Doc<"tasks"> & { projectName?: string };

export function TaskManagement() {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "dueDate" | "created">("priority");

  const allTasks = useQuery(api.tasks.getTasks, {});
  const activeTasks = useQuery(api.tasks.getTasks, { completed: false });
  const completedTasks = useQuery(api.tasks.getTasks, { completed: true });
  const projects = useQuery(api.projects.getProjects);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const getFilteredTasks = (): TaskWithProject[] => {
    let tasks: TaskWithProject[];
    switch (filter) {
      case "all":
        tasks = (allTasks as TaskWithProject[]) || [];
        break;
      case "active":
        tasks = (activeTasks as TaskWithProject[]) || [];
        break;
      case "completed":
        tasks = (completedTasks as TaskWithProject[]) || [];
        break;
      default:
        tasks = (activeTasks as TaskWithProject[]) || [];
    }

    // Filter by project
    if (selectedProject) {
      tasks = tasks.filter(task => task.projectId === selectedProject);
    }

    // Sort tasks
    return tasks.sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return a.priority - b.priority;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate - b.dueDate;
        case "created":
          return b._creationTime - a._creationTime;
        default:
          return 0;
      }
    });
  };

  const handleToggleComplete = async (taskId: Id<"tasks">, isCompleted: boolean) => {
    try {
      await updateTask({
        taskId,
        isCompleted: !isCompleted,
      });
      toast.success(isCompleted ? "Task marked as incomplete" : "Task completed!");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: Id<"tasks">) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    try {
      await deleteTask({ taskId });
      toast.success("Task deleted successfully");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="flex flex-col h-full">
      {/* Filters and Controls */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            {/* Status Filter */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter("active")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "active"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Active ({activeTasks?.length || 0})
              </button>
              <button
                onClick={() => setFilter("completed")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "completed"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Completed ({completedTasks?.length || 0})
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({allTasks?.length || 0})
              </button>
            </div>

            {/* Project Filter */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Projects</option>
              {projects?.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
              <option value="created">Created Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTasks.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold mb-2">No tasks found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {filter === "active" 
                ? "You don't have any active tasks. Create one using the sidebar or AI chat!"
                : filter === "completed"
                ? "No completed tasks yet. Start working on your active tasks!"
                : "No tasks created yet. Use the sidebar to create your first task!"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task._id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleComplete(task._id, task.isCompleted)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.isCompleted
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-500"
                    }`}
                  >
                    {task.isCompleted && "✓"}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium ${
                      task.isCompleted ? "line-through text-gray-500" : "text-gray-800"
                    }`}>
                      {task.title}
                    </h4>
                    
                    {task.description && (
                      <p className={`text-sm mt-1 ${
                        task.isCompleted ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium ${
                        task.priority === 1 ? "text-red-600" :
                        task.priority === 2 ? "text-orange-600" :
                        task.priority === 3 ? "text-yellow-600" : "text-green-600"
                      }`}>
                        P{task.priority}
                      </span>
                      
                      {task.projectName && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {task.projectName}
                        </span>
                      )}
                      
                      {task.dueDate && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          new Date(task.dueDate) < new Date() 
                            ? "bg-red-100 text-red-800" 
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      
                      {task.estimatedTime && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {task.estimatedTime < 60 
                            ? `${task.estimatedTime}m` 
                            : `${Math.floor(task.estimatedTime / 60)}h ${task.estimatedTime % 60}m`
                          }
                        </span>
                      )}
                      
                      {task.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteTask(task._id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
