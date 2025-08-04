interface Task {
  _id: string;
  title: string;
  description?: string;
  priority: number;
  dueDate?: number;
  estimatedTime?: number;
  isCompleted: boolean;
  tags: string[];
  projectName?: string;
}

interface TaskListProps {
  tasks: Task[];
  compact?: boolean;
}

export function TaskList({ tasks, compact = false }: TaskListProps) {
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "text-red-600";
      case 2: return "text-orange-600";
      case 3: return "text-yellow-600";
      case 4: return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const formatDueDate = (dueDate: number) => {
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `${diffDays} days`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task._id}
          className={`p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${
            compact ? "p-2" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium text-gray-800 truncate ${
                compact ? "text-sm" : ""
              }`}>
                {task.title}
              </h4>
              
              {!compact && task.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  P{task.priority}
                </span>
                
                {task.projectName && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {task.projectName}
                  </span>
                )}
                
                {task.dueDate && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    new Date(task.dueDate) < new Date() 
                      ? "bg-red-100 text-red-800" 
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {formatDueDate(task.dueDate)}
                  </span>
                )}
                
                {task.estimatedTime && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {task.estimatedTime < 60 
                      ? `${task.estimatedTime}m` 
                      : `${Math.floor(task.estimatedTime / 60)}h ${task.estimatedTime % 60}m`
                    }
                  </span>
                )}
              </div>
              
              {!compact && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
