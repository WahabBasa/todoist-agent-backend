import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ChevronDown, Plus, Search, Inbox, Calendar, CalendarClock, Filter, CheckCircle, HelpCircle, Hash, PanelLeftClose, PanelLeft, MessageSquare, FolderOpen, Workflow, Code } from "lucide-react";
import { useState } from "react";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

interface SidebarProps {
  activeView: "chat" | "tasks" | "projects" | "settings";
  onViewChange: (view: "chat" | "tasks" | "projects" | "settings") => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const projects = useQuery(api.projects.getProjects);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const { open, setOpen, toggleSidebar } = useSidebar();

  const mainItems = [
    { 
      id: "chat", 
      label: "New chat", 
      icon: Plus,
      isNewChat: true
    },
    { 
      id: "chat", 
      label: "Chats", 
      icon: MessageSquare,
    },
    { 
      id: "projects", 
      label: "Projects", 
      icon: FolderOpen,
    },
    { 
      id: "tasks", 
      label: "Tasks", 
      icon: Workflow,
    }
  ];

  const projectColors = [
    "text-blue-500",
    "text-purple-500", 
    "text-green-500",
    "text-orange-500",
    "text-red-500"
  ];

  const handleItemClick = (viewId: "chat" | "tasks" | "projects" | "settings") => {
    onViewChange(viewId);
  };

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="p-0 gap-0">
        {/* App Name and Collapse Button */}
        <div className="flex items-center justify-between px-3 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-2xl">TaskAI</span>
          </div>
          <SidebarTrigger className="h-8 w-8 [&_svg]:size-5 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:[&_svg]:size-6" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Main Navigation */}
        <SidebarGroup className="p-1 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <SidebarGroupContent className="gap-0">
            <SidebarMenu className="gap-0">
              {mainItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={`${item.id}-${item.label}`} className="gap-0">
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item.id as "chat" | "tasks" | "projects" | "settings")}
                      isActive={activeView === item.id}
                      className={`
                        h-[32px] px-2 rounded-md gap-2
                        group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0
                        ${item.isNewChat ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                      `}
                      tooltip={item.label}
                    >
                      <Icon className="h-4 w-4 shrink-0 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        {/* Recents Section - Hidden when collapsed */}
        <SidebarGroup className="p-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 pb-1">
            Recents
          </SidebarGroupLabel>
          <SidebarGroupContent className="gap-0">
            <SidebarMenu className="gap-0">
              <SidebarMenuItem className="gap-0">
                <SidebarMenuButton className="h-[32px] px-2 rounded-md">
                  <span className="truncate text-sm">TaskAI Project Setup</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="gap-0">
                <SidebarMenuButton className="h-[32px] px-2 rounded-md">
                  <span className="truncate text-sm">Sidebar Design Discussion</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="gap-0">
                <SidebarMenuButton className="h-[32px] px-2 rounded-md">
                  <span className="truncate text-sm">React Component Updates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-1 gap-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem className="gap-0">
            <SidebarMenuButton className="h-[32px] px-2 rounded-md gap-2 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" tooltip="User">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:h-7">
                <span className="text-primary-foreground font-medium text-xs">U</span>
              </div>
              <span className="group-data-[collapsible=icon]:hidden text-sm font-medium">User</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}