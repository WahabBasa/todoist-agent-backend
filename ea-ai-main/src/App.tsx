import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { ChatInterface } from "./components/ChatInterface";
import { TaskSidebar } from "./components/TaskSidebar";
import { TaskManagement } from "./components/TaskManagement";
import { useState } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Authenticated>
        <TaskSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b shadow-sm">
            <div className="flex justify-between items-center h-16 px-6">
              <h2 className="text-xl font-semibold text-gray-800">Personal AI Assistant</h2>
              <SignOutButton />
            </div>
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === "chat"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                🤖 AI Chat
              </button>
              <button
                onClick={() => setActiveTab("tasks")}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === "tasks"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                📋 Task Management
              </button>
            </div>
          </header>
          <main className="flex-1">
            {activeTab === "chat" ? <ChatInterface /> : <TaskManagement />}
          </main>
        </div>
      </Authenticated>
      
      <Unauthenticated>
        <div className="w-full flex items-center justify-center p-8">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Personal AI Assistant</h1>
              <p className="text-xl text-gray-600">Sign in to manage your tasks and calendar with AI</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
      
      <Toaster />
    </div>
  );
}
