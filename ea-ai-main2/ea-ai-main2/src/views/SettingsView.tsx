"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { ConnectedAppItem } from "../components/settings/ConnectedAppItem";
import { 
  User, Plug, 
  AlertTriangle, Trash2, LogOut, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

interface SettingsViewProps {
  onBackToChat: () => void;
}

type SettingsSection = 
  | "connected-apps"
  | "profile"
  | "account";

const SETTINGS_SECTIONS = [
  { id: "connected-apps" as const, label: "Connected Apps", icon: Plug },
  { id: "profile" as const, label: "Profile", icon: User },
  { id: "account" as const, label: "Account", icon: User },
];

// (removed unused SettingsSwitch)

interface SettingsActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  variant?: "default" | "destructive";
  onClick?: () => void;
}

function SettingsActionButton({ icon: Icon, children, variant = "default", onClick }: SettingsActionButtonProps) {
  const isDestructive = variant === "destructive";
  
  return (
    <Button 
      variant="outline" 
      className="w-auto justify-start gap-2 h-9 text-sm transition-colors"
      style={{
        backgroundColor: isDestructive ? "transparent" : "var(--medium-dark)",
        borderColor: isDestructive ? "#ef4444" : "var(--color-border)",
        color: isDestructive ? "#ef4444" : "var(--soft-off-white)"
      }}
      onMouseEnter={(e) => {
        if (isDestructive) {
          e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
          e.currentTarget.style.borderColor = "#ef4444";
        } else {
          e.currentTarget.style.backgroundColor = "var(--user-message-bg)";
        }
      }}
      onMouseLeave={(e) => {
        if (isDestructive) {
          e.currentTarget.style.backgroundColor = "transparent";
        } else {
          e.currentTarget.style.backgroundColor = "var(--medium-dark)";
        }
      }}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Button>
  );
}

export function SettingsView({ onBackToChat }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("connected-apps");
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  
  // Move Todoist connection query to parent to persist across tab switches
  const hasTodoistConnection = useQuery(api.todoist.auth.hasTodoistConnection);
  const removeTodoistConnection = useAction(api.todoist.auth.removeTodoistConnection);

  const renderContent = () => {
    switch (activeSection) {
      case "connected-apps":
        return <ConnectedAppsSettings 
          clerkUser={clerkUser} 
          signOut={signOut} 
          hasTodoistConnection={hasTodoistConnection}
          removeTodoistConnection={removeTodoistConnection}
          isConnecting={isConnecting}
          setIsConnecting={setIsConnecting}
        />;
      case "profile":
        return <ProfileSettings />;
      case "account":
        return <AccountSettings clerkUser={clerkUser} signOut={signOut} />;
      default:
        return <ConnectedAppsSettings 
          clerkUser={clerkUser} 
          signOut={signOut} 
          hasTodoistConnection={hasTodoistConnection}
          removeTodoistConnection={removeTodoistConnection}
          isConnecting={isConnecting}
          setIsConnecting={setIsConnecting}
        />;
    }
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--dark-charcoal)" }}>
      {/* Back to Chat Button - Top Left */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBackToChat}
        className="absolute top-4 left-4 z-10 h-8 px-3 gap-2 transition-colors"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--user-message-bg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '';
        }}
        style={{ color: "var(--soft-off-white)" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Chat
      </Button>
      
      {/* Left Navigation Sidebar */}
      <div 
        className="w-[250px]" 
        style={{ 
          backgroundColor: "var(--dark-charcoal)"
        }}
      >
        {/* Header */}
        <div className="p-6 pt-16">
          <h2 
            className="text-xl font-semibold" 
            style={{ color: "var(--soft-off-white)" }}
          >
            Settings
          </h2>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-3">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-colors"
                style={{
                  backgroundColor: activeSection === section.id ? "var(--user-message-bg)" : "transparent",
                  color: activeSection === section.id ? "var(--soft-off-white)" : "var(--neutral-stone)"
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = "var(--user-message-bg)";
                    e.currentTarget.style.color = "var(--soft-off-white)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--neutral-stone)";
                  }
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-left">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Right Content Area */}
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-8 pt-16 max-w-4xl">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}








interface ConnectedAppsSettingsProps {
  clerkUser: any;
  signOut: () => void;
  hasTodoistConnection: boolean | undefined;
  removeTodoistConnection: any;
  isConnecting: string | null;
  setIsConnecting: (value: string | null) => void;
}

function ConnectedAppsSettings({ 
  clerkUser, 
  signOut, 
  hasTodoistConnection,
  removeTodoistConnection,
  isConnecting,
  setIsConnecting 
}: ConnectedAppsSettingsProps) {
  // Remove unused parameters for linting
  void clerkUser;
  void signOut;
  
  const [hasAutoSynced] = useState(false);
  void hasAutoSynced; // Remove unused variable warning
  const [todoistConflictData, setTodoistConflictData] = useState<{
    message: string;
    instructions: string[];
  } | null>(null);
  
  // Handle successful connection after conflict (no more status logging)
  useEffect(() => {
    // If user successfully connected after a conflict, clear the conflict data
    if (hasTodoistConnection && todoistConflictData) {
      console.log("✅ [Settings] Todoist connected successfully after conflict resolution");
      setTodoistConflictData(null);
      // Show success message
      setTimeout(() => {
        alert("✅ Todoist connected successfully! You can now use task management features.");
      }, 500);
    }
  }, [hasTodoistConnection, todoistConflictData]);
  





  // GOOGLE CALENDAR CONNECTION STATE
  const { user, isLoaded: isUserLoaded } = useUser();
  const clerkCtx = useClerk();
  const hasGoogleCalendarConnection = useAction(api.googleCalendar.auth.hasGoogleCalendarConnection);
  const testGoogleCalendarConnection = useAction(api.googleCalendar.auth.testGoogleCalendarConnection);
  // Removed unused generateGoogleOAuthURL action
  
  const removeGoogleCalendarConnection = useAction(api.googleCalendar.auth.removeGoogleCalendarConnection);
  // Removed enable flag usage; backend derives connection from Clerk tokens
  const revokeLegacyGoogleToken = useAction(api.googleCalendar.auth.revokeLegacyGoogleToken);
  const forceDestroyGoogleExternalAccount = useAction(api.googleCalendar.auth.forceDestroyGoogleExternalAccount);
  // Lazy Todoist OAuth URL generation
  const generateTodoistOAuthURL = useAction(api.todoist.auth.generateOAuthURLAction);

  // Connection is derived from Clerk tokens via action; use query-free booleans
  const gcalEnabled = undefined as unknown as boolean | undefined; // deprecated
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [gcalTesting] = useState<boolean>(false);

  const refreshGcalStatus = async () => {
    try {
      setGcalConnected(null); // indicate checking
      const result = await testGoogleCalendarConnection();
      setGcalConnected(!!result?.success);
    } catch (e) {
      console.warn("[Settings] Failed to check Google Calendar connection", e);
      setGcalConnected(false);
    }
  };

  useEffect(() => {
    if (!isUserLoaded || !user) return;
    void refreshGcalStatus();
    const onFocus = () => void refreshGcalStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isUserLoaded, user?.id]);

  const GCAL_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.settings.readonly'
  ];

  const telemetry = (phase: string, extra?: Record<string, any>) => {
    try {
      const url = `${import.meta.env.VITE_CONVEX_URL}/telemetry/oauth-callback`;
      const payload = {
        phase,
        email: user?.primaryEmailAddress?.emailAddress,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        ...extra,
      };
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    } catch {}
  };

  const connectGoogleCalendar = async () => {
    telemetry('connect_start');
    setIsConnecting('Google Calendar');
    try {
      // Ensure Clerk SDK is initialized if available in window
      try { const anyClerk: any = (clerkCtx as any); if (anyClerk?.load) { await anyClerk.load(); } } catch {}
      const redirectUrl = `${window.location.origin}/sso-callback`;
      let verificationUrl: string | undefined;
      let attempts = 0;
      while (!verificationUrl && attempts < 3) {
        // Always fetch a fresh user snapshot
        try { const anyClerk: any = (clerkCtx as any); if (anyClerk?.load) { await anyClerk.load(); } } catch {}
        const latestUser: any = (window as any).Clerk?.user || (clerkCtx as any).user || user;
        const extAcc: any = latestUser?.externalAccounts?.find((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
        if (extAcc?.reauthorize) {
          const updated: any = await extAcc.reauthorize({
            additionalScopes: GCAL_SCOPES,
            oidcPrompt: 'consent select_account',
            redirectUrl,
          });
          const raw = updated?.verification?.externalVerificationRedirectURL as any;
          verificationUrl = typeof raw === 'string' ? raw : raw?.href;
          if (!verificationUrl && String(updated?.verification?.status) === 'verified') {
            // Check if we already have scopes
            try { const anyClerk: any = (clerkCtx as any); if (anyClerk?.load) { await anyClerk.load(); } } catch {}
            const refreshed: any = (window as any).Clerk?.user || (clerkCtx as any).user;
            const acc: any = refreshed?.externalAccounts?.find((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
            const approved = String(acc?.approvedScopes || '');
            const ok = GCAL_SCOPES.every(s => approved.includes(s));
            if (ok) {
              try { await testGoogleCalendarConnection(); } catch {}
              await refreshGcalStatus();
              setIsConnecting(null);
              return;
            }
            // Force another reauthorize prompting consent if scopes still missing
            try {
              const forced: any = await extAcc.reauthorize({
                additionalScopes: GCAL_SCOPES,
                oidcPrompt: 'consent select_account',
                redirectUrl,
              });
              const rawForced = forced?.verification?.externalVerificationRedirectURL as any;
              verificationUrl = typeof rawForced === 'string' ? rawForced : rawForced?.href;
            } catch {}
          }
        } else if (latestUser?.createExternalAccount) {
          const created: any = await latestUser.createExternalAccount({
            strategy: 'oauth_google',
            additionalScopes: GCAL_SCOPES,
            oidcPrompt: 'consent select_account',
            redirectUrl,
          });
          const raw = created?.verification?.externalVerificationRedirectURL as any;
          verificationUrl = typeof raw === 'string' ? raw : raw?.href;
          if (!verificationUrl) {
            // Try reading a refreshed user and see if scopes already present
            try { const anyClerk: any = (clerkCtx as any); if (anyClerk?.load) { await anyClerk.load(); } } catch {}
            const refreshed: any = (window as any).Clerk?.user || (clerkCtx as any).user;
            const acc: any = refreshed?.externalAccounts?.find((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
            const approved = String(acc?.approvedScopes || '');
            const ok = GCAL_SCOPES.every(s => approved.includes(s));
            if (ok) {
              try { await testGoogleCalendarConnection(); } catch {}
              await refreshGcalStatus();
              setIsConnecting(null);
              return;
            }
          }
        }
        attempts++;
      }

      if (!verificationUrl) {
        throw new Error('No verification URL from Clerk. Ensure /sso-callback is in Clerk Allowed Redirect URLs and Google Calendar scopes are permitted.');
      }

      const popup = window.open(verificationUrl, 'gcal-oauth', 'width=500,height=650,scrollbars=yes,resizable=yes');
      if (!popup) {
        setIsConnecting(null);
        alert('Popup was blocked. Click OK to open the Google consent page in a new tab.');
        window.open(verificationUrl, '_blank', 'noopener');
        return;
      }
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setTimeout(async () => {
            try { await testGoogleCalendarConnection(); } catch {}
            await refreshGcalStatus();
            setIsConnecting(null);
          }, 500);
        }
      }, 600);
    } catch (e) {
      console.error('[Settings] Google Calendar connect failed (Clerk flow)', e);
      const msg = (e as any)?.errors?.[0]?.message || (e as any)?.message || 'Unknown error';
      telemetry('connect_error', { error: String(msg) });
      alert(`Failed to start Google Calendar connection: ${msg}`);
      setIsConnecting(null);
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      setIsConnecting('Google Calendar');
      // 1) Remove Clerk external account for Google so next connect requires consent
      const extAcc: any = user?.externalAccounts?.find((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
      if (extAcc && typeof extAcc.destroy === 'function') {
        try { await extAcc.destroy(); } catch {}
      }
      // Server-side enforcement as fallback
      try { await forceDestroyGoogleExternalAccount(); } catch {}
      // 2) Flip enabled flag off in backend (soft disable)
      await removeGoogleCalendarConnection();
      // 3) Revoke and delete any legacy stored refresh token
      try { await revokeLegacyGoogleToken(); } catch {}
      await refreshGcalStatus();
      toast.success('Disconnected Google Calendar');
    } catch (e) {
      console.error('[Settings] Google Calendar disconnect failed', e);
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setIsConnecting(null);
    }
  };

  // (removed unused testGoogleCalendar)

  // PostMessage listener for OAuth popup messages (including account conflicts)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("🔍 [Settings] PostMessage received from origin:", event.origin);
      console.log("🔍 [Settings] Current window origin:", window.location.origin);
      console.log("🔍 [Settings] Message data:", event.data);

      // Security: Only accept messages from expected origins
      // Allow messages from same origin or Convex site domain
      let convexOrigin: string | undefined;
      try {
        const convexUrl = (import.meta as any)?.env?.VITE_CONVEX_URL as string | undefined;
        if (convexUrl) convexOrigin = new URL(convexUrl).origin;
      } catch {}
      const allowedOrigins = [window.location.origin, ...(convexOrigin ? [convexOrigin] : [])];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn("🚫 [Settings] Rejected message from untrusted origin:", event.origin);
        return;
      }

      console.log("✅ [Settings] Message accepted from trusted origin");

      if (event.data?.type === 'TODOIST_ACCOUNT_CONFLICT') {
        console.log("🚨 [Settings] Processing Todoist account conflict");
        console.log("🚨 [Settings] Conflict data:", event.data.data);
        setTodoistConflictData(event.data.data);
        setIsConnecting(null); // Clear connecting state
        console.log("🚨 [Settings] Conflict dialog should now be visible");
      } else if (event.data?.type === 'GCAL_CONNECTED') {
        console.log('✅ [Settings] Google Calendar connected message received');
        setIsConnecting(null);
        // Verify scopes by testing connection before enabling
        testGoogleCalendarConnection().finally(() => { void refreshGcalStatus(); });
      } else if (event.data?.type === 'GCAL_MISSING_SCOPES') {
        console.warn('⚠️ [Settings] Google Calendar missing scopes; prompting re-consent');
        setIsConnecting(null);
        // Ask user to click connect again to avoid silent loops
        toast.message('Google Calendar needs extra permissions. Click Connect again to re-authorize.');
      } else {
        console.log("ℹ️ [Settings] Unhandled message type:", event.data?.type);
      }
    };

    console.log("🔧 [Settings] Setting up PostMessage listener");
    window.addEventListener('message', handleMessage);
    return () => {
      console.log("🔧 [Settings] Removing PostMessage listener");
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  
  const handleTodoistConflictInfo = (conflictData: typeof todoistConflictData) => {
    if (!conflictData) return;

    alert(
      `Todoist Account Already Connected\n\n` +
      `${conflictData.message}\n\n` +
      `Instructions:\n` +
      conflictData.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')
    );

    // Clear conflict data after showing info
    setTodoistConflictData(null);
  };

  const retryTodoistConnection = () => {
    console.log("[Settings] Retrying Todoist connection...");
    void handleConnect("Todoist");
  };

  const connectedApps = [
    {
      appName: "Google Calendar",
      description: (gcalConnected === null)
        ? "Checking Google Calendar status..."
        : (gcalConnected
          ? "Connected to Google Calendar."
          : "Connect Google Calendar to schedule and sync events."),
      iconBgColor: "bg-green-600",
      iconText: "G",
      gradientFrom: undefined,
      gradientTo: undefined,
      isConnected: gcalConnected === true,
      canConnect: gcalConnected !== null,
      isConnecting: isConnecting === 'Google Calendar' || gcalTesting || gcalConnected === null,
      onConnect: () => {
        if (gcalConnected === null) return;
        if (gcalConnected) {
          void disconnectGoogleCalendar();
        } else {
          void connectGoogleCalendar();
        }
      }
    },
    {
      appName: "Todoist",
      description: todoistConflictData 
        ? "Resolve account conflict to connect Todoist."
        : "Connect Todoist to manage your tasks and projects.",
      iconBgColor: "bg-red-500",
      iconText: "T",
      gradientFrom: undefined,
      gradientTo: undefined,
      isConnected: hasTodoistConnection ?? false,
      canConnect: !todoistConflictData, // Disable connection button when there's a conflict
    },
  ];

  const handleConnect = async (appName: string) => {
    if (appName === "Todoist") {
      if (hasTodoistConnection) {
        // Disconnect Todoist
        try {
          await removeTodoistConnection();
        } catch (error) {
          console.error("Failed to disconnect Todoist:", error);
        }
      } else {
        // Connect Todoist
        try {
          setIsConnecting("Todoist");
          // Clear any existing conflict data
          setTodoistConflictData(null);
          const resp = await generateTodoistOAuthURL();
          if (resp?.error || !resp?.url) {
            console.error("Todoist OAuth error:", resp?.error || "missing URL");
            alert("Todoist integration is not properly configured. Please contact support.");
            setIsConnecting(null);
            return;
          }

          const popup = window.open(
            resp.url,
            'todoist-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes'
          );
          
          if (!popup) {
            console.error("Failed to open OAuth popup (blocked by browser)");
            alert("Unable to open authentication window. Please allow popups and try again.");
            setIsConnecting(null);
            return;
          }
          
          // Enhanced popup monitoring with timeout
          let checkCount = 0;
          const maxChecks = 300; // 5 minutes timeout (300 seconds)
          
          const checkClosed = setInterval(() => {
            checkCount++;
            
            try {
              if (popup.closed) {
                clearInterval(checkClosed);
                console.log("🔄 [Settings] Todoist OAuth popup closed, processing result...");
                setTimeout(() => {
                  setIsConnecting(null);
                }, 300);
                return;
              }
              if (checkCount >= maxChecks) {
                clearInterval(checkClosed);
                popup.close();
                console.log("⏰ [Settings] OAuth popup timeout - closing");
                alert("Authentication timed out. Please try again.");
                setIsConnecting(null);
                return;
              }
            } catch (_error) {
              // Ignore cross-origin access errors while monitoring
            }
          }, 1000);
        } catch (err) {
          console.error("Failed to start Todoist OAuth:", err);
          alert("Unable to connect to Todoist. Please try again later.");
          setIsConnecting(null);
        }
      }
    } else {
      console.log(`${appName} integration coming soon...`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--soft-off-white)" }}
        >
          Connected apps
        </h1>
        <p style={{ color: "var(--neutral-stone)" }}>
          Link and manage app connections.
        </p>
      </div>

      
      {/* Todoist Account Conflict Dialog */}
      {todoistConflictData && (
        <div 
          className="p-4 border rounded-lg"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)"
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 
                className="font-semibold mb-2"
                style={{ color: "var(--soft-off-white)" }}
              >
                Todoist Account Already Connected
              </h3>
              <p 
                className="text-sm mb-3"
                style={{ color: "var(--neutral-stone)" }}
              >
                {todoistConflictData.message}
              </p>
              
              <div 
                className="text-sm mb-4"
                style={{ color: "var(--neutral-stone)" }}
              >
                <p className="font-medium mb-1">To connect a different account:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  {todoistConflictData.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleTodoistConflictInfo(todoistConflictData)}
                  style={{
                    backgroundColor: "var(--medium-dark)",
                    borderColor: "var(--color-border)",
                    color: "var(--soft-off-white)"
                  }}
                >
                  Show Instructions
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={retryTodoistConnection}
                  style={{
                    backgroundColor: "var(--medium-dark)",
                    borderColor: "var(--color-border)",
                    color: "var(--soft-off-white)"
                  }}
                >
                  Try Again
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setTodoistConflictData(null)}
                  style={{ color: "var(--neutral-stone)" }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Options */}
      <div className="space-y-4">
        {connectedApps.map((app) => (
          <ConnectedAppItem
            key={app.appName}
            appName={app.appName}
            description={app.description}
            iconBgColor={app.iconBgColor}
            iconText={app.iconText}
            gradientFrom={app.gradientFrom}
            gradientTo={app.gradientTo}
            isConnected={app.isConnected}
            isConnecting={app.isConnecting ?? (isConnecting === app.appName)}
            canConnect={app.canConnect}
            onConnect={app.onConnect ?? (() => void handleConnect(app.appName))}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileSettings() {
  const profile = useQuery(api.userProfiles.getUserProfile);
  const updateProfile = useMutation(api.userProfiles.updateUserProfile);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workingHoursStart, setWorkingHoursStart] = useState("");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("");
  const [timezone, setTimezone] = useState("");

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setPreferredName(profile.preferredName || "");
      setOccupation(profile.occupation || "");
      setWorkingHoursStart(profile.preferredWorkingHours?.start || "");
      setWorkingHoursEnd(profile.preferredWorkingHours?.end || "");
      setTimezone(profile.preferredWorkingHours?.timezone || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        fullName,
        preferredName,
        occupation: occupation || undefined,
      };

      if (workingHoursStart && workingHoursEnd && timezone) {
        updates.preferredWorkingHours = {
          start: workingHoursStart,
          end: workingHoursEnd,
          timezone,
        };
      }

      await updateProfile(updates);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    if (profile) {
      setFullName(profile.fullName || "");
      setPreferredName(profile.preferredName || "");
      setOccupation(profile.occupation || "");
      setWorkingHoursStart(profile.preferredWorkingHours?.start || "");
      setWorkingHoursEnd(profile.preferredWorkingHours?.end || "");
      setTimezone(profile.preferredWorkingHours?.timezone || "");
    }
    setIsEditing(false);
  };

  const COMMON_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--soft-off-white)" }}>
          Profile
        </h1>
        <p style={{ color: "var(--neutral-stone)" }}>
          Loading profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--soft-off-white)" }}>
            Profile
          </h1>
          <p style={{ color: "var(--neutral-stone)" }}>
            Manage your personal information and preferences
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            Edit Profile
          </Button>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: "var(--soft-off-white)" }}>
            Personal Information
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!isEditing}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred Name</Label>
            <Input
              id="preferredName"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              disabled={!isEditing}
              maxLength={50}
            />
            <p className="text-xs" style={{ color: "var(--neutral-stone)" }}>
              How Miller will address you
            </p>
          </div>
        </div>

        {/* Professional */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: "var(--soft-off-white)" }}>
            Professional
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              disabled={!isEditing}
              maxLength={100}
              placeholder="e.g., Software Engineer, Designer, Student"
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: "var(--soft-off-white)" }}>
            Work Preferences
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workingHoursStart">Working Hours - Start</Label>
              <Input
                id="workingHoursStart"
                type="time"
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workingHoursEnd">Working Hours - End</Label>
              <Input
                id="workingHoursEnd"
                type="time"
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select 
              value={timezone} 
              onValueChange={setTimezone}
              disabled={!isEditing}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: "var(--primary-blue)",
                color: "var(--pure-white)",
              }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSettings({ clerkUser, signOut }: { clerkUser: any; signOut: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 
          className="text-2xl font-bold"
          style={{ color: "var(--soft-off-white)" }}
        >
          Account
        </h1>
        <p style={{ color: "var(--neutral-stone)" }}>
          Manage your account settings.
        </p>
      </div>
      
      {/* User Profile */}
      <div 
        className="flex items-center gap-4 p-3 border rounded-lg max-w-md"
        style={{
          backgroundColor: "var(--medium-dark)",
          borderColor: "var(--color-border)"
        }}
      >
        <Avatar className="h-16 w-16">
          <AvatarFallback 
            className="text-2xl font-semibold"
            style={{
              backgroundColor: "var(--primary-blue)",
              color: "var(--pure-white)"
            }}
          >
            {clerkUser?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div 
            className="font-semibold text-base"
            style={{ color: "var(--soft-off-white)" }}
          >
            {clerkUser?.emailAddresses?.[0]?.emailAddress || "User"}
          </div>
          <div style={{ color: "var(--neutral-stone)" }}>
            Member since {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div 
        className="pt-4 p-4 rounded-xl flex flex-col gap-3 items-start"
        style={{ 
          backgroundColor: "transparent",
          border: "1px solid var(--color-border)"
        }}
      >
        <SettingsActionButton 
          icon={LogOut}
          variant="destructive"
          onClick={() => {
            if (confirm("Are you sure you want to sign out?")) {
              signOut();
            }
          }}
        >
          Sign Out
        </SettingsActionButton>
        
        <SettingsActionButton 
          icon={Trash2}
          variant="destructive"
        >
          Delete Account
        </SettingsActionButton>
      </div>
    </div>
  );
}
