interface Project {
  _id: string;
  name: string;
  color: string;
  description?: string;
  taskCount: number;
  completedTaskCount: number;
}

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div
          key={project._id}
          className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-800 truncate">
                {project.name}
              </h4>
              {project.description && (
                <p className="text-sm text-gray-600 truncate">
                  {project.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">
                  {project.completedTaskCount}/{project.taskCount} tasks
                </span>
                {project.taskCount > 0 && (
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(project.completedTaskCount / project.taskCount) * 100}%`
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
