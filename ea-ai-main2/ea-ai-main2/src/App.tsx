"use client";

import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

// Import components
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./views/ChatView";
import { TasksView } from "./views/TasksView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";
import { ThemeTest, useThemeDebug } from "./components/ThemeTest";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "./components/ui/sidebar";

export default function App() {
  return (
    <div data-theme="ea-theme" className="h-full overflow-hidden">
      <Toaster position="top-right" />
      {/* DEBUG: Theme Test Component */}
      <div data-testid="theme-test">
        <ThemeTest />
      </div>
      <Authenticated>
        <MainApp />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </div>
  );
}

function MainApp() {
  const [activeView, setActiveView] = useState<"chat" | "tasks" | "projects" | "settings">("chat");

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
    <SidebarProvider>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex-1">
            {/* Header content can go here if needed */}
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex flex-1 flex-col p-4">
          {renderActiveView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
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

function LandingPage() {
  return (
    <div className="min-h-screen relative">
      {/* Two-tone Background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-muted/60"></div> {/* Left half - darker */}
        <div className="flex-1 bg-background"></div> {/* Right half - lighter */}
      </div>
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T</span>
          </div>
          <span className="font-bold text-xl text-foreground">TaskAI</span>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="relative z-10 flex-1 flex items-center pt-20">
        <div className="w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Your tasks,{" "}
                <span className="block">amplified</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-md">
                AI-powered task management that helps you organize and accomplish more.
              </p>
            </div>
            
            <SignInForm />
          </div>

          {/* Right Column - Demo */}
          <div className="hidden lg:block">
            <TaskAIDemo />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 max-w-sm">
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
        {/* Google Sign-in Button */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-background border border-input rounded-lg hover:bg-muted/50 transition-colors text-sm font-medium text-foreground"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">OR</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <input
            className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            type="email"
            name="email"
            placeholder="Enter your personal or work email"
            required
          />
        </div>
        
        <div className="space-y-1">
          <input
            className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            type="password"
            name="password"
            placeholder="Password"
            required
          />
        </div>
        
        <button
          className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Continue with email"}
        </button>
        
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            By continuing, you acknowledge TaskAI's{" "}
            <button type="button" className="underline hover:text-foreground">
              Privacy Policy
            </button>
            .
          </p>
        </div>
        
        <div className="text-center">
          <button 
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "New to TaskAI? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function TaskAIDemo() {
  const [messages, setMessages] = useState([
    {
      type: "user" as const,
      content: "TaskAI, can you help me organize my project tasks?"
    }
  ]);
  
  const [currentMessage, setCurrentMessage] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const demoMessages = [
    {
      type: "assistant" as const,
      content: "Absolutely! I'll help organize your project tasks efficiently."
    },
    {
      type: "code" as const,
      content: `Project: "Website Redesign"
├── Design Phase
│   ✓ User research and personas
│   ✓ Wireframes and mockups  
│   ⏳ Design system creation
│   ⏳ Prototype development
├── Development Phase
│   ⚡ Frontend components
│   ⚡ Backend integration
│   📋 Testing and QA
└── Launch Phase
    📋 Deployment setup
    📋 Performance optimization`
    }
  ];
  
  // Auto-advance demo messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentMessage < demoMessages.length) {
        setIsTyping(true);
        setTimeout(() => {
          setMessages(prev => [...prev, demoMessages[currentMessage]]);
          setCurrentMessage(prev => prev + 1);
          setIsTyping(false);
        }, 1000);
      } else {
        // Reset demo
        setTimeout(() => {
          setMessages([{
            type: "user" as const,
            content: "TaskAI, can you help me organize my project tasks?"
          }]);
          setCurrentMessage(0);
        }, 3000);
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, [currentMessage, demoMessages]);
  
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 max-w-lg">
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            {message.type === "user" && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">👤</span>
                </div>
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-sm max-w-xs">
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            )}
            
            {message.type === "assistant" && (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xs">T</span>
                </div>
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-sm max-w-xs">
                  <p className="text-sm text-foreground">{message.content}</p>
                </div>
              </div>
            )}
            
            {message.type === "code" && (
              <div className="flex items-start gap-2 w-full">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xs">T</span>
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm p-4 flex-1">
                  <pre className="text-xs text-foreground font-mono whitespace-pre-wrap">
                    {message.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">T</span>
            </div>
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
        </div>
      </div>
    </div>
  );
}