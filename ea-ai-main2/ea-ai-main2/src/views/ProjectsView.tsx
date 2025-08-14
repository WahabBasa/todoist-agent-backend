import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ProjectsView() {
  const projects = useQuery(api.projects.getProjects);
  
  if (projects === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-base-content/70">Organize your tasks into projects</p>
        </div>
        <button className="btn btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Project
        </button>
      </div>
      
      {projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p className="text-base-content/70 mb-6">
            Create your first project to organize your tasks and improve your workflow
          </p>
          <div className="space-y-3">
            <button className="btn btn-primary">Create Project</button>
            <div className="text-sm text-base-content/50">
              💡 Try asking the AI: "Create a project for website redesign"
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project._id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <h3 className="card-title text-lg">{project.name}</h3>
                </div>
                
                {project.description && (
                  <p className="text-sm text-base-content/70 mb-4">{project.description}</p>
                )}
                
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm">
                    <span className="font-semibold">{project.taskCount || 0}</span> 
                    <span className="text-base-content/60"> tasks</span>
                  </div>
                  <div className="text-sm text-success">
                    <span className="font-semibold">{project.completedTaskCount || 0}</span>
                    <span className="text-base-content/60"> completed</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-base-300 rounded-full h-2 mb-4">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${project.taskCount > 0 
                        ? (project.completedTaskCount / project.taskCount) * 100 
                        : 0}%`
                    }}
                  ></div>
                </div>
                
                <div className="card-actions justify-end">
                  <button className="btn btn-ghost btn-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                  <button className="btn btn-primary btn-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Total Projects</div>
            <div className="stat-value text-primary">{projects.length}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Total Tasks</div>
            <div className="stat-value text-accent">
              {projects.reduce((total, p) => total + (p.taskCount || 0), 0)}
            </div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Completed Tasks</div>
            <div className="stat-value text-success">
              {projects.reduce((total, p) => total + (p.completedTaskCount || 0), 0)}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}