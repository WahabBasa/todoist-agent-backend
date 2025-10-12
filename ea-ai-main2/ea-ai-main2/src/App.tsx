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
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Landing } from "./views/Landing";
import { Auth } from "./views/Auth";
import { PrivacyPolicy } from "./views/PrivacyPolicy";
import { Resources } from "./views/Resources";
import { Pricing } from "./views/Pricing";

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
      
      <AuthLoading>
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto animate-pulse">
              <img src="/oldowan-logo.png" alt="Loading" className="w-full h-full object-contain" />
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
            {path.startsWith('/auth') ? <Auth /> :
             path.startsWith('/privacy') ? <PrivacyPolicy /> : 
             path.startsWith('/resources') ? <Resources /> :
             path.startsWith('/pricing') ? <Pricing /> :
             <Landing />}
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


