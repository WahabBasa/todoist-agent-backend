"use client";

import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Toaster } from "sonner";

// Import components
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./views/ChatView";
import { TasksView } from "./views/TasksView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";
import { ThemeTest, useThemeDebug } from "./components/ThemeTest";

export default function App() {
  return (
    <div data-theme="ea-theme" className="h-full">
      <Toaster position="top-right" />
      {/* DEBUG: Theme Test Component */}
      <div data-testid="theme-test">
        <ThemeTest />
      </div>
      <Authenticated>
        <MainApp />
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
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
    // The root div now manages the sidebar's presence
    <div className="h-full w-full bg-base-200">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* --- THIS LAYOUT IS NOW SIMPLIFIED AND MORE ROBUST --- */}
      {/* This div is the main content area that sits to the right of the sidebar */}
      <div className="lg:ml-64 flex flex-col h-screen">
        {/* Header: Fixed height, does not grow or shrink */}
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-30 flex-shrink-0">
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

        {/* Main Content Area: Takes up all remaining vertical space */}
        <main className="flex-1 overflow-y-auto">
            {renderActiveView()}
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
    <div className="w-96 bg-card rounded-lg border border-border shadow-lg">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">T</span>
            </div>
            <span className="font-bold text-2xl text-foreground">TaskAI</span>
          </div>
          <h1 className="text-xl font-bold mb-2 text-foreground">
            Welcome to TaskAI
          </h1>
          <p className="text-sm text-muted-foreground">
            Your intelligent task management assistant
          </p>
        </div>
        
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
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              type="email"
              name="email"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              type="password"
              name="password"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : flow === "signIn" ? "Sign In" : "Sign Up"}
          </button>
          
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              type="button"
              className="text-sm font-medium text-primary hover:underline focus:outline-none focus:underline"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}