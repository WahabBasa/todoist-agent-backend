import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export function SettingsView() {
  const user = useQuery(api.myFunctions.getCurrentUser);
  const { signOut } = useAuthActions();
  
  if (user === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-base-content/70">Manage your account and app preferences</p>
      </div>
      
      {/* User Profile */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile
          </h3>
          <div className="flex items-center gap-4">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-16">
                <span className="text-2xl font-bold">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            </div>
            <div>
              <div className="font-semibold text-lg">{user?.email || "User"}</div>
              <div className="text-sm text-base-content/70">
                Member since {new Date().toLocaleDateString()}
              </div>
              <div className="badge badge-primary badge-sm mt-1">Active</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* App Preferences */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">
                  <div className="flex items-center gap-2">
                    <span>Email notifications</span>
                    <div className="badge badge-info badge-xs">Recommended</div>
                  </div>
                </span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
              <div className="text-xs text-base-content/60 mt-1 ml-0">
                Get notified about task deadlines and project updates
              </div>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Desktop notifications</span>
                <input type="checkbox" className="toggle toggle-primary" />
              </label>
              <div className="text-xs text-base-content/60 mt-1 ml-0">
                Show browser notifications for important updates
              </div>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">AI suggestions</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
              <div className="text-xs text-base-content/60 mt-1 ml-0">
                Let AI help optimize your workflow and suggest improvements
              </div>
            </div>

            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Dark mode</span>
                <input type="checkbox" className="toggle toggle-primary" />
              </label>
              <div className="text-xs text-base-content/60 mt-1 ml-0">
                Use dark theme for better visibility in low light
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Settings */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title mb-4">
            <span className="text-xl">🤖</span>
            AI Assistant
          </h3>
          <div className="space-y-4">
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Response style</span>
              </label>
              <select className="select select-bordered w-full">
                <option>Professional</option>
                <option>Casual</option>
                <option>Detailed</option>
                <option>Concise</option>
              </select>
            </div>
            
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Default task priority</span>
              </label>
              <select className="select select-bordered w-full">
                <option value={3}>Normal</option>
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={4}>Low</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Auto-categorize tasks</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
              <div className="text-xs text-base-content/60 mt-1 ml-0">
                Let AI automatically assign tasks to appropriate projects
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Data & Privacy
          </h3>
          <div className="space-y-3">
            <button className="btn btn-outline w-full justify-start">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export my data
            </button>
            
            <button className="btn btn-outline w-full justify-start">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear conversation history
            </button>
          </div>
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="card bg-base-100 shadow-xl border border-error/20">
        <div className="card-body">
          <h3 className="card-title text-error mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Danger Zone
          </h3>
          <div className="space-y-3">
            <button 
              className="btn btn-outline btn-error w-full justify-start"
              onClick={() => {
                if (confirm("Are you sure you want to sign out?")) {
                  void signOut();
                }
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
            
            <button className="btn btn-outline btn-error w-full justify-start">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </button>
          </div>
          <div className="text-xs text-base-content/60 mt-2">
            This action cannot be undone. All your tasks, projects, and data will be permanently deleted.
          </div>
        </div>
      </div>
    </div>
  );
}