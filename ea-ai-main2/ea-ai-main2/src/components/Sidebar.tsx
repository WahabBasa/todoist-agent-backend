import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronRight, Plus, Inbox, MessageSquare, CheckCircle, Hash } from "lucide-react";
import { useState } from "react";
import { UserProfile } from "./nav/UserProfile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarRail,
} from "./ui/sidebar";

interface AppSidebarProps {
  activeView: "chat" | "inbox" | "tasks" | "projects";
  onViewChange: (view: "chat" | "inbox" | "tasks" | "projects") => void;
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const projects = useQuery(api.projects.getProjects);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  // Calculate task counts
  const inboxCount = tasks?.filter(task => !task.projectId).length || 0;

  const navigationItems = [
    { 
      id: "chat", 
      label: "Chat", 
      icon: MessageSquare
    },
    { 
      id: "inbox", 
      label: "Inbox", 
      icon: Inbox, 
      count: inboxCount
    },
    { 
      id: "tasks", 
      label: "Completed", 
      icon: CheckCircle
    }
  ];

  const handleItemClick = (viewId: "chat" | "inbox" | "tasks" | "projects") => {
    onViewChange(viewId);
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      {/* App Header */}
      <SidebarHeader className="flex flex-row justify-between items-center">
        <h1 className="font-semibold text-sm px-2 py-3 group-data-[collapsible=icon]:hidden">TaskAI</h1>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        {/* New Chat Button */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => handleItemClick("chat")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              tooltip="New Chat"
            >
              <Plus className="size-4" />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Main Navigation */}
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  onClick={() => handleItemClick(item.id as "chat" | "inbox" | "tasks" | "projects")}
                  isActive={activeView === item.id}
                  tooltip={item.label}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <Badge 
                      variant="secondary"
                      className="ml-auto h-5 px-1.5 text-xs"
                    >
                      {item.count}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <SidebarSeparator />

        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <Button
              variant="ghost"
              onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              className="w-full justify-between px-2 hover:bg-sidebar-accent"
            >
              <div className="flex items-center gap-2">
                <span>My Projects</span>
                <span className="text-xs text-muted-foreground">{projects?.length || 0}/5</span>
              </div>
              {isProjectsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </SidebarGroupLabel>
          
          {isProjectsExpanded && (
            <SidebarGroupContent>
              <SidebarMenu>
                {projects?.map((project, index) => (
                  <SidebarMenuItem key={project._id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick("projects")}
                      isActive={activeView === "projects"}
                      tooltip={project.name}
                    >
                      <Hash className="size-4 text-muted-foreground" />
                      <span>{project.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {/* Add Project Button */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleItemClick("projects")}
                    tooltip="Add project"
                  >
                    <Plus className="size-4" />
                    <span>Add project</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      {/* Account at Bottom */}
      <SidebarFooter>
        <UserProfile />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}