import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: "chat" | "tasks" | "projects" | "settings";
  onViewChange: (view: "chat" | "tasks" | "projects" | "settings") => void;
}

export function Sidebar({ isOpen, onClose, activeView, onViewChange }: SidebarProps) {
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const tasks = useQuery(api.tasks.getTasks, { completed: false });

  const menuItems = [
    { 
      id: "chat", 
      label: "AI Chat", 
      icon: "🤖",
      description: "Chat with your AI assistant"
    },
    { 
      id: "tasks", 
      label: "Tasks", 
      icon: "📝",
      count: tasks?.length,
      description: "Manage your tasks"
    },
    { 
      id: "projects", 
      label: "Projects", 
      icon: "📁",
      count: stats?.totalProjects,
      description: "Organize with projects"
    },
    { 
      id: "settings", 
      label: "Settings", 
      icon: "⚙️",
      description: "App preferences"
    },
  ];

  const handleItemClick = (viewId: "chat" | "tasks" | "projects" | "settings") => {
    onViewChange(viewId);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-80 bg-base-100 shadow-xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-64 lg:shadow-none
      `}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-content font-bold text-lg">T</span>
              </div>
              <span className="font-bold text-xl">TaskAI</span>
            </div>
            <button 
              className="btn btn-ghost btn-sm lg:hidden"
              onClick={onClose}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="mb-6 p-4 bg-base-200 rounded-lg">
              <div className="text-sm font-medium text-base-content/70 mb-2">Quick Overview</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="font-semibold text-primary">{stats.totalTasks}</div>
                  <div className="text-base-content/60">Total Tasks</div>
                </div>
                <div>
                  <div className="font-semibold text-success">{stats.completedTasks}</div>
                  <div className="text-base-content/60">Completed</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Menu */}
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id as "chat" | "tasks" | "projects" | "settings")}
                className={`
                  w-full text-left p-3 rounded-lg transition-colors
                  flex items-center gap-3 group
                  ${activeView === item.id 
                    ? 'bg-primary text-primary-content' 
                    : 'hover:bg-base-200'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.label}</span>
                    {item.count !== undefined && (
                      <span className={`
                        badge badge-sm
                        ${activeView === item.id ? 'badge-primary-content' : 'badge-primary'}
                      `}>
                        {item.count}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 ${
                    activeView === item.id 
                      ? 'text-primary-content/70' 
                      : 'text-base-content/60'
                  }`}>
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="text-xs text-base-content/50 text-center">
              TaskAI v1.0 • Powered by Claude
            </div>
          </div>
        </div>
      </div>
    </>
  );
}