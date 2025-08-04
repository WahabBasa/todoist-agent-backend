import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function TasksView() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(3);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const stats = useQuery(api.myFunctions.getDashboardStats);
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const completedTasks = useQuery(api.tasks.getTasks, { completed: true });
  const projects = useQuery(api.projects.getProjects);
  
  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    try {
      await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
      });
      
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority(3);
      setIsFormOpen(false);
      toast.success("Task created successfully!");
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    try {
      await updateTask({
        id: taskId,
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
      case 1: return "badge-error";
      case 2: return "badge-warning";
      case 3: return "badge-info";
      case 4: return "badge-success";
      default: return "badge-info";
    }
  };

  if (stats === undefined || tasks === undefined || projects === undefined || completedTasks === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-base-content/70">Manage your tasks and track progress</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Total Tasks</div>
          <div className="stat-value text-primary">{stats.totalTasks}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Completed</div>
          <div className="stat-value text-success">{stats.completedTasks}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Active</div>
          <div className="stat-value text-warning">{tasks.length}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Projects</div>
          <div className="stat-value text-accent">{stats.totalProjects}</div>
        </div>
      </div>

      {/* Task Creation Form */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h3 className="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Task
            </h3>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setIsFormOpen(!isFormOpen)}
            >
              {isFormOpen ? "Cancel" : "New Task"}
            </button>
          </div>
          
          {isFormOpen && (
            <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Task Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="Enter task description..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Priority</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                >
                  <option value={1}>High Priority</option>
                  <option value={2}>Medium Priority</option>
                  <option value={3}>Normal Priority</option>
                  <option value={4}>Low Priority</option>
                </select>
              </div>
              
              <div className="form-control">
                <button type="submit" className="btn btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Active Tasks */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Active Tasks ({tasks.length})
          </h3>
          
          <div className="divider my-2"></div>
          
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-base-content/70 mb-4">No active tasks. Create one to get started!</p>
              <div className="text-sm text-base-content/50">
                💡 Try asking the AI: "Create a task to review the project documentation"
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task._id} className="card bg-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mt-1"
                        checked={task.isCompleted}
                        onChange={() => toggleTaskCompletion(task._id, task.isCompleted)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{task.title}</h4>
                          <div className={`badge badge-sm ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-sm text-base-content/70 mb-2">{task.description}</p>
                        )}
                        {task.projectName && (
                          <div className="badge badge-outline badge-sm">📁 {task.projectName}</div>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {task.tags.map((tag, index) => (
                              <div key={index} className="badge badge-ghost badge-sm">#{tag}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Completed Tasks ({completedTasks.length})
            </h3>
            
            <div className="divider my-2"></div>
            
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map((task) => (
                <div key={task._id} className="flex items-center gap-3 p-2 rounded-lg bg-base-200 opacity-60">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={task.isCompleted}
                    onChange={() => toggleTaskCompletion(task._id, task.isCompleted)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="line-through text-base-content/60">{task.title}</span>
                      <div className={`badge badge-sm ${getPriorityColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {completedTasks.length > 5 && (
              <div className="text-center mt-4">
                <p className="text-sm text-base-content/70">
                  And {completedTasks.length - 5} more completed tasks...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}