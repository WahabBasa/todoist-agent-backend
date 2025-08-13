import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ChevronDown, Plus, Search, Inbox, Calendar, CalendarClock, Filter, CheckCircle, HelpCircle, Hash } from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: "chat" | "tasks" | "projects" | "settings";
  onViewChange: (view: "chat" | "tasks" | "projects" | "settings") => void;
}

export function Sidebar({ isOpen, onClose, activeView, onViewChange }: SidebarProps) {
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const projects = useQuery(api.projects.getProjects);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  const mainItems = [
    { 
      id: "tasks", 
      label: "Inbox", 
      icon: Inbox,
      count: tasks?.filter(t => !t.projectId)?.length || 0,
    },
    { 
      id: "tasks", 
      label: "Today", 
      icon: Calendar,
      count: 1,
      isToday: true
    },
    { 
      id: "tasks", 
      label: "Upcoming", 
      icon: CalendarClock,
    },
    { 
      id: "tasks", 
      label: "Filters & Labels", 
      icon: Filter,
    },
    { 
      id: "tasks", 
      label: "Completed", 
      icon: CheckCircle,
    },
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
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black transition-opacity duration-300 ease-in-out z-40 lg:hidden
          ${isOpen ? 'opacity-50 visible' : 'opacity-0 invisible'}
        `}
        onClick={onClose}
      />
      
      {/* Fixed Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-80 bg-background border-r border-border shadow-xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:w-80 lg:shadow-lg
      `}>
        <div className="flex flex-col h-full">
          {/* Header - User Profile */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-medium text-sm">A</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm">Abdul</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <div className="h-4 w-4 rounded-full bg-orange-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <div className="h-4 w-4 border border-muted-foreground rounded" />
              </Button>
              <button 
                className="lg:hidden"
                onClick={onClose}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Add Task Button */}
          <div className="p-4">
            <Button 
              className="w-full justify-start gap-2 bg-red-500 hover:bg-red-600 text-white"
              onClick={() => handleItemClick("tasks")}
            >
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search" 
                className="pl-9 h-9 bg-muted/50 border-none"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 space-y-1">
              {/* Main Navigation Items */}
              {mainItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.id}-${item.label}`}
                    onClick={() => handleItemClick(item.id as "chat" | "tasks" | "projects" | "settings")}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg transition-colors
                      flex items-center justify-between group
                      hover:bg-muted/50
                      ${activeView === item.id && item.label === "Inbox" ? 'bg-muted' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded
                        ${item.isToday ? 'text-orange-600' : 'text-muted-foreground'}
                      `}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* My Projects Section */}
              <div className="pt-6">
                <button
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>My Projects</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">USED: {projects?.length || 0}/5</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isProjectsExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isProjectsExpanded && (
                  <div className="mt-2 space-y-1">
                    {projects?.map((project, index) => (
                      <button
                        key={project._id}
                        onClick={() => handleItemClick("projects")}
                        className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 hover:bg-muted/50"
                      >
                        <Hash className={`h-4 w-4 ${projectColors[index % projectColors.length]}`} />
                        <span className="text-sm truncate">{project.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <button className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 hover:bg-muted/50">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Help & resources</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}