import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { ConnectedAppItem } from "../components/settings/ConnectedAppItem";
import { 
  User, Settings, Bell, Palette, Link, Shield, 
  AlertTriangle, Download, Trash2, LogOut, ArrowLeft
} from "lucide-react";

interface SettingsViewProps {
  onBackToChat: () => void;
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

export function SettingsView({ onBackToChat }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  
  // Move Todoist connection query to parent to persist across tab switches
  const hasTodoistConnection = useQuery(api.todoist.auth.hasTodoistConnection);
  const generateOAuthURL = useQuery(api.todoist.auth.generateOAuthURL);
  const removeTodoistConnection = useAction(api.todoist.auth.removeTodoistConnection);

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings clerkUser={clerkUser} />;
      case "notifications":
        return <NotificationsSettings />;
      case "personalization":
        return <PersonalizationSettings />;
      case "connected-apps":
        return <ConnectedAppsSettings 
          clerkUser={clerkUser} 
          signOut={signOut} 
          activeSection={activeSection}
          hasTodoistConnection={hasTodoistConnection}
          generateOAuthURL={generateOAuthURL}
          removeTodoistConnection={removeTodoistConnection}
          isConnecting={isConnecting}
          setIsConnecting={setIsConnecting}
        />;
      case "data-controls":
        return <DataControlsSettings />;
      case "security":
        return <SecuritySettings />;
      case "account":
        return <AccountSettings clerkUser={clerkUser} signOut={signOut} />;
      default:
        return <GeneralSettings clerkUser={clerkUser} />;
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Back to Chat Button - Top Left */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBackToChat}
        className="absolute top-4 left-4 z-10 h-8 px-3 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Chat
      </Button>
      
      {/* Left Navigation Sidebar */}
      <div className="w-[250px] bg-secondary border-r border-border">
        {/* Header */}
        <div className="p-6 pt-16 border-b border-border/30">
          <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        </div>
        
        {/* Navigation */}
        <nav className="p-4">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-design-md transition-colors ${
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
          <div className="p-8 pt-16 max-w-4xl">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}


function GeneralSettings({ clerkUser }: { clerkUser: any }) {
  void clerkUser; // Remove unused parameter warning
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


interface ConnectedAppsSettingsProps {
  clerkUser: any;
  signOut: () => void;
  activeSection: SettingsSection;
  hasTodoistConnection: boolean | undefined;
  generateOAuthURL: any;
  removeTodoistConnection: any;
  isConnecting: string | null;
  setIsConnecting: (value: string | null) => void;
}

function ConnectedAppsSettings({ 
  clerkUser, 
  signOut, 
  activeSection, 
  hasTodoistConnection,
  generateOAuthURL,
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
  





  // PostMessage listener for OAuth popup messages (including account conflicts)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("🔍 [Settings] PostMessage received from origin:", event.origin);
      console.log("🔍 [Settings] Current window origin:", window.location.origin);
      console.log("🔍 [Settings] Message data:", event.data);

      // Security: Only accept messages from expected origins
      // Allow messages from same origin or Convex site domain
      const allowedOrigins = [
        window.location.origin,
        'https://peaceful-boar-923.convex.site'
      ];
      
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
      description: todoistConflictData 
        ? "Account conflict detected. Please resolve the conflict to connect Todoist."
        : "Connect your Todoist account to manage your real tasks and projects through AI conversations.",
      iconBgColor: "bg-red-500",
      iconText: "T",
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
        if (generateOAuthURL?.error) {
          console.error("Todoist OAuth error:", generateOAuthURL.error);
          alert("Todoist integration is not properly configured. Please contact support.");
        } else if (generateOAuthURL?.url) {
          setIsConnecting("Todoist");
          // Clear any existing conflict data
          setTodoistConflictData(null);
          
          // Open OAuth URL in a popup window
          const popup = window.open(
            generateOAuthURL.url,
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
              // Check if popup still exists and is not closed
              if (popup.closed) {
                clearInterval(checkClosed);
                console.log("🔄 [Settings] Todoist OAuth popup closed, processing result...");
                
                // Give a moment for any postMessage to arrive
                setTimeout(() => {
                  // If no conflict data was received, assume success or user cancelled
                  if (!todoistConflictData) {
                    console.log("🔄 [Settings] No conflict detected, refreshing connection status");
                    // The hasTodoistConnection query should automatically refresh
                  }
                  setIsConnecting(null);
                }, 300);
                return;
              }
              
              // Timeout after 5 minutes
              if (checkCount >= maxChecks) {
                clearInterval(checkClosed);
                popup.close();
                console.log("⏰ [Settings] OAuth popup timeout - closing");
                alert("Authentication timed out. Please try again.");
                setIsConnecting(null);
                return;
              }
            } catch (_error) {
              // Popup might be cross-origin and throw errors - this is expected
              // Continue monitoring
            }
          }, 1000);
        } else {
          console.error("No OAuth URL generated");
          alert("Unable to connect to Todoist. Please try again later.");
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

      
      {/* Todoist Account Conflict Dialog */}
      {todoistConflictData && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-design-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Todoist Account Already Connected</h3>
              <p className="text-muted-foreground text-sm mb-3">{todoistConflictData.message}</p>
              
              <div className="text-sm text-muted-foreground mb-4">
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
                  className="bg-background hover:bg-muted"
                >
                  Show Instructions
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={retryTodoistConnection}
                  className="bg-background hover:bg-muted"
                >
                  Try Again
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setTodoistConflictData(null)}
                  className="text-muted-foreground hover:text-foreground"
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
            isConnecting={isConnecting === app.appName}
            canConnect={app.canConnect}
            onConnect={() => void handleConnect(app.appName)}
          />
        ))}
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


function AccountSettings({ clerkUser, signOut }: { clerkUser: any; signOut: () => void }) {
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
            {clerkUser?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="font-semibold text-base text-foreground">{clerkUser?.emailAddresses?.[0]?.emailAddress || "User"}</div>
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