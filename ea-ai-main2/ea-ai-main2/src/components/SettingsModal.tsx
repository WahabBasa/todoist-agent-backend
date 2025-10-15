import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ConnectedAppItem } from "./settings/ConnectedAppItem";
import { 
  User, Link, 
  Trash2, LogOut, X 
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 
  | "connected-apps" 
  | "account";

const SETTINGS_SECTIONS = [
  { id: "account" as const, label: "Account", icon: User },
  { id: "connected-apps" as const, label: "Connected Apps", icon: Link },
];

// (removed unused SettingsHeader and SettingsSwitch)

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
      className={`w-auto justify-start gap-2 h-9 text-sm ${
        isDestructive 
          ? 'text-destructive border-destructive/50 hover:bg-destructive/10 hover:border-destructive'
          : 'bg-background hover:bg-muted border-border'
      }`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Button>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const renderContent = () => {
    switch (activeSection) {
      case "connected-apps":
        return <ConnectedAppsSettings clerkUser={clerkUser} signOut={signOut} />;
      case "account":
        return <AccountSettings clerkUser={clerkUser} signOut={signOut} />;
      default:
        return <ConnectedAppsSettings clerkUser={clerkUser} signOut={signOut} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="!w-[700px] h-[650px] !max-w-[700px] p-0 bg-card border-border" 
        showCloseButton={false}
      >
        <div className="flex h-full rounded-design-lg overflow-hidden relative">
          {/* Close Button - Top Right */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 h-8 w-8 p-0 bg-background border border-border rounded-design-md"
          >
            <X className="h-4 w-4" />
          </Button>
          
          {/* Left Navigation Sidebar */}
          <div className="w-[200px] bg-secondary border-r border-border">
            {/* Header */}
            <div className="p-4 border-b border-border/30">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            </div>
            
            {/* Navigation */}
            <nav className="p-2 space-y-3">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-design-md transition-colors ${
                      activeSection === section.id
                        ? 'bg-muted/30 text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
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
              <div className="p-6 pt-4">
                {renderContent()}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





// Google Calendar App Item with debug functionality
interface GoogleCalendarAppItemProps {
  app: any;
  isConnecting: boolean;
  onConnect: () => void;
  onDebug: () => void;
  onSync: () => void;
}

function GoogleCalendarAppItem({ app, isConnecting, onConnect, onDebug, onSync }: GoogleCalendarAppItemProps) {
  return (
    <div className="flex items-center justify-between p-4 border border-border rounded-design-lg bg-background">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-design-md flex items-center justify-center ${
          app.gradientFrom 
            ? `bg-gradient-to-br from-${app.gradientFrom} to-${app.gradientTo}` 
            : app.iconBgColor
        }`}>
          <span className="text-white font-semibold">{app.iconText}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">{app.appName}</h3>
            {app.isConnected && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">Connected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {app.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {app.isConnected && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onDebug}
              className="text-xs px-3 py-1"
            >
              Connection Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              className="text-xs px-3 py-1"
            >
              Refresh Connection
            </Button>
          </>
        )}
        {app.canConnect && (
          <Button
            variant={app.isConnected ? "outline" : "default"}
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
            className="text-xs px-3 py-1"
          >
            {isConnecting ? "Connecting..." : app.isConnected ? "Disconnect" : "Connect"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectedAppsSettings({ clerkUser, signOut }: { clerkUser: any; signOut: () => void }) {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [hasGoogleCalendarConnection, setHasGoogleCalendarConnection] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Check if Todoist is connected
  const hasTodoistConnection = useQuery(api.todoist.auth.hasTodoistConnection);
  const generateOAuthURL = useQuery(api.todoist.auth.generateOAuthURL);
  const removeTodoistConnection = useAction(api.todoist.auth.removeTodoistConnection);
  
  // Google Calendar (Clerk-based OAuth endpoints)
  const checkGoogleCalendarConnection = useAction(api.googleCalendar.auth.hasGoogleCalendarConnection);
  const removeGoogleCalendarConnection = useAction(api.googleCalendar.auth.removeGoogleCalendarConnection);
  const getOAuthConnectionStatus = useAction(api.googleCalendar.auth.testGoogleCalendarConnection);
  // Optional legacy cleanup
  // const migrateLegacyTokens = useAction(api.googleCalendar.auth.revokeLegacyGoogleToken);
  const forceOAuthReconnection = removeGoogleCalendarConnection;

  // Load Google Calendar connection status on component mount
  const loadConnectionStatus = async () => {
    try {
      console.log("ConnectedAppsSettings: Loading Google Calendar connection status...");
      setLoadError(null);
      const isConnected = await checkGoogleCalendarConnection();
      console.log("ConnectedAppsSettings: Google Calendar connection status:", isConnected);
      setHasGoogleCalendarConnection(isConnected);
    } catch (error) {
      console.error("ConnectedAppsSettings: Failed to check Google Calendar connection:", error);
      const name = error instanceof Error ? error.name : undefined;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("ConnectedAppsSettings: Error details:", { name, message, stack });
      setHasGoogleCalendarConnection(false);
      setLoadError(`Failed to load connection status: ${message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("ConnectedAppsSettings: Component mounted, loading connection status...");
    loadConnectionStatus().catch(error => {
      console.error("ConnectedAppsSettings: Failed to load initial connection status:", error);
    });
  }, []);

  // Refresh connection status when user changes (e.g., after OAuth completion)
  useEffect(() => {
    if (clerkUser?.id) {
      console.log("ConnectedAppsSettings: User changed, refreshing connection status...");
      loadConnectionStatus().catch(error => {
        console.error("ConnectedAppsSettings: Failed to refresh connection status on user change:", error);
      });
    }
  }, [clerkUser?.id]); // Re-run when user ID changes

  // TODO: Re-implement Google Calendar auto-initialization with Clerk
  // useEffect(() => {
  //   const autoInitializeCalendar = async () => {
  //     // Only run once per session
  //     if (hasAutoSynced) return;
  //     
  //     // If user has Google connection, try to initialize calendar
  //     if (hasGoogleCalendarConnection) {
  //       try {
  //         console.log("Auto-initializing Google Calendar...");
  //         const result = await initializeGoogleCalendarAfterOAuth();
  //         console.log("Google Calendar auto-initialization result:", result);
  //         setHasAutoSynced(true);
  //       } catch (error) {
  //         console.error("Auto-initialization failed:", error);
  //         // Fall back to legacy sync if needed
  //         try {
  //           await syncGoogleCalendarTokens();
  //           console.log("Fallback sync successful");
  //           setHasAutoSynced(true);
  //         } catch (fallbackError) {
  //           console.error("Fallback sync also failed:", fallbackError);
  //         }
  //       }
  //     }
  //   };

  //   autoInitializeCalendar();
  // }, [hasGoogleCalendarConnection, initializeGoogleCalendarAfterOAuth, syncGoogleCalendarTokens, hasAutoSynced]);
  
  const connectedApps = [
    {
      appName: "Todoist",
      description: "Connect your Todoist account to manage your real tasks and projects through AI conversations. Important: Make sure you're logged into the correct Todoist account before connecting. If connecting multiple users, log out of Todoist first.",
      iconBgColor: "bg-red-500",
      iconText: "T",
      isConnected: hasTodoistConnection ?? false,
      canConnect: true,
    },
    {
      appName: "Google Calendar",
      description: hasGoogleCalendarConnection 
        ? "Your Google Calendar is connected and synced. You can schedule events, check availability, and manage your schedule through AI conversations."
        : "Sign in with your Google account to automatically connect Google Calendar. Calendar access will be enabled automatically.",
      iconBgColor: "",
      iconText: "📅",
      gradientFrom: "blue-500",
      gradientTo: "green-500", 
      isConnected: hasGoogleCalendarConnection ?? false,
      canConnect: true, // Always allow connect/disconnect actions
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
        if (generateOAuthURL?.error) {
          console.error("Todoist OAuth error:", generateOAuthURL.error);
          alert("Todoist integration is not properly configured. Please contact support.");
        } else if (generateOAuthURL?.url) {
          setIsConnecting("Todoist");
          // Open OAuth URL in a popup window
          const popup = window.open(
            generateOAuthURL.url,
            'todoist-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes'
          );
          
          // Listen for the popup to close (successful connection)
          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              setIsConnecting(null);
              // The connection status will update automatically via the query
            }
          }, 1000);
        } else {
          console.error("No OAuth URL generated");
          alert("Unable to connect to Todoist. Please try again later.");
        }
      }
    } else if (appName === "Google Calendar") {
      if (hasGoogleCalendarConnection) {
        // Disconnect Google Calendar
        const shouldDisconnect = confirm(
          "Are you sure you want to disconnect Google Calendar?\n\n" +
          "This will remove calendar access and you'll need to reconnect to use calendar features."
        );
        
        if (shouldDisconnect) {
          try {
            setIsConnecting("Google Calendar");
            await forceOAuthReconnection();
            alert("✅ Google Calendar has been disconnected. You can reconnect anytime in Settings.");
          } catch (error) {
            console.error("Failed to disconnect Google Calendar:", error);
            alert(`❌ Failed to disconnect: ${error}`);
          } finally {
            setIsConnecting(null);
          }
        }
      } else {
        // Guide user to connect Google Calendar via Clerk's social login
        const shouldReconnect = confirm(
          "To connect Google Calendar, you need to sign in with Google.\n\n" +
          "Click OK to sign out and be redirected to sign in with Google, or Cancel to continue without calendar integration."
        );
        
        if (shouldReconnect) {
          // Sign out and redirect to home page where user can sign in with Google
          signOut();
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
        <h1 className="text-2xl font-bold text-primary mb-2">Connected Apps</h1>
        <p className="text-tertiary">
          Connect external services to enhance your AI assistant with additional capabilities and data sources.
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-tertiary">Loading connection status...</div>
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-design-lg">
          <div className="text-destructive text-sm">{loadError}</div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => {
              setIsLoading(true);
              loadConnectionStatus();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Connection Options */}
      {!isLoading && (
        <div className="space-y-4">
        {connectedApps.map((app) => {
          // Special handling for Google Calendar with debug functionality
          if (app.appName === "Google Calendar") {
            return (
              <GoogleCalendarAppItem
                key={app.appName}
                app={app}
                isConnecting={isConnecting === app.appName}
                onConnect={() => handleConnect(app.appName)}
                onDebug={async () => {
                  try {
                    // Get detailed connection status
                    const status = await getOAuthConnectionStatus();
                    console.log("Google Calendar connection status:", status);
                    
                    const debugInfo = {
                      "Connected": status.success ? "✅ Yes" : "❌ No",
                      "Message": (status as any).message || (status as any).error || "",
                      "Tested At": new Date((status as any).testTimestamp).toISOString()
                    };
                    
                    alert(`Google Calendar Debug Info:\n\n${JSON.stringify(debugInfo, null, 2)}`);
                  } catch (error) {
                    console.error("Debug failed:", error);
                    alert(`Debug failed: ${error}`);
                  }
                }}
                onSync={async () => {
                  try {
                    // With Clerk OAuth, the connection should be automatic
                    // Refresh the connection status to see current state
                    console.log("Refreshing Google Calendar connection status...");
                    await loadConnectionStatus();
                    alert(`✅ Connection status refreshed!\n\nIf you just connected your Google account, the connection should now be active.`);
                    
                  } catch (error) {
                    console.error("Refresh failed:", error);
                    alert(`❌ Refresh failed: ${error}`);
                  }
                }}
              />
            );
          }
          
          return (
            <ConnectedAppItem
              key={app.appName}
              appName={app.appName}
              description={app.description}
              iconBgColor={app.iconBgColor}
              iconText={app.iconText}
              gradientFrom={app.gradientFrom}
              gradientTo={app.gradientTo}
              isConnected={app.isConnected}
              isConnecting={isConnecting === app.appName}
              canConnect={app.canConnect}
              onConnect={() => handleConnect(app.appName)}
            />
          );
        })}
        </div>
      )}
    </div>
  );
}




function AccountSettings({ clerkUser, signOut }: { clerkUser: any; signOut: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2 text-foreground">Account</h1>
        <p className="text-muted-foreground">
          Manage your account settings.
        </p>
      </div>
      
      {/* User Profile */}
      <div className="flex items-center gap-4 p-3 border border-border rounded-lg bg-card/30 max-w-md">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold">
            {clerkUser?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="font-semibold text-base text-foreground">{clerkUser?.emailAddresses?.[0]?.emailAddress || "User"}</div>
          <div className="text-muted-foreground">
            Member since {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="pt-4 flex flex-col gap-3 items-start">
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