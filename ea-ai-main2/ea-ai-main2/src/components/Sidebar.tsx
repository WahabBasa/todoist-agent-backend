import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronRight, Plus, Inbox, Calendar, CalendarClock, Filter, CheckCircle, Hash } from "lucide-react";
import { useState } from "react";
import { UserProfile } from "./nav/UserProfile";
import {
  Sidebar as ShadcnSidebar,
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
} from "./ui/sidebar";

interface SidebarProps {
  activeView: "chat" | "inbox" | "tasks" | "projects" | "settings";
  onViewChange: (view: "chat" | "inbox" | "tasks" | "projects" | "settings") => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const projects = useQuery(api.projects.getProjects);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  // Calculate task counts
  const todayCount = tasks?.filter(task => {
    if (!task.dueDate) return false;
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    return dueDate.toDateString() === today.toDateString();
  }).length || 0;

  const inboxCount = tasks?.filter(task => !task.projectId).length || 0;

  const navigationItems = [
    { 
      id: "inbox", 
      label: "Inbox", 
      icon: Inbox, 
      count: inboxCount
    },
    { 
      id: "tasks", 
      label: "Today", 
      icon: Calendar, 
      count: todayCount,
      isToday: true
    },
    { 
      id: "tasks", 
      label: "Upcoming", 
      icon: CalendarClock
    },
    { 
      id: "tasks", 
      label: "Filters & Labels", 
      icon: Filter
    },
    { 
      id: "tasks", 
      label: "Completed", 
      icon: CheckCircle
    }
  ];

  // Use consistent muted foreground color for all project icons
  const getProjectIconColor = () => "text-muted-foreground";

  const handleItemClick = (viewId: "chat" | "inbox" | "tasks" | "projects" | "settings") => {
    onViewChange(viewId);
  };

  return (
    <ShadcnSidebar collapsible="icon" className="w-[240px] sm:w-[260px] md:w-[280px]">
      {/* App Header */}
      <SidebarHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b border-sidebar-border">
        <h1 className="font-bold text-lg sm:text-xl account-blue-text group-data-[collapsible=icon]:hidden truncate">TaskAI</h1>
        <SidebarTrigger className="h-8 w-8 shrink-0" />
      </SidebarHeader>

      <SidebarContent className="px-2 sm:px-3 py-0">
        {/* Add Task Button */}
        <div className="py-3">
          <Button 
            className="w-full flex items-center gap-2 text-sm font-semibold group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center h-9 shadow-sm btn-primary-blue"
            onClick={() => handleItemClick("tasks")}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden truncate">Add task</span>
          </Button>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="p-0 gap-0">
          <SidebarGroupContent className="gap-0">
            <SidebarMenu className="gap-0">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item.id as "chat" | "inbox" | "tasks" | "projects" | "settings")}
                      isActive={activeView === item.id}
                      className="h-8 sm:h-9 px-3 gap-3 hover:bg-sidebar-accent text-sm font-medium"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <Badge 
                          variant={item.isToday ? "outline" : "secondary"}
                          className="ml-auto h-4 sm:h-5 text-xs shrink-0 px-1.5"
                        >
                          {item.count}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1.5 sm:my-2" />

        {/* Projects Section */}
        <SidebarGroup className="p-0 gap-0">
          <SidebarGroupLabel asChild>
            <Button
              variant="ghost"
              onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              className="w-full justify-between h-8 px-3 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate">My Projects</span>
                <span className="text-xs shrink-0 whitespace-nowrap">{projects?.length || 0}/5</span>
              </div>
              <div className="shrink-0">
                {isProjectsExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </div>
            </Button>
          </SidebarGroupLabel>
          
          {isProjectsExpanded && (
            <SidebarGroupContent className="gap-0">
              <SidebarMenu className="gap-0">
                {projects?.map((project, index) => (
                  <SidebarMenuItem key={project._id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick("projects")}
                      isActive={activeView === "projects"}
                      className="h-8 px-3 gap-3 hover:bg-sidebar-accent text-sm font-medium"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Hash className={`h-4 w-4 shrink-0 ${getProjectIconColor()}`} />
                        <span className="truncate">{project.name}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {/* Add Project Button */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleItemClick("projects")}
                    className="h-8 px-3 gap-3 hover:bg-sidebar-accent text-sidebar-foreground/70 text-sm font-medium"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="truncate">Add project</span>
                    </div>
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
    </ShadcnSidebar>
  );
}