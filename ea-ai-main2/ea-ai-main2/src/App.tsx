"use client";

import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast, Toaster } from "sonner";

// Import components
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./views/ChatView";
import { TasksView } from "./views/TasksView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  return (
    <div data-theme="ea-theme">
      <Toaster position="top-right" />
      <Authenticated>
        <MainApp />
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

function MainApp() {
  const [activeView, setActiveView] = useState<"chat" | "tasks" | "projects" | "settings">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const renderActiveView = () => {
    switch (activeView) {
      case "chat":
        return <ChatView />;
      case "tasks":
        return <TasksView />;
      case "projects":
        return <ProjectsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Fixed Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Main Content with proper margins for sidebar */}
      <div 
        className={`
          min-h-screen flex flex-col
          transition-all duration-300 ease-in-out
          lg:ml-64
        `}
      >
        {/* Top Navigation Bar */}
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-30">
          <div className="flex-none lg:hidden">
            <button 
              className="btn btn-square btn-ghost"
              onClick={toggleSidebar}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <span className="font-bold text-xl">TaskAI</span>
              </div>
            </div>
          </div>
          
          <div className="flex-none">
            <SignOutButton />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {activeView === "chat" ? (
            <div className="h-full">
              {renderActiveView()}
            </div>
          ) : (
            <div className="container mx-auto p-6">
              {renderActiveView()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  
  return (
    <>
      {isAuthenticated && (
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
            <div className="w-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
              <span className="text-sm font-bold">U</span>
            </div>
          </div>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li>
              <a className="justify-between">
                Profile
                <span className="badge">New</span>
              </a>
            </li>
            <li><a>Settings</a></li>
            <li>
              <button onClick={() => void signOut()}>
                Sign out
              </button>
            </li>
          </ul>
        </div>
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
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-content font-bold text-2xl">T</span>
            </div>
            <span className="font-bold text-2xl">TaskAI</span>
          </div>
          <h1 className="text-xl font-bold mb-2">
            Welcome to TaskAI
          </h1>
          <p className="text-sm text-base-content/70">
            Your intelligent task management assistant
          </p>
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
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              className="input input-bordered w-full"
              type="password"
              name="password"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            className={`btn btn-primary btn-block ${isLoading ? 'loading' : ''}`}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : flow === "signIn" ? "Sign In" : "Sign Up"}
          </button>
          
          <div className="text-center mt-4">
            <span className="text-sm">
              {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              type="button"
              className="link link-hover font-medium"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
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