import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { User, Settings, Brain, Shield, AlertTriangle, Download, Trash2, LogOut } from "lucide-react";

export function SettingsView() {
  const user = useQuery(api.myFunctions.getCurrentUser);
  const { signOut } = useAuthActions();
  
  if (user === undefined) {
    return (
      <div className="overflow-y-auto h-full p-4">
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4">
      <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Manage your account and app preferences</p>
      </div>
      
      {/* User Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <span className="text-2xl font-bold">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-lg text-foreground">{user?.email || "User"}</div>
              <div className="text-sm text-muted-foreground">
                Member since {new Date().toLocaleDateString()}
              </div>
              <Badge variant="default" className="mt-1">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* App Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Email notifications</span>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get notified about task deadlines and project updates
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">Desktop notifications</span>
                <p className="text-xs text-muted-foreground">
                  Show browser notifications for important updates
                </p>
              </div>
              <Switch />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">AI suggestions</span>
                <p className="text-xs text-muted-foreground">
                  Let AI help optimize your workflow and suggest improvements
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">Dark mode</span>
                <p className="text-xs text-muted-foreground">
                  Use dark theme for better visibility in low light
                </p>
              </div>
              <Switch />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Response style</label>
            <Select defaultValue="professional">
              <SelectTrigger>
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Default task priority</label>
            <Select defaultValue="normal">
              <SelectTrigger>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">Auto-categorize tasks</span>
                <p className="text-xs text-muted-foreground">
                  Let AI automatically assign tasks to appropriate projects
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Download className="h-4 w-4" />
            Export my data
          </Button>
          
          <Button variant="outline" className="w-full justify-start gap-2">
            <Trash2 className="h-4 w-4" />
            Clear conversation history
          </Button>
        </CardContent>
      </Card>
      
      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                if (confirm("Are you sure you want to sign out?")) {
                  void signOut();
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This action cannot be undone. All your tasks, projects, and data will be permanently deleted.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}