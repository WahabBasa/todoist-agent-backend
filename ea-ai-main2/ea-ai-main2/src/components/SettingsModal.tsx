import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ConnectedAppItem } from "./settings/ConnectedAppItem";
import { 
  User, Settings, Bell, Palette, Link, Shield, 
  AlertTriangle, Download, Trash2, LogOut, X 
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 
  | "general" 
  | "notifications" 
  | "personalization" 
  | "connected-apps" 
  | "data-controls" 
  | "security" 
  | "account";

const SETTINGS_SECTIONS = [
  { id: "general" as const, label: "General", icon: Settings },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "personalization" as const, label: "Personalization", icon: Palette },
  { id: "connected-apps" as const, label: "Connected apps", icon: Link },
  { id: "data-controls" as const, label: "Data controls", icon: Shield },
  { id: "security" as const, label: "Security", icon: Shield },
  { id: "account" as const, label: "Account", icon: User },
];

// Reusable Settings Components
interface SettingsHeaderProps {
  title: string;
  description: string;
}

function SettingsHeader({ title, description }: SettingsHeaderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

interface SettingsSwitchProps {
  label: string;
  description: string;
  badge?: string;
  defaultChecked?: boolean;
}

function SettingsSwitch({ label, description, badge, defaultChecked }: SettingsSwitchProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-foreground font-medium">{label}</Label>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

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
      className={`w-full justify-start gap-3 h-10 ${
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
  const user = useQuery(api.myFunctions.getCurrentUser);
  const { signIn, signOut } = useAuthActions();

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings user={user} />;
      case "notifications":
        return <NotificationsSettings />;
      case "personalization":
        return <PersonalizationSettings />;
      case "connected-apps":
        return <ConnectedAppsSettings />;
      case "data-controls":
        return <DataControlsSettings />;
      case "security":
        return <SecuritySettings />;
      case "account":
        return <AccountSettings user={user} signOut={signOut} />;
      default:
        return <GeneralSettings user={user} />;
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
            <nav className="p-2">
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


function GeneralSettings({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <SettingsHeader 
        title="General"
        description="These settings apply to all workspaces you're a part of."
      />
      
      <div className="space-y-4">
        <SettingsSwitch 
          label="Email notifications"
          description="Get notified about task deadlines and project updates"
          badge="Recommended"
          defaultChecked={true}
        />
        
        <SettingsSwitch 
          label="Desktop notifications"
          description="Show browser notifications for important updates"
        />
        
        <SettingsSwitch 
          label="AI suggestions"
          description="Let AI help optimize your workflow and suggest improvements"
          defaultChecked={true}
        />
      </div>
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div className="space-y-6">
      <SettingsHeader 
        title="Notifications"
        description="Choose what updates you receive and how."
      />
      
      <div className="space-y-4">
        <SettingsSwitch 
          label="Task reminders"
          description="Get reminded about upcoming deadlines"
          defaultChecked={true}
        />
        
        <SettingsSwitch 
          label="Daily summaries"
          description="Receive a daily summary of your tasks and progress"
        />
      </div>
    </div>
  );
}

function PersonalizationSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-foreground">Personalization</h1>
        <p className="text-muted-foreground">
          Customize your TaskAI experience.
        </p>
      </div>
      
      {/* Settings */}
      <div className="space-y-4">
        <div className="space-y-3">
          <Label htmlFor="ai-style" className="text-foreground font-medium">AI response style</Label>
          <Select defaultValue="professional">
            <SelectTrigger id="ai-style" className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="concise">Concise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="task-priority" className="text-foreground font-medium">Default task priority</Label>
          <Select defaultValue="normal">
            <SelectTrigger id="task-priority" className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
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

function ConnectedAppsSettings() {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  
  // Check if Todoist is connected
  const hasTodoistConnection = useQuery(api.todoist.auth.hasTodoistConnection);
  const generateOAuthURL = useQuery(api.todoist.auth.generateOAuthURL);
  const removeTodoistConnection = useMutation(api.todoist.auth.removeTodoistConnection);
  
  // Check if Google Calendar is connected (using new session manager)
  const hasGoogleCalendarConnection = useQuery(api.googleCalendar.sessionManager.hasGoogleCalendarConnection);
  const removeGoogleCalendarConnection = useMutation(api.googleCalendar.sessionManager.removeGoogleCalendarConnection);
  const getOAuthConnectionStatus = useAction(api.googleCalendar.oauthFlow.getOAuthConnectionStatus);
  const initializeGoogleCalendarAfterOAuth = useAction(api.auth.initializeGoogleCalendarAfterOAuth);
  const migrateLegacyTokens = useAction(api.googleCalendar.oauthFlow.migrateLegacyTokens);
  const forceOAuthReconnection = useAction(api.googleCalendar.oauthFlow.forceOAuthReconnection);
  
  // Legacy functions for backward compatibility (during transition)
  const syncGoogleCalendarTokens = useAction(api.googleCalendar.auth.syncGoogleCalendarTokens);
  const debugGoogleAuthAccount = useAction(api.googleCalendar.auth.debugGoogleAuthAccount);

  // Auto-initialize Google Calendar after OAuth if needed  
  useEffect(() => {
    const autoInitializeCalendar = async () => {
      // Only run once per session
      if (hasAutoSynced) return;
      
      // If user has Google connection, try to initialize calendar
      if (hasGoogleCalendarConnection) {
        try {
          console.log("Auto-initializing Google Calendar...");
          const result = await initializeGoogleCalendarAfterOAuth();
          console.log("Google Calendar auto-initialization result:", result);
          setHasAutoSynced(true);
        } catch (error) {
          console.error("Auto-initialization failed:", error);
          // Fall back to legacy sync if needed
          try {
            await syncGoogleCalendarTokens();
            console.log("Fallback sync successful");
            setHasAutoSynced(true);
          } catch (fallbackError) {
            console.error("Fallback sync also failed:", fallbackError);
          }
        }
      }
    };

    autoInitializeCalendar();
  }, [hasGoogleCalendarConnection, initializeGoogleCalendarAfterOAuth, syncGoogleCalendarTokens, hasAutoSynced]);
  
  const connectedApps = [
    {
      appName: "Google Drive",
      description: "Upload Google Docs, Sheets, Slides and other files.",
      iconBgColor: "",
      iconText: "G",
      gradientFrom: "blue-500",
      gradientTo: "green-500",
      isConnected: false,
      canConnect: false,
    },
    {
      appName: "Microsoft OneDrive (personal)",
      description: "Upload Microsoft Word, Excel, PowerPoint and other files.",
      iconBgColor: "bg-blue-600",
      iconText: "O",
      isConnected: false,
      canConnect: false,
    },
    {
      appName: "Microsoft OneDrive (work/school)",
      description: "Upload Microsoft Word, Excel, PowerPoint and other files, including those from SharePoint sites.",
      iconBgColor: "bg-blue-700",
      iconText: "O",
      isConnected: false,
      canConnect: false,
    },
    {
      appName: "Todoist",
      description: "Connect your Todoist account to manage your real tasks and projects through AI conversations.",
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
        // Connect Google Calendar - use Convex Auth OAuth flow
        try {
          setIsConnecting("Google Calendar");
          // This will redirect to Google OAuth with calendar permissions
          await signIn("google");
          // After successful OAuth, tokens will be automatically stored in authAccounts
          // and our session manager will pick them up
        } catch (error) {
          console.error("Failed to initiate Google OAuth:", error);
          alert("Failed to start Google sign-in. Please try again.");
        } finally {
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
        <h1 className="text-lg font-semibold text-primary mb-2">Connected Apps</h1>
        <p className="text-tertiary">
          Connect external services to enhance your AI assistant with additional capabilities and data sources.
        </p>
      </div>
      
      {/* Connection Options */}
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
                    // Get detailed connection status using new session manager
                    const status = await getOAuthConnectionStatus();
                    console.log("Google Calendar connection status:", status);
                    
                    const debugInfo = {
                      "Connection Status": status.isConnected ? "✅ Connected" : "❌ Not Connected",
                      "Has Tokens": status.hasTokens ? "✅ Yes" : "❌ No",
                      "Token Info": status.tokenInfo ? {
                        "Access Token": status.tokenInfo.hasAccessToken ? "✅ Present" : "❌ Missing",
                        "Refresh Token": status.tokenInfo.hasRefreshToken ? "✅ Present" : "❌ Missing",
                        "Token Expired": status.tokenInfo.tokenExpired ? "⚠️ Yes" : "✅ No",
                        "Expires In": status.tokenInfo.expiresIn ? `${Math.floor(status.tokenInfo.expiresIn / 3600)} hours` : "Unknown",
                        "Token Type": status.tokenInfo.tokenType || "Unknown",
                        "Scope": status.tokenInfo.scope || "Unknown"
                      } : "No token data",
                      "Recommendations": status.recommendations
                    };
                    
                    alert(`Google Calendar Debug Info:\n\n${JSON.stringify(debugInfo, null, 2)}`);
                  } catch (error) {
                    console.error("Debug failed:", error);
                    alert(`Debug failed: ${error}`);
                  }
                }}
                onSync={async () => {
                  try {
                    // Try new initialization first
                    console.log("Attempting Google Calendar initialization...");
                    const initResult = await initializeGoogleCalendarAfterOAuth();
                    
                    if (initResult.success) {
                      alert(`✅ Google Calendar initialized successfully!\n${initResult.message}`);
                      return;
                    }
                    
                    // If initialization failed, try legacy migration
                    console.log("Initialization failed, trying legacy migration...");
                    const migrationResult = await migrateLegacyTokens();
                    
                    if (migrationResult.migrated) {
                      alert(`✅ Legacy tokens migrated successfully!\n${migrationResult.message}`);
                      return;
                    }
                    
                    // If migration didn't help, try manual sync as last resort
                    console.log("Migration didn't help, trying manual sync...");
                    const syncResult = await syncGoogleCalendarTokens();
                    alert(`✅ Manual sync successful!\n${syncResult.message}`);
                    
                  } catch (error) {
                    console.error("All sync methods failed:", error);
                    alert(`❌ Sync failed: ${error}\n\nTry disconnecting and reconnecting your Google account.`);
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
    </div>
  );
}

function DataControlsSettings() {
  return (
    <div className="space-y-6">
      <SettingsHeader 
        title="Data controls"
        description="Manage your data and privacy settings."
      />
      
      {/* Actions */}
      <div className="space-y-4">
        <SettingsActionButton icon={Download}>
          Export my data
        </SettingsActionButton>
        
        <SettingsActionButton icon={Trash2}>
          Clear conversation history
        </SettingsActionButton>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <SettingsHeader 
        title="Security"
        description="Keep your account secure."
      />
      
      {/* Settings */}
      <div className="space-y-4">
        <SettingsSwitch 
          label="Two-factor authentication"
          description="Add an extra layer of security to your account"
        />
        
        <div className="pt-4">
          <SettingsActionButton icon={Shield}>
            Change password
          </SettingsActionButton>
        </div>
      </div>
    </div>
  );
}


function AccountSettings({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <div className="space-y-6">
      <SettingsHeader 
        title="Account"
        description="Manage your account settings."
      />
      
      {/* User Profile */}
      <div className="flex items-center gap-4 p-3 border border-border rounded-lg bg-card/30 max-w-md">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold">
            {user?.email?.[0]?.toUpperCase() || "W"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="font-semibold text-base text-foreground">{user?.email || "wahabekky@gmail.com"}</div>
          <div className="text-muted-foreground">
            Member since {new Date().toLocaleDateString()}
          </div>
          <Badge variant="default" className="mt-2 bg-primary/20 text-primary-foreground hover:bg-primary/30">Active</Badge>
        </div>
      </div>
      
      {/* Actions */}
      <div className="space-y-4 pt-4">
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
        
        <p className="text-muted-foreground text-sm leading-relaxed pt-2">
          This action cannot be undone. All your tasks, projects, and data will be permanently deleted.
        </p>
      </div>
    </div>
  );
}