"use client";

import React, { useState, useEffect } from "react";
import { AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { Toaster } from "sonner";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useUser } from "@clerk/clerk-react";
import { sendAuthTelemetry } from "@/lib/telemetry";
import AuthCallback from "./components/AuthCallback";

// Import components
import { ChatView } from "./views/ChatView";
import { SettingsView } from "./views/SettingsView";
import { MainLayout } from "./components/layout/MainLayout";
import { Button } from "./components/ui/button";
import { Id } from "../convex/_generated/dataModel";
import { ChatProvider } from "./context/chat";
import { SessionsProvider, useSessions } from "./context/sessions";
import { api } from "../convex/_generated/api";
import { AppLoading } from "./components/ui/AppLoading";
import { CustomAuthForm } from "./components/CustomAuthForm";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Hook to detect OAuth callback and surface errors
function useOAuthCallbackState() {
  const [state, setState] = useState<{ isCallback: boolean; error?: string }>(() => ({ isCallback: false }));

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasOAuthParams = search.has('__clerk') || hash.has('__clerk');

    // Extract common error params if present
    const error = search.get('error') || search.get('clerk_error') || hash.get('error') || hash.get('clerk_error');
    const errorDescription = search.get('error_description') || search.get('clerk_error_description') || hash.get('error_description') || hash.get('clerk_error_description');

    setState({
      isCallback: hasOAuthParams,
      error: errorDescription || error || undefined,
    });

    if (hasOAuthParams) {
      console.log('🔐 OAuth callback detected, processing...');
      if (error || errorDescription) {
        console.warn('🔐 OAuth error detected:', errorDescription || error);
      }
    }
  }, []);

  return state;
}

export default function App() {
  // Dedicated OAuth callback route handled by Clerk
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const hasClerkParams = typeof window !== 'undefined' && (window.location.search.includes('__clerk') || window.location.hash.includes('__clerk'));
  const { isSignedIn, isLoaded } = useAuth();

  // 1) Always handle explicit callback route
  if (path.startsWith('/sso-callback')) {
    return <AuthCallback />;
  }

  // 2) Universal callback only if not already signed in (prevents re-login loops)
  if (hasClerkParams && (!isLoaded || !isSignedIn)) {
    return <AuthCallback />;
  }

  const { isCallback: isOAuthCallback, error: oauthError } = useOAuthCallbackState();
  useEffect(() => {
    if (isOAuthCallback && path.startsWith('/sso-callback')) {
      try {
        sendAuthTelemetry('callback', {
          search: window.location.search,
          hash: window.location.hash,
          href: window.location.href,
          error: oauthError,
        });
      } catch {}
    }
  }, [isOAuthCallback, oauthError, path]);
  
  return (
    <div className="h-full" suppressHydrationWarning>
      <Toaster position="top-right" />
      
      {/* Show loading only on the explicit callback route */}
      {path.startsWith('/sso-callback') && isOAuthCallback && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 mx-auto bg-primary rounded-lg flex items-center justify-center animate-pulse">
              <span className="text-primary-foreground font-semibold text-lg">T</span>
            </div>
            <p className="text-muted-foreground">Completing sign in...</p>
            {oauthError && (
              <p className="text-destructive text-sm">Google sign-in failed: {oauthError}</p>
            )}
          </div>
        </div>
      )}
      
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
      <SignedIn>
        <SignedInLogger />
        <ErrorBoundary>
          <SessionsProvider>
            <ChatProvider>
              <MainApp />
            </ChatProvider>
          </SessionsProvider>
        </ErrorBoundary>
      </SignedIn>
      <SignedOut>
        {!isOAuthCallback && (
          <ErrorBoundary>
            <LandingPage />
          </ErrorBoundary>
        )}
      </SignedOut>
    </div>
  );
}

function MainApp() {
  // Simplified session management - remove race conditions
  const { currentSessionId, selectSession, ensureDefaultSession, sessions, isLoadingSessions } = useSessions();
  
  // Get default session for this user
  const defaultSession = useQuery(api.chatSessions.getDefaultSession, {});
  
  // Simple, stable loading state
  const isDataReady = !isLoadingSessions && defaultSession !== undefined;
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Debug: Log initialization state
  React.useEffect(() => {
    console.log('🔄 [APP DEBUG] App initialization state:', {
      isDataReady,
      hasInitialized,
      currentSessionId,
      sessionsCount: sessions.length,
      defaultSessionExists: !!defaultSession,
      defaultSessionId: defaultSession?._id
    });
  }, [isDataReady, hasInitialized, currentSessionId, sessions.length, defaultSession]);
  
  // Simplified session initialization - runs only once when data is ready
  useEffect(() => {
    if (!isDataReady || hasInitialized) {
      console.log('🔄 [APP DEBUG] Skipping initialization:', {
        isDataReady,
        hasInitialized
      });
      return;
    }
    
    const initializeSession = async () => {
      console.log('🔄 [APP DEBUG] Initializing session...', {
        currentSessionId,
        sessionsCount: sessions.length,
        defaultSessionExists: !!defaultSession
      });
      
      try {
        // If no current session, select the best available one
        if (!currentSessionId) {
          if (sessions.length > 0) {
            // Use most recent session
            const mostRecentSession = sessions[0];
            console.log('📋 [APP DEBUG] Using most recent session:', mostRecentSession._id);
            selectSession(mostRecentSession._id);
          } else if (defaultSession) {
            // Use default session
            console.log('📋 [APP DEBUG] Using default session:', defaultSession._id);
            selectSession(defaultSession._id);
          } else {
            // Create and use new default session
            console.log('🚀 [APP DEBUG] Creating new default session...');
            const newDefaultId = await ensureDefaultSession();
            selectSession(newDefaultId);
          }
        } else {
          console.log('✅ [APP DEBUG] Current session already exists:', currentSessionId);
        }
      } catch (error) {
        console.error('Session initialization failed:', error);
        // Continue anyway to avoid perpetual loading
      } finally {
        setHasInitialized(true);
      }
    };
    
    initializeSession();
  }, [isDataReady, hasInitialized, currentSessionId, selectSession, ensureDefaultSession, sessions, defaultSession]);

  // Show loading only while waiting for data or during initialization
  if (!isDataReady || !hasInitialized) {
    return (
      <MainLayout>
        <AppLoading message="Initializing chat..." />
      </MainLayout>
    );
  }

  // Render chat view once everything is ready
  return (
    <MainLayout>
      <ChatView />
    </MainLayout>
  );
}


function LandingPage() {
  // Telemetry for bounce-back without __clerk params
  useEffect(() => {
    try {
      const ref = document.referrer || "";
      const hasClerkParams = window.location.search.includes('__clerk') || window.location.hash.includes('__clerk');
      if (!hasClerkParams && (ref.includes('accounts.google.com') || ref.includes('clerk'))) {
        sendAuthTelemetry('bounce', {
          referrer: ref,
          search: window.location.search,
          hash: window.location.hash,
        });
      }
    } catch {}
  }, []);

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
            
            <CustomAuthForm />
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

function SignedInLogger() {
  const { user, isLoaded } = useUser();
  useEffect(() => {
    if (isLoaded && user) {
      sendAuthTelemetry('auth_frontend_complete', {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });

      // Cleanup any stale __clerk params from URL to avoid callback re-trigger
      try {
        if (typeof window !== 'undefined') {
          const hasClerkParams = window.location.search.includes('__clerk') || window.location.hash.includes('__clerk');
          if (hasClerkParams) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch {}
    }
  }, [isLoaded, user]);
  return null;
}


function TaskAIDemo() {
  type MessageType = "user" | "assistant" | "code";
  
  interface Message {
    type: MessageType;
    content: string;
  }
  
  const [messages, setMessages] = useState<Message[]>([
    {
      type: "user",
      content: "TaskAI, can you help me organize my project tasks?"
    }
  ]);
  
  const [currentMessage, setCurrentMessage] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const demoMessages: Message[] = [
    {
      type: "assistant",
      content: "Absolutely! I'll help organize your project tasks efficiently."
    },
    {
      type: "code",
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
            type: "user",
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
