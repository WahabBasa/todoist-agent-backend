import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function TasksView() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(3);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState<number>(0);
  const [newTaskEstimatedMinutes, setNewTaskEstimatedMinutes] = useState<number>(0);
  const [newTaskTags, setNewTaskTags] = useState<string>("");
  const [newTaskIsRecurring, setNewTaskIsRecurring] = useState(false);
  const [newTaskRecurringPattern, setNewTaskRecurringPattern] = useState<string>("weekly");
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Filtering and sorting states
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterCompleted, setFilterCompleted] = useState<string>("active");
  const [sortBy, setSortBy] = useState<string>("priority");
  const [sortOrder, setSortOrder] = useState<string>("asc");

  const stats = useQuery(api.tasks.getTaskStats);
  const projects = useQuery(api.projects.getProjects);
  const upcomingTasks = useQuery(api.tasks.getUpcomingTasks, { days: 7 });
  
  // Dynamic task filtering based on current filter states
  const filteredTasks = useQuery(api.tasks.getTasksByFilter, {
    completed: filterCompleted === "all" ? undefined : filterCompleted === "completed",
    projectId: filterProject ? filterProject as any : undefined,
    priority: filterPriority ? Number(filterPriority) : undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });
  
  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    try {
      const taskData: any = {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        projectId: newTaskProjectId ? newTaskProjectId as any : undefined,
        dueDate: newTaskDueDate ? new Date(newTaskDueDate).getTime() : undefined,
        estimatedHours: newTaskEstimatedHours || undefined,
        estimatedMinutes: newTaskEstimatedMinutes || undefined,
        tags: newTaskTags ? newTaskTags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined,
        isRecurring: newTaskIsRecurring,
        recurringPattern: newTaskIsRecurring ? newTaskRecurringPattern : undefined,
      };
      
      await createTask(taskData);
      
      // Reset form
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority(3);
      setNewTaskProjectId("");
      setNewTaskDueDate("");
      setNewTaskEstimatedHours(0);
      setNewTaskEstimatedMinutes(0);
      setNewTaskTags("");
      setNewTaskIsRecurring(false);
      setNewTaskRecurringPattern("weekly");
      setIsFormOpen(false);
      toast.success("Task created successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    }
  };

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
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
      // Fixed: Added default case for robustness
      default: return "Normal";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "badge-error";
      case 2: return "badge-warning";
      case 3: return "badge-info";
      case 4: return "badge-success";
      // Fixed: Added default case for robustness
      default: return "badge-info";
    }
  };

  if (stats === undefined || filteredTasks === undefined || projects === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  const activeTasks = filteredTasks.filter(task => !task.isCompleted);
  const completedTasks = filteredTasks.filter(task => task.isCompleted);
  const displayTasks = filterCompleted === "completed" ? completedTasks : 
                      filterCompleted === "all" ? filteredTasks : activeTasks;

  return (
    <div className="overflow-y-auto h-full p-4 theme-bg-light">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tasks</h2>
          <p className="text-secondary-content">Manage your tasks and track progress</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="text-meta">Total Tasks</div>
          <div className="stat-value text-primary">{stats.total}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="text-meta">Active</div>
          <div className="stat-value text-warning">{stats.active}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="text-meta">Completed</div>
          <div className="stat-value text-success">{stats.completed}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="text-meta">Overdue</div>
          <div className="stat-value text-error">{stats.overdue}</div>
        </div>
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="text-meta">Recurring</div>
          <div className="stat-value text-info">{stats.recurring}</div>
        </div>
      </div>

      {/* Filtering and Sorting Controls */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-4">
          <h3 className="card-title text-lg mb-4">Filter & Sort Tasks</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="text-input-primary">Status</span>
              </label>
              <select 
                className="select select-sm select-bordered"
                value={filterCompleted}
                onChange={(e) => setFilterCompleted(e.target.value)}
              >
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
                <option value="all">All Tasks</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="text-input-primary">Project</span>
              </label>
              <select 
                className="select select-sm select-bordered"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="text-input-primary">Priority</span>
              </label>
              <select 
                className="select select-sm select-bordered"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="">All Priorities</option>
                <option value="1">High Priority</option>
                <option value="2">Medium Priority</option>
                <option value="3">Normal Priority</option>
                <option value="4">Low Priority</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="text-input-primary">Sort By</span>
              </label>
              <select 
                className="select select-sm select-bordered"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="createdAt">Created Date</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="text-input-primary">Order</span>
              </label>
              <select 
                className="select select-sm select-bordered"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Tasks Alert */}
      {upcomingTasks && upcomingTasks.length > 0 && (
        <div className="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>
            <strong>Upcoming Deadlines:</strong> You have {upcomingTasks.length} task(s) due in the next 7 days
          </span>
        </div>
      )}

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
              className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 transition-all"
              onClick={() => setIsFormOpen(!isFormOpen)}
            >
              {isFormOpen ? "Cancel" : "New Task"}
            </button>
          </div>
          
          {isFormOpen && (
            <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
              <div className="form-control">
                <label className="label">
                  <span className="text-input-primary">Task Title *</span>
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
                  <span className="text-input-primary">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="Enter task description..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="text-input-primary">Priority</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                  >
                    <option value={1}>🔴 High Priority</option>
                    <option value={2}>🟡 Medium Priority</option>
                    <option value={3}>🔵 Normal Priority</option>
                    <option value={4}>🟢 Low Priority</option>
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="text-input-primary">Project</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={newTaskProjectId}
                    onChange={(e) => setNewTaskProjectId(e.target.value)}
                  >
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="text-input-primary">Due Date</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="text-input-primary">Tags (comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="work, urgent, review"
                    value={newTaskTags}
                    onChange={(e) => setNewTaskTags(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="text-input-primary">Estimated Time</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Hours"
                    min="0"
                    value={newTaskEstimatedHours || ""}
                    onChange={(e) => setNewTaskEstimatedHours(Number(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Minutes"
                    min="0"
                    max="59"
                    value={newTaskEstimatedMinutes || ""}
                    onChange={(e) => setNewTaskEstimatedMinutes(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="text-input-primary">Recurring Task</span>
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary"
                    checked={newTaskIsRecurring}
                    onChange={(e) => setNewTaskIsRecurring(e.target.checked)}
                  />
                </label>
                {newTaskIsRecurring && (
                  <select
                    className="select select-bordered w-full mt-2"
                    value={newTaskRecurringPattern}
                    onChange={(e) => setNewTaskRecurringPattern(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>
              
              <div className="form-control">
                <button type="submit" className="bg-primary text-primary-foreground text-sm font-medium px-6 py-2 rounded-md hover:bg-primary/90 transition-all">
                  Create Task
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {filterCompleted === "completed" ? "Completed" : 
             filterCompleted === "all" ? "All" : "Active"} Tasks ({displayTasks.length})
          </h3>
          
          <div className="divider my-2"></div>
          
          {displayTasks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-secondary-content mb-4">
                No {filterCompleted === "completed" ? "completed" : "active"} tasks found.
                {filterCompleted === "active" && " Create one to get started!"}
              </p>
              {filterCompleted === "active" && (
                <div className="text-meta">
                  💡 Try asking the AI: "Create a task to review the project documentation"
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayTasks.map((task) => (
                <div key={task._id} className={`card shadow-sm ${
                  task.isCompleted ? 'bg-base-200 opacity-75' : 'bg-base-200'
                }`}>
                  <div className="card-body p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mt-1"
                        checked={task.isCompleted}
                        onChange={() => toggleTaskCompletion(task._id as string, task.isCompleted)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-medium ${
                            task.isCompleted ? 'line-through text-muted-foreground' : ''
                          }`}>{task.title}</h4>
                          <div className={`badge badge-sm ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                          </div>
                          {task.isRecurring && (
                            <div className="badge badge-sm badge-info">🔄 {task.recurringPattern}</div>
                          )}
                        </div>
                        
                        {task.description && (
                          <p className="text-secondary-content mb-2">{task.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-2 text-sm">
                          {(task as any).projectName && (
                            <div className="badge badge-outline badge-sm">📁 {(task as any).projectName}</div>
                          )}
                          
                          {task.dueDate && (
                            <div className={`badge badge-sm ${
                              task.dueDate < Date.now() && !task.isCompleted ? 'badge-error' : 'badge-info'
                            }`}>
                              📅 {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                          
                          {task.estimatedTime && task.estimatedTime > 0 && (
                            <div className="badge badge-ghost badge-sm">
                              ⏱️ {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m
                            </div>
                          )}
                        </div>
                        
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
      </div>
    </div>
  );
}