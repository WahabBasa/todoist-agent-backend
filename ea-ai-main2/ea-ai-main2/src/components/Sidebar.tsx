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
        fixed top-0 left-0 h-full w-80 bg-base-100 shadow-xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:w-64 lg:shadow-lg
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-base-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-content font-bold text-lg">T</span>
              </div>
              <span className="font-bold text-xl">TaskAI</span>
            </div>
            <button 
              className="btn btn-ghost btn-sm lg:hidden hover:bg-base-200"
              onClick={onClose}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              {stats && (
                <div className="p-4 bg-base-200 rounded-lg">
                  <div className="text-sm font-medium text-base-content/70 mb-3">Quick Overview</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-2xl text-primary">{stats.totalTasks}</div>
                      <div className="text-base-content/60">Total Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-2xl text-success">{stats.completedTasks}</div>
                      <div className="text-base-content/60">Completed</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Menu */}
              <nav className="space-y-2">
                <div className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-3">
                  Navigation
                </div>
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id as "chat" | "tasks" | "projects" | "settings")}
                    className={`
                      w-full text-left p-3 rounded-lg transition-all duration-200
                      flex items-center gap-3 group relative
                      ${activeView === item.id 
                        ? 'bg-primary text-primary-content shadow-sm' 
                        : 'hover:bg-base-200 hover:shadow-sm'
                      }
                    `}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{item.label}</span>
                        {item.count !== undefined && (
                          <span className={`
                            badge badge-sm font-medium
                            ${activeView === item.id ? 'badge-primary-content' : 'badge-primary'}
                          `}>
                            {item.count}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-1 truncate ${
                        activeView === item.id 
                          ? 'text-primary-content/70' 
                          : 'text-base-content/60'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                    {activeView === item.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-content rounded-r"></div>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-base-200">
            <div className="text-xs text-base-content/50 text-center">
              TaskAI v1.0 • Powered by Claude
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}