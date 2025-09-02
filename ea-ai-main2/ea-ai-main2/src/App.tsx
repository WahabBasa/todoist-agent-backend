

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

// Import components
import { AppSidebar } from "./components/Sidebar";
import { ChatView } from "./views/ChatView";
import { SettingsView } from "./views/SettingsView";
import { SidebarProvider } from "./components/ui/sidebar";
import { Button } from "./components/ui/button";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  return (
    <div className="h-full">
      <Toaster position="top-right" />
      <AuthLoading>
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 mx-auto bg-primary rounded-lg flex items-center justify-center animate-pulse">
              <span className="text-primary-foreground font-semibold text-lg">T</span>
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AuthLoading>
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
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");
  const [currentSessionId, setCurrentSessionId] = useState<Id<"chatSessions"> | null>(null);

  const handleNewChat = () => {
    setCurrentSessionId(null); // Clear session to start new chat
  };

  const handleChatSelect = (sessionId: Id<"chatSessions">) => {
    setCurrentSessionId(sessionId);
    setActiveView("chat"); // Ensure we're in chat view when selecting a session
  };

  const renderActiveView = () => {
    if (activeView === "settings") {
      return <SettingsView onBackToChat={() => setActiveView("chat")} />;
    }
    return <ChatView sessionId={currentSessionId} />;
  };

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onNewChat={handleNewChat}
        currentSessionId={currentSessionId}
        onChatSelect={handleChatSelect}
        onOpenSettings={() => setActiveView("settings")}
      />
      <div className="flex flex-col flex-1">
        <main className="flex flex-1 min-h-0">
          {renderActiveView()}
        </main>
      </div>
    </SidebarProvider>
  );
}


function LandingPage() {
  return (
    <div className="min-h-screen relative">
      {/* Two-tone Background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 theme-bg-medium"></div> {/* Left half - darker */}
        <div className="flex-1 theme-bg-ultra-light"></div> {/* Right half - lighter */}
      </div>
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-lg">T</span>
          </div>
          <span className="font-semibold text-xl text-foreground">TaskAI</span>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="relative z-10 flex-1 flex items-center pt-20">
        <div className="w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-semibold text-foreground leading-tight">
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
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 max-w-sm space-y-4">
      <SignInButton mode="modal">
        <button className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-background border border-input rounded-lg hover:bg-muted/50 transition-colors text-sm font-medium text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </SignInButton>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">OR</span>
        </div>
      </div>
      
      <SignInButton mode="modal">
        <button className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm">
          Sign In
        </button>
      </SignInButton>
      
      <div className="text-center">
        <SignUpButton mode="modal">
          <button className="text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline">
            New to TaskAI? Sign up
          </button>
        </SignUpButton>
      </div>
      
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          By continuing, you acknowledge TaskAI's{" "}
          <button type="button" className="underline hover:text-foreground">
            Privacy Policy
          </button>
          .
        </p>
      </div>
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
                  <span className="text-primary-foreground font-semibold text-xs">T</span>
                </div>
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-sm max-w-xs">
                  <p className="text-sm text-foreground">{message.content}</p>
                </div>
              </div>
            )}
            
            {message.type === "code" && (
              <div className="flex items-start gap-2 w-full">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-xs">T</span>
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
              <span className="text-primary-foreground font-semibold text-xs">T</span>
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