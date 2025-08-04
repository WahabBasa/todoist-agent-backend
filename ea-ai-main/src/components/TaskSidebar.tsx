import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskList } from "./TaskList";
import { ProjectList } from "./ProjectList";
import { TaskCreationForm } from "./TaskCreationForm";
import { ProjectCreationForm } from "./ProjectCreationForm";

export function TaskSidebar() {
  const tasks = useQuery(api.tasks.getTasks, { completed: false });
  const upcomingTasks = useQuery(api.tasks.getUpcomingTasks, { days: 7 });
  const projects = useQuery(api.projects.getProjects);

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
      </div>
      
      <TaskCreationForm />
      
      <div className="flex-1 overflow-y-auto">
        {/* Quick Stats */}
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tasks?.length || 0}
              </div>
              <div className="text-gray-500">Active Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {upcomingTasks?.length || 0}
              </div>
              <div className="text-gray-500">Due Soon</div>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-800 mb-3">Due This Week</h3>
          {upcomingTasks && upcomingTasks.length > 0 ? (
            <TaskList tasks={upcomingTasks.slice(0, 5)} compact />
          ) : (
            <p className="text-sm text-gray-500">No upcoming tasks</p>
          )}
        </div>

        {/* Projects */}
        <div className="border-b border-gray-100">
          <div className="p-4 pb-3">
            <h3 className="font-medium text-gray-800 mb-3">Projects</h3>
            {projects && projects.length > 0 ? (
              <ProjectList projects={projects} />
            ) : (
              <p className="text-sm text-gray-500 mb-3">No projects yet</p>
            )}
          </div>
          <ProjectCreationForm />
        </div>

        {/* Recent Tasks */}
        <div className="p-4">
          <h3 className="font-medium text-gray-800 mb-3">Recent Tasks</h3>
          {tasks && tasks.length > 0 ? (
            <TaskList tasks={tasks.slice(0, 5)} compact />
          ) : (
            <p className="text-sm text-gray-500">No active tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}
