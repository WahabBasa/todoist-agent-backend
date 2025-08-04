"use client";

import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast, Toaster } from "sonner";

export default function App() {
  return (
    <div data-theme="ea-theme">
      <Toaster position="top-right" />
      <Authenticated>
        <div className="min-h-screen bg-base-200">
          <div className="navbar bg-base-100 shadow-sm">
            <div className="flex-1">
              <a className="btn btn-ghost normal-case text-xl">Task Manager</a>
            </div>
            <div className="flex-none">
              <SignOutButton />
            </div>
          </div>
          <main className="container mx-auto px-4 py-8">
            <Content />
          </main>
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  return (
    <>
      {isAuthenticated && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      )}
    </>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="card w-96 bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-8">
            Sign in or create an account
          </h1>
          
          {/* OAuth Buttons */}
          <div className="flex gap-3 mb-6">
            <button className="btn btn-outline flex-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
            
            <button className="btn btn-outline flex-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            
            <button className="btn btn-outline flex-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.223.083.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z"/>
              </svg>
              Apple
            </button>
          </div>
          
          {/* Divider */}
          <div className="divider">OR CONTINUE WITH</div>
        </div>
        
        {/* Email and Password Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsLoading(true);
            const formData = new FormData(e.target as HTMLFormElement);
            formData.set("flow", flow);
            void signIn("password", formData)
              .catch((error) => {
                setError(error.message);
              })
              .finally(() => {
                setIsLoading(false);
              });
          }}
        >
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              className="input input-bordered w-full"
              type="email"
              name="email"
              placeholder=""
              required
            />
          </div>
          
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Password</span>
              <span className="label-text-alt">
                <a href="#" className="link link-hover text-sm">Forgot your password?</a>
              </span>
            </label>
            <input
              className="input input-bordered w-full"
              type="password"
              name="password"
              placeholder=""
              required
            />
          </div>
          
          <button
            className={`btn btn-primary btn-block ${isLoading ? 'loading' : ''}`}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
          
          <div className="text-center mt-4">
            <span className="text-sm">Don't have an account? </span>
            <button 
              type="button"
              className="link link-hover font-medium"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              Sign up
            </button>
          </div>
          
          {error && (
            <div className="alert alert-error mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Content() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(3);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const user = useQuery(api.myFunctions.getCurrentUser);
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

  if (user === undefined || stats === undefined || tasks === undefined || projects === undefined || completedTasks === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              <p className="text-base-content/70">No active tasks. Create one to get started!</p>
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

function ResourceCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </a>
  );
}
