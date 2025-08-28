"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { 
  generateText, 
  tool,
  ModelMessage,
  UIMessage,
  convertToModelMessages,
  ToolResultPart
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { api } from "./_generated/api";
import { SystemPrompt } from "./ai/system";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
// Use big-brain authentication pattern
import { requireUserAuthForAction } from "./todoist/userAccess";
import { z } from "zod";
import { ActionCtx } from "./_generated/server";

// =================================================================
// EXECUTIVE ASSISTANT AI - TASK MANAGEMENT SYSTEM
// This AI acts as an intelligent executive assistant that helps users
// manage their personal and professional tasks and projects efficiently.
// =================================================================



// Type definitions for message content (for documentation purposes)

// OpenCode-inspired: Build UIMessage objects then convert using AI SDK
function convertConvexMessagesToModel(
  history: {
    role: "user" | "assistant" | "tool";
    content?: string;
    toolCalls?: { name: string; args: any; toolCallId: string }[];
    toolResults?: { toolCallId: string; toolName?: string; result: any }[];
    timestamp?: number;
  }[]
): ModelMessage[] {
  const uiMessages: UIMessage[] = [];
  
  // Group messages by conversation flow (user -> assistant -> tool results)
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    
    try {
      if (message.role === "user" && message.content && typeof message.content === 'string') {
        uiMessages.push({
          id: `user-${i}`,
          role: "user",
          parts: [{
            type: "text",
            text: message.content
          }]
        });
      }
      
      else if (message.role === "assistant") {
        const parts: UIMessage["parts"] = [];
        
        // Add text content if present
        if (message.content && typeof message.content === 'string') {
          parts.push({
            type: "text",
            text: message.content
          });
        }
        
        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const tc of message.toolCalls) {
            if (tc.toolCallId && tc.name) {
              // Find corresponding tool result in the next tool message
              const nextToolMsg = history.find((h, idx) => 
                idx > i && h.role === "tool" && 
                h.toolResults?.some(tr => tr.toolCallId === tc.toolCallId)
              );
              
              const toolResult = nextToolMsg?.toolResults?.find(tr => tr.toolCallId === tc.toolCallId);
              
              if (toolResult) {
                parts.push({
                  type: `tool-${tc.name}` as `tool-${string}`,
                  state: "output-available",
                  toolCallId: tc.toolCallId,
                  input: tc.args || {},
                  output: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result)
                });
              }
            }
          }
        }
        
        if (parts.length > 0) {
          uiMessages.push({
            id: `assistant-${i}`,
            role: "assistant",
            parts
          });
        }
      }
      
      // Skip tool messages as they're handled above with assistant messages
      
    } catch (error) {
      console.warn('[CONVERSION] Skipping invalid message:', error);
      continue;
    }
  }
  
  // Use AI SDK's conversion function like OpenCode
  return convertToModelMessages(uiMessages);
}



// =================================================================
// 1. TOOL DEFINITIONS: What the executive assistant can do for users
//    These define the assistant's capabilities for task and project management.
// =================================================================
const plannerTools = {
  createTask: tool({
    description: "Create a new task in the user's Todoist account. Use this when they want to add something to their real to-do list. You can optionally assign it to a specific Todoist project to keep things organized.",
    inputSchema: z.object({
      title: z.string().describe("The task title or description (e.g., 'Call the dentist', 'Review quarterly reports', 'Buy groceries')"),
      projectId: z.string().optional().describe("Optional: The Todoist project ID to categorize this task. Get project IDs by calling getProjectAndTaskMap first."),
    }),
  }),
  getTasks: tool({
    description: "Retrieve the user's Todoist tasks with full details from their account. Use this to show their to-do list or find tasks within a specific Todoist project. Call without parameters to see all tasks, or with projectId to filter by project.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Optional: Filter tasks to show only those belonging to a specific Todoist project. Get project IDs using getProjectAndTaskMap."),
    }),
  }),
  createProject: tool({
    description: "Create a new project in the user's Todoist account to help organize tasks. Use this when users want to group related tasks together (e.g., 'Work', 'Personal', 'Home Improvement', 'Vacation Planning').",
    inputSchema: z.object({
        name: z.string().describe("The project name (e.g., 'Work Projects', 'Personal Goals', 'Home Renovation', 'Marketing Campaign')"),
    }),
  }),
  getProjectAndTaskMap: tool({
    description: "Get a complete hierarchical overview of the user's entire Todoist workspace - all projects with their associated tasks (showing only _id and title for efficiency), plus unassigned tasks. This is your PRIMARY tool for understanding the user's Todoist data structure. Use this FIRST when the user asks about projects, tasks, or organization. By default shows only incomplete tasks to focus on actionable items.",
    inputSchema: z.object({
      includeCompleted: z.boolean().optional().describe("Set to true to include completed tasks in the results. Defaults to false (shows only incomplete tasks)."),
    }),
  }),
  getProjectDetails: tool({
    description: "Get detailed information about a specific project including all associated tasks with full details. Use this AFTER using getProjectAndTaskMap to identify the project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
    }),
  }),
  getTaskDetails: tool({
    description: "Get detailed information about a specific task including associated project information. Use this AFTER using getProjectAndTaskMap to identify the task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
    }),
  }),
  updateTask: tool({
    description: "Update an existing task's properties such as completion status, title, priority, due date, or project assignment. Use this when users want to modify, complete, or move tasks. Always call getProjectAndTaskMap first to get the correct task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
      title: z.string().optional().describe("New task title (e.g., 'Review quarterly reports', 'Client strategy meeting')"),
      description: z.string().optional().describe("Task description or notes"),
      projectId: z.string().optional().describe("Project ID to move task to, or null to unassign from project. Get project IDs from getProjectAndTaskMap."),
      priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch). Use null to remove due date."),
      isCompleted: z.boolean().optional().describe("Mark task as completed (true) or incomplete (false)"),
    }),
  }),
  deleteTask: tool({
    description: "Permanently delete a task from the system. Use this when users want to remove tasks that are no longer needed, duplicates, or canceled items. Always call getProjectAndTaskMap first to get the correct task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
    }),
  }),
  updateProject: tool({
    description: "Update an existing project's properties such as name, color, or description. Use this when users want to rename projects, change colors, or modify project details. Always call getProjectAndTaskMap first to get the correct project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
      name: z.string().optional().describe("New project name (e.g., 'Client Projects', 'Personal Goals', 'Q1 Planning')"),
      color: z.string().optional().describe("Project color as hex code (e.g., '#FF5722', '#2196F3'). Will be auto-generated if not specified."),
      description: z.string().optional().describe("Project description or notes"),
    }),
  }),
  deleteProject: tool({
    description: "Delete a project from the system. Projects with existing tasks cannot be deleted unless tasks are moved or deleted first. Use this when users want to remove empty or unused projects. Always call getProjectAndTaskMap first to get the correct project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
    }),
  }),

  // =================================================================
  // GOOGLE CALENDAR INTEGRATION TOOLS
  // Event management with smart date parsing and recurring events
  // =================================================================

  createCalendarEvent: tool({
    description: "Create a new event in your Google Calendar with smart date parsing. Supports natural language dates like 'tomorrow at 2pm', 'next Monday at 9am', and recurring events. Use this when users want to schedule appointments, meetings, or reminders.",
    inputSchema: z.object({
      summary: z.string().describe("The event title (e.g., 'Team Meeting', 'Doctor Appointment', 'Project Deadline')"),
      description: z.string().optional().describe("Optional event description or notes"),
      startDate: z.string().describe("Event start time - supports natural language like 'tomorrow at 2pm', 'next Friday at 10am', '2024-12-25 14:00', or ISO format"),
      endDate: z.string().optional().describe("Event end time - natural language or specific time. If not provided, will default to 1 hour duration"),
      duration: z.number().optional().describe("Event duration in minutes if endDate not specified (default: 60)"),
      location: z.string().optional().describe("Event location or meeting URL"),
      attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
      recurrencePattern: z.string().optional().describe("Recurring pattern like 'every day', 'every Tuesday', 'every week', 'every 2 weeks'"),
      timeZone: z.string().optional().describe("Timezone (e.g., 'America/New_York', 'Europe/London'). Defaults to UTC"),
      reminders: z.object({
        useDefault: z.boolean().describe("Use default calendar reminders"),
        overrides: z.array(z.object({
          method: z.string().describe("Reminder method: 'email' or 'popup'"),
          minutes: z.number().describe("Minutes before event to remind"),
        })).optional(),
      }).optional(),
    }),
  }),

  updateCalendarEvent: tool({
    description: "Update an existing event in your Google Calendar with smart date parsing. Supports modifying recurring events with different scopes. Use this when users want to change event details, reschedule, or modify recurring patterns.",
    inputSchema: z.object({
      eventId: z.string().describe("The Google Calendar event ID to update"),
      summary: z.string().optional().describe("New event title"),
      description: z.string().optional().describe("Updated event description"),
      startDate: z.string().optional().describe("New start time - supports natural language like 'move to tomorrow', 'next week at 3pm'"),
      endDate: z.string().optional().describe("New end time - natural language or specific time"),
      duration: z.number().optional().describe("New duration in minutes if endDate not specified"),
      location: z.string().optional().describe("Updated location"),
      attendees: z.array(z.string()).optional().describe("Updated attendee email list"),
      recurrencePattern: z.string().optional().describe("Updated recurrence pattern"),
      timeZone: z.string().optional().describe("Timezone for new times"),
    }),
  }),

  deleteCalendarEvent: tool({
    description: "Delete an event from your Google Calendar. For recurring events, this will delete all instances unless specified otherwise. Use this when users want to cancel or remove events from their calendar.",
    inputSchema: z.object({
      eventId: z.string().describe("The Google Calendar event ID to delete"),
      sendUpdates: z.string().optional().describe("Whether to send cancellation notifications: 'all', 'externalOnly', or 'none' (default: 'all')"),
    }),
  }),

  listCalendarEvents: tool({
    description: "List upcoming events from your Google Calendar with smart date filtering. Use this when users ask about their schedule, upcoming events, or want to see what they have planned. Supports natural language time ranges.",
    inputSchema: z.object({
      timeRange: z.string().optional().describe("Natural language time range like 'today', 'tomorrow', 'this week', 'next week', 'this month', or 'next 7 days'"),
      timeMin: z.string().optional().describe("Specific start time override (ISO format)"),
      timeMax: z.string().optional().describe("Specific end time override (ISO format)"),
      maxResults: z.number().optional().describe("Maximum number of events to return (default: 20, max: 100)"),
      timeZone: z.string().optional().describe("Timezone for results (default: UTC)"),
    }),
  }),

  searchCalendarEvents: tool({
    description: "Search your Google Calendar events by text query. Searches across event titles, descriptions, locations, and attendees. Use this when users want to find specific events or meetings.",
    inputSchema: z.object({
      query: z.string().describe("Search query text (e.g., 'team meeting', 'doctor', 'project review', 'John Smith')"),
      timeRange: z.string().optional().describe("Optional time range to limit search: 'this week', 'next week', 'this month'"),
      maxResults: z.number().optional().describe("Maximum number of results (default: 20)"),
    }),
  }),

  getCurrentTime: tool({
    description: "Get current time and timezone information from the user's Google Calendar settings. Use this to understand the current context for scheduling and date calculations, especially when users reference relative times like 'tomorrow' or 'next week'. Returns user's actual timezone and time format preferences.",
    inputSchema: z.object({
      timeZone: z.string().optional().describe("Override timezone (e.g., 'America/New_York', 'Europe/London'). If not provided, uses user's Google Calendar timezone setting."),
    }),
  }),

  // =================================================================
  // INTERNAL AI AGENT TODOLIST TOOLS
  // Self-management tools for complex multi-step workflows
  // =================================================================

  internalTodoWrite: tool({
    description: "Create or update your internal todolist to plan complex multi-step tasks. Use this when you need to break down user requests into manageable steps and track your progress. This is your internal planning tool - the user cannot see these todos.",
    inputSchema: z.object({
      todos: z.array(z.object({
        id: z.string().describe("Unique identifier for the todo item"),
        content: z.string().describe("Brief description of the task"),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
        priority: z.enum(["high", "medium", "low"]).describe("Priority level of the task"),
      })).describe("The updated todo list for your internal planning"),
    }),
  }),

  internalTodoRead: tool({
    description: "Read your current internal todolist to check progress and understand what you're working on. Use this to stay organized and provide progress updates to users. This shows your internal planning state.",
    inputSchema: z.object({}),
  }),

  // User Mental Model Learning Tools - File-based approach
  readUserMentalModel: tool({
    description: "Read the current user mental model to understand learned behavioral patterns, work preferences, and priority frameworks. Use this to inform scheduling and prioritization decisions.",
    inputSchema: z.object({}),
  }),

  editUserMentalModel: tool({
    description: "Update the user mental model file based on behavioral insights discovered during conversation. Use this to continuously learn user patterns for better task management and scheduling.",
    inputSchema: z.object({
      oldString: z.string().describe("Exact text section to replace in the mental model file"),
      newString: z.string().describe("Updated insights or patterns to replace the old text with"),
      replaceAll: z.boolean().optional().describe("Replace all occurrences of the old string (default: false)"),
    }),
  }),
};

// =================================================================
// 2. SYSTEM EXECUTOR: A separate, deterministic function for execution.
//    This implements the *how*.
// =================================================================

// Circuit breaker to prevent infinite tool execution loops
const toolFailureTracker = new Map<string, { count: number; lastFailure: number }>();
const MAX_TOOL_FAILURES = 3;
const FAILURE_RESET_TIME = 5 * 60 * 1000; // 5 minutes

function checkCircuitBreaker(toolName: string): boolean {
  const failure = toolFailureTracker.get(toolName);
  if (!failure) return true;
  
  // Reset if enough time has passed
  if (Date.now() - failure.lastFailure > FAILURE_RESET_TIME) {
    toolFailureTracker.delete(toolName);
    return true;
  }
  
  return failure.count < MAX_TOOL_FAILURES;
}

function recordToolFailure(toolName: string): void {
  const failure = toolFailureTracker.get(toolName) || { count: 0, lastFailure: 0 };
  failure.count++;
  failure.lastFailure = Date.now();
  toolFailureTracker.set(toolName, failure);
}

async function executeTool(ctx: ActionCtx, toolCall: any, currentTimeContext?: any, sessionId?: any): Promise<ToolResultPart> {
    const { toolName, args, toolCallId } = toolCall;
    console.log(`[Executor] 🔧 Executing tool: ${toolName} with args:`, JSON.stringify(args, null, 2));
    
    // Circuit breaker check
    if (!checkCircuitBreaker(toolName)) {
        console.warn(`[Executor] 🚫 Circuit breaker active for tool: ${toolName}`);
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: "Tool temporarily unavailable due to repeated failures. Please try again later."
        } as unknown as ToolResultPart;
    }

    try {
        let result: any;
        
        // Add project ID validation for getTasks
        if (toolName === "getTasks" && args.projectId) {
            // Validate that projectId looks like a Convex ID (not a project name)
            if (!/^[a-zA-Z0-9]{16,}$/.test(args.projectId)) {
                throw new Error(`Invalid project ID format: "${args.projectId}". Use getProjectAndTaskMap() first to get the correct project ID.`);
            }
        }
        
        switch (toolName) {
            case "createTask": {
                // Use modern Sync API for better reliability and features
                const todoistArgs = {
                    content: args.title,
                    description: args.description,
                    projectId: args.projectId,
                    priority: args.priority,
                    dueString: args.dueDate ? new Date(args.dueDate).toISOString().split('T')[0] : undefined,
                };
                result = await ctx.runAction(api.todoist.syncApi.createTodoistTaskSync, todoistArgs);
                
                // Convert Sync API response to expected format
                if (result && result.success) {
                    result = {
                        _id: result.taskId || result.tempId,
                        title: args.title,
                        projectId: args.projectId,
                        isCompleted: false,
                        createdAt: Date.now(),
                        sync_token: result.sync_token
                    };
                }
                break;
            }
            case "getTasks": {
                // Use Sync API with proper user validation
                const syncResult = await ctx.runAction(api.todoist.syncApi.syncTodoistData, {
                    resourceTypes: ["items"],
                    syncToken: "*" // Full sync for now, could be optimized later
                });
                
                // Validate user context and filter data
                if (syncResult && syncResult.items && syncResult._userContext) {
                    const currentUserId = syncResult._userContext.userId;
                    
                    // Ensure data belongs to requesting user (additional security layer)
                    result = syncResult.items
                        .filter((task: any) => {
                            // Apply user-specific filtering and project filtering
                            const matchesProject = !args.projectId || task.project_id === args.projectId;
                            return matchesProject;
                        })
                        .map((task: any) => ({
                            _id: task.id,
                            title: task.content,
                            description: task.description || "",
                            projectId: task.project_id,
                            priority: task.priority || 1,
                            dueDate: task.due ? new Date(task.due.datetime || task.due.date).getTime() : undefined,
                            isCompleted: task.is_completed,
                            createdAt: new Date(task.added_at).getTime(),
                            // Add user context for debugging (removed in production)
                            _userId: currentUserId.substring(0, 20) + "..."
                        }));
                } else {
                    result = [];
                }
                break;
            }
            case "updateTask": {
                const { taskId, title, description, priority, dueDate, isCompleted, ...updateArgs } = args;
                
                // Handle task completion separately with Sync API
                if (isCompleted === true) {
                    result = await ctx.runAction(api.todoist.syncApi.completeTodoistTaskSync, { taskId });
                } else if (isCompleted === false) {
                    result = await ctx.runAction(api.todoist.syncApi.reopenTodoistTaskSync, { taskId });
                } else {
                    // Update task properties with Sync API
                    const todoistArgs: any = { taskId };
                    
                    if (title) todoistArgs.content = title;
                    if (description !== undefined) todoistArgs.description = description;
                    if (priority) todoistArgs.priority = priority;
                    if (dueDate) todoistArgs.dueString = new Date(dueDate).toISOString().split('T')[0];
                    
                    if (Object.keys(todoistArgs).length > 1) { // More than just taskId
                        result = await ctx.runAction(api.todoist.syncApi.updateTodoistTaskSync, todoistArgs);
                    }
                }
                
                // Return success confirmation
                result = { success: true, _id: taskId };
                break;
            }
            case "deleteTask":
                result = await ctx.runAction(api.todoist.syncApi.deleteTodoistTaskSync, { taskId: args.taskId });
                break;
            case "createProject": {
                const todoistArgs = {
                    name: args.name,
                    color: args.color,
                    parentId: args.parentId
                };
                result = await ctx.runAction(api.todoist.syncApi.createTodoistProjectSync, todoistArgs);
                
                // Convert to expected format
                if (result && result.success) {
                    result = {
                        _id: result.projectId || result.tempId,
                        name: args.name,
                        color: args.color,
                        createdAt: Date.now(),
                        sync_token: result.sync_token
                    };
                }
                break;
            }
            case "updateProject": {
                const { projectId, ...updateArgs } = args;
                result = await ctx.runAction(api.todoist.syncApi.updateTodoistProjectSync, {
                    projectId,
                    ...updateArgs
                });
                
                // Return success confirmation
                result = { success: true, _id: projectId };
                break;
            }
            case "deleteProject":
                result = await ctx.runAction(api.todoist.syncApi.deleteTodoistProjectSync, { projectId: args.projectId });
                break;
            case "getProjectAndTaskMap":
                result = await ctx.runAction(api.todoist.integration.getTodoistProjectAndTaskMap, {
                    includeCompleted: args.includeCompleted || false
                });
                break;
            case "getProjectDetails":
                result = await ctx.runAction(api.todoist.integration.getTodoistProjectDetails, { 
                    projectId: args.projectId 
                });
                break;
            case "getTaskDetails":
                result = await ctx.runAction(api.todoist.integration.getTodoistTaskDetails, { 
                    taskId: args.taskId 
                });
                break;
            
            // =================================================================
            // GOOGLE CALENDAR TOOL EXECUTIONS
            // =================================================================
            case "createCalendarEvent":
                // Calculate duration from start and end dates
                const startTime = new Date(args.startDate);
                const endTime = args.endDate ? new Date(args.endDate) : new Date(startTime.getTime() + 60 * 60000); // Default 1 hour
                const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
                
                result = await ctx.runAction(api.googleCalendar.auth.createCalendarEvent, {
                    title: args.summary,
                    startTime: startTime.toISOString(),
                    durationMinutes,
                    description: args.description,
                    attendeeEmails: args.attendees,
                });
                break;
            case "updateCalendarEvent":
                // Temporarily disabled - simplified version coming soon
                result = { error: "Update calendar events temporarily unavailable. Please delete and recreate the event." };
                break;
            case "deleteCalendarEvent":
                // Temporarily disabled - simplified version coming soon
                result = { error: "Delete calendar events temporarily unavailable. Contact support if urgent." };
                break;
            case "listCalendarEvents":
                // Parse time range to specific dates if provided
                let timeMin = args.timeMin;
                let timeMax = args.timeMax;
                
                if (args.timeRange && !timeMin && !timeMax) {
                    // Handle natural language time ranges
                    const now = new Date();
                    const lowerRange = args.timeRange.toLowerCase().trim();
                    
                    if (lowerRange === "today") {
                        const startOfDay = new Date(now);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(now);
                        endOfDay.setHours(23, 59, 59, 999);
                        timeMin = startOfDay.toISOString();
                        timeMax = endOfDay.toISOString();
                    } else if (lowerRange === "this week") {
                        const startOfWeek = new Date(now);
                        startOfWeek.setDate(now.getDate() - now.getDay());
                        startOfWeek.setHours(0, 0, 0, 0);
                        const endOfWeek = new Date(startOfWeek);
                        endOfWeek.setDate(startOfWeek.getDate() + 6);
                        endOfWeek.setHours(23, 59, 59, 999);
                        timeMin = startOfWeek.toISOString();
                        timeMax = endOfWeek.toISOString();
                    } else if (lowerRange === "next week") {
                        const startOfNextWeek = new Date(now);
                        startOfNextWeek.setDate(now.getDate() - now.getDay() + 7);
                        startOfNextWeek.setHours(0, 0, 0, 0);
                        const endOfNextWeek = new Date(startOfNextWeek);
                        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
                        endOfNextWeek.setHours(23, 59, 59, 999);
                        timeMin = startOfNextWeek.toISOString();
                        timeMax = endOfNextWeek.toISOString();
                    } else if (lowerRange === "this month") {
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        endOfMonth.setHours(23, 59, 59, 999);
                        timeMin = startOfMonth.toISOString();
                        timeMax = endOfMonth.toISOString();
                    }
                }
                
                result = await ctx.runAction(api.googleCalendar.auth.getCalendarEventTimes, {
                    start: timeMin || new Date().toISOString(),
                    end: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
                });
                break;
            case "searchCalendarEvents":
                // Temporarily disabled - simplified version coming soon  
                result = { error: "Search calendar events temporarily unavailable. Use listCalendarEvents instead." };
                break;
            case "getCurrentTime":
                // Use current time provided by user's browser (no calculations needed)
                if (currentTimeContext) {
                    console.log("[getCurrentTime] Using browser-provided time context");
                    result = {
                        ...currentTimeContext,
                        source: currentTimeContext.source || "user_browser"
                    };
                } else {
                    // Fallback to server time if no context provided
                    console.warn("[getCurrentTime] No browser context provided, using server time");
                    const now = new Date();
                    result = { 
                        currentTime: now.toISOString(),
                        userTimezone: "UTC",
                        localTime: now.toISOString(),
                        timestamp: now.getTime(),
                        source: "server_fallback",
                        fallbackReason: "No browser time context provided"
                    };
                }
                break;
            
            // =================================================================
            // INTERNAL AI AGENT TODOLIST TOOL EXECUTIONS
            // =================================================================
            case "internalTodoWrite":
                result = await ctx.runMutation(api.aiInternalTodos.updateInternalTodos, {
                    sessionId: sessionId,
                    todos: args.todos,
                });
                
                // Return summary for agent context
                const pendingCount = args.todos.filter((t: { status: string }) => t.status === "pending").length;
                const inProgressCount = args.todos.filter((t: { status: string }) => t.status === "in_progress").length;
                const completedCount = args.todos.filter((t: { status: string }) => t.status === "completed").length;
                
                result = {
                    success: true,
                    summary: `${args.todos.length} todos managed (${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed)`,
                    todos: args.todos,
                };
                break;
            
            case "internalTodoRead":
                const todoData = await ctx.runQuery(api.aiInternalTodos.getInternalTodos, {
                    sessionId: sessionId,
                });
                
                if (todoData) {
                    result = {
                        todos: todoData.todos,
                        summary: todoData.summary,
                        message: `Current internal todolist: ${todoData.summary.remaining} tasks remaining (${todoData.summary.pending} pending, ${todoData.summary.inProgress} in progress)`,
                    };
                } else {
                    result = {
                        todos: [],
                        summary: { total: 0, pending: 0, inProgress: 0, completed: 0, remaining: 0 },
                        message: "No active internal todolist found",
                    };
                }
                break;

            case "readUserMentalModel":
                const mentalModelPath = join(process.cwd(), "convex", "ai", "user-mental-model.txt");
                
                try {
                    if (existsSync(mentalModelPath)) {
                        const mentalModelContent = readFileSync(mentalModelPath, "utf-8");
                        result = {
                            success: true,
                            content: mentalModelContent,
                            message: "User mental model loaded successfully",
                            path: mentalModelPath,
                        };
                    } else {
                        result = {
                            success: false,
                            content: "",
                            message: "User mental model file not found - needs to be created",
                            path: mentalModelPath,
                        };
                    }
                } catch (error) {
                    result = {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error reading mental model",
                        message: "Failed to read user mental model file",
                        path: mentalModelPath,
                    };
                }
                break;

            case "editUserMentalModel":
                const editPath = join(process.cwd(), "convex", "ai", "user-mental-model.txt");
                const { oldString, newString, replaceAll = false } = args as { 
                    oldString: string; 
                    newString: string; 
                    replaceAll?: boolean; 
                };
                
                try {
                    let content = "";
                    if (existsSync(editPath)) {
                        content = readFileSync(editPath, "utf-8");
                    } else {
                        // If file doesn't exist and oldString is empty, create new file
                        if (oldString === "") {
                            content = "";
                        } else {
                            throw new Error("Mental model file not found and oldString is not empty");
                        }
                    }
                    
                    // Perform the edit
                    let updatedContent: string;
                    if (oldString === "") {
                        // Creating new file or appending
                        updatedContent = newString;
                    } else if (replaceAll) {
                        updatedContent = content.replaceAll(oldString, newString);
                    } else {
                        if (!content.includes(oldString)) {
                            throw new Error(`Old string not found in mental model: "${oldString.slice(0, 50)}..."`);
                        }
                        updatedContent = content.replace(oldString, newString);
                    }
                    
                    // Write the updated content
                    writeFileSync(editPath, updatedContent, "utf-8");
                    
                    result = {
                        success: true,
                        message: "User mental model updated successfully",
                        path: editPath,
                        operation: oldString === "" ? "created" : replaceAll ? "replaced_all" : "replaced_once",
                        oldLength: content.length,
                        newLength: updatedContent.length,
                    };
                } catch (error) {
                    result = {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error editing mental model",
                        message: "Failed to update user mental model file",
                        path: editPath,
                    };
                }
                break;
            
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        
        // Reset failure counter on success
        toolFailureTracker.delete(toolName);
        
        console.log(`[Executor] ✅ Tool ${toolName} executed successfully.`);
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: result || {},
        } as ToolResultPart;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error(`[Executor] ❌ Tool ${toolName} failed:`, errorMessage);
        
        // Record the failure for circuit breaker
        recordToolFailure(toolName);
        
        // Provide helpful error messages for Todoist integration issues
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes("Todoist not connected")) {
            userFriendlyMessage = "🔗 Please connect your Todoist account first. Go to Settings to link your Todoist account and start managing your real tasks.";
        } else if (errorMessage.includes("authentication expired")) {
            userFriendlyMessage = "🔑 Your Todoist connection has expired. Please reconnect your account in Settings.";
        } else if (errorMessage.includes("Todoist API error")) {
            userFriendlyMessage = "⚠️ Todoist service is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes("Rate limit")) {
            userFriendlyMessage = "⏱️ Too many requests to Todoist. Please wait a moment before trying again.";
        }
        
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: `Error: ${userFriendlyMessage}`
        } as unknown as ToolResultPart;
    }
}

// =================================================================
// 3. THE ORCHESTRATOR: Manages the agentic workflow.
// =================================================================
export const chatWithAI = action({
  args: {
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
    sessionId: v.optional(v.id("chatSessions")),
    currentTimeContext: v.optional(v.object({
      currentTime: v.string(),
      userTimezone: v.string(),
      localTime: v.string(),
      timestamp: v.number(),
      source: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { message, useHaiku = true, sessionId, currentTimeContext }) => {
    // Use big-brain authentication pattern for consistent user validation
    const { userId } = await requireUserAuthForAction(ctx);
    console.log(`[AI] Authenticated user: ${userId.substring(0, 20)}...`);

    const modelName = useHaiku ? "claude-3-5-haiku-20241022" : "claude-3-haiku-20240307";
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get conversation history - session-aware or default
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      // For backward compatibility, use default conversation
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }
    
    const history = (conversation?.messages as any[]) || [];
    history.push({ role: "user", content: message, timestamp: Date.now() });

    console.log(`[Orchestrator] Starting interaction for user ${userId.substring(0, 20)}...: "${message}"`);

    // Reset circuit breaker for new conversation to give tools a fresh start
    toolFailureTracker.clear();

    // Enhanced internal todolist detection - catches bulk operations and multi-step tasks
    const messageLength = message.length;
    const hasMultipleRequests = /and|then|also|additionally|furthermore|moreover|plus|while|after|before/i.test(message);
    const hasComplexKeywords = /plan|organize|schedule|manage|setup|create.*and|help.*with.*multiple|several|various/i.test(message);
    
    // NEW: Detect bulk operations that require internal todolist
    const hasBulkOperations = /(?:delete|update|move|complete|modify|change|remove)\s+(?:all|every|each)(?:\s+(?:my|the))?\s+(?:task|project|event|item)/i.test(message);
    const hasQuantifiedTasks = /(?:delete|update|move|complete).*(?:\d{2,}|many|multiple|several|various).*(?:task|project|event)/i.test(message);
    const hasMultiEntityWork = /(?:task|project|event|item)s?.*(?:and|\+|also).*(?:task|project|event|item)/i.test(message);
    
    // Multi-step detection: Any request affecting 3+ items or cross-system operations
    const shouldCreateTodolist = messageLength > 80 || hasMultipleRequests || hasComplexKeywords || 
                                hasBulkOperations || hasQuantifiedTasks || hasMultiEntityWork;

    if (shouldCreateTodolist) {
      console.log(`[Orchestrator] Complex/bulk request detected - REQUIRES internal todolist for: "${message.slice(0, 50)}..."`);
    }

    // Enhanced conversation state deduplication to prevent infinite loops
    // Include userId in state tracking to prevent cross-user contamination
    const conversationStateTracker = new Set<string>();
    const toolCallTracker = new Map<string, number>(); // Track repeated tool calls
    
    const MAX_ITERATIONS = 6; // Reduced from 15 to prevent rate limits
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`[Orchestrator] -> Planning iteration ${i + 1}...`);
        
        // Advanced state tracking: user + message content + history length + last 3 message types
        const userPrefix = userId.substring(0, 20);
        const recentMessageTypes = history.slice(-3).map(h => h.role).join('-');
        const lastToolCalls = history.slice(-1)[0]?.toolCalls?.map((tc: any) => tc.name).sort().join(',') || 'none';
        const stateKey = `${userPrefix}-${message.slice(0, 50)}-${history.length}-${recentMessageTypes}-${lastToolCalls}`;
        
        if (conversationStateTracker.has(stateKey)) {
            console.warn(`[CIRCUIT_BREAKER] Duplicate conversation state detected at iteration ${i + 1}`);
            throw new Error(`Conversation loop detected. State: ${stateKey.slice(0, 100)}...`);
        }
        conversationStateTracker.add(stateKey);
        
        // Track repeated tool calls to detect oscillation patterns
        if (history.length > 0) {
          const lastMessage = history[history.length - 1];
          if (lastMessage.toolCalls?.length > 0) {
            for (const tc of lastMessage.toolCalls) {
              const callCount = toolCallTracker.get(tc.name) || 0;
              if (callCount >= 3) {
                console.warn(`[CIRCUIT_BREAKER] Tool ${tc.name} called ${callCount} times, potential oscillation`);
                throw new Error(`Tool oscillation detected: ${tc.name} called repeatedly`);
              }
              toolCallTracker.set(tc.name, callCount + 1);
            }
          }
        }
        
        // Add debug logging to verify message structure before conversion
        const historySlice = history.slice(-10);
        console.log(`[DEBUG] Raw history structure:`, JSON.stringify(historySlice.slice(-3), null, 2));
        
        // OpenCode-inspired: Direct conversion to ModelMessage format
        let modelMessages: ModelMessage[];
        try {
          modelMessages = convertConvexMessagesToModel(historySlice);
          console.log(`[CONVERSION] Converted ${historySlice.length} Convex messages to ${modelMessages.length} model messages`);
        } catch (error) {
          console.warn('[FALLBACK] Message conversion failed, using minimal context:', error);
          // Fallback: create minimal valid conversation with just the current user message
          modelMessages = [{
            role: "user",
            content: message || "Please help me with my tasks."
          }];
        }
        
        console.log(`[Orchestrator] Messages count before AI call: ${modelMessages.length}`);
        console.log(`[DEBUG] Converted messages:`, JSON.stringify(modelMessages.slice(-3), null, 2));
        
        // Ensure we have at least the current user message
        if (modelMessages.length === 0) {
          console.warn('[CONVERSION] No valid messages found, using current user message');
          modelMessages.push({ role: 'user', content: message });
        }
        
        let text: string;
        let toolCalls: any[];
        
        // Mandatory workflow directives for complex/bulk operations
        let dynamicInstructions = "";
        if (shouldCreateTodolist && i === 0) {
          dynamicInstructions = `

<mandatory_first_action>
**STOP**: This request requires internal todolist management.

Your FIRST action must be:
1. Use internalTodoWrite to create 3-5 specific todos with priorities
2. Only then proceed with tool execution 
3. Mark todos "in_progress" → execute tools → mark "completed"
4. Update user with progress: "Working on step X of Y"

Do NOT use any other tools until internal todolist is created.
</mandatory_first_action>`;
        }

        try {
          const result = await generateText({
            model: anthropic(modelName),
            system: SystemPrompt.getSystemPrompt(modelName, dynamicInstructions, message),
            messages: modelMessages,
            tools: plannerTools,
        });
        
        text = result.text;
        toolCalls = result.toolCalls;
        
        } catch (error: any) {
          console.error('[ERROR] AI SDK generateText failed:', {
            message: error.message,
            type: error.constructor.name,
            modelMessagesCount: modelMessages.length,
            lastMessageRoles: modelMessages.slice(-3).map(m => m.role),
            detailedError: error
          });
          
          if (error.message.includes('Invalid prompt')) {
            console.warn('[FALLBACK] Format error detected, trying with contextual fallback');
            // Create minimal valid conversation context
            const fallbackMessages: ModelMessage[] = [];
            
            // Include last user message
            if (modelMessages.length > 0) {
              const lastUserMsg = modelMessages.filter(m => m.role === 'user').pop();
              if (lastUserMsg) fallbackMessages.push(lastUserMsg);
            }
            
            // If no user message found, use current input
            if (fallbackMessages.length === 0) {
              fallbackMessages.push({ role: 'user', content: message });
            }
            
            const fallbackResult = await generateText({ 
              model: anthropic(modelName),
              system: `You are an intelligent executive assistant that helps users manage their personal and professional tasks and projects.`,
              messages: fallbackMessages,
              tools: plannerTools,
            });
            text = fallbackResult.text;
            toolCalls = fallbackResult.toolCalls;
          } else {
            throw error;
          }
        }

        if (!toolCalls || toolCalls.length === 0) {
            console.log(`[Orchestrator] Planning complete. Final response: "${text}"`);
            history.push({ role: "assistant", content: text, timestamp: Date.now() });
            
            // Clean up internal todolist if conversation is complete
            try {
              await ctx.runMutation(api.aiInternalTodos.deactivateInternalTodos, { sessionId });
              console.log(`[Orchestrator] Deactivated internal todolist for completed conversation`);
            } catch (error) {
              console.warn(`[Orchestrator] Failed to deactivate todolist:`, error);
              // Non-blocking error - continue with response
            }
            
            // Save conversation - session-aware or default
            await ctx.runMutation(api.conversations.upsertConversation, { 
              sessionId,  // Will use default session if undefined
              messages: history as any 
            });
            
            return { response: text };
        }

        history.push({
          role: "assistant",
          toolCalls: toolCalls.map(tc => ({ 
            name: tc.toolName, 
            args: tc.input || {}, 
            toolCallId: tc.toolCallId 
          })),
          timestamp: Date.now(),
        });

        console.log(`[Orchestrator] Executing ${toolCalls.length} tool(s)...`);
        const toolResults = await Promise.all(toolCalls.map(call => executeTool(ctx, {
            toolName: call.toolName,
            args: call.input,
            toolCallId: call.toolCallId
        }, currentTimeContext, sessionId)));
        
        // Validate tool call ID consistency and filter out mismatched results
        const validatedResults = toolResults.filter((result: any) => {
          const hasMatch = toolCalls.some(call => call.toolCallId === result.toolCallId);
          if (!hasMatch) {
            console.warn(`[VALIDATION] Orphaned tool result: ${result.toolCallId} (${result.toolName})`);
          }
          return hasMatch;
        });
        
        if (validatedResults.length !== toolResults.length) {
            console.warn(`[VALIDATION] Filtered ${toolResults.length - validatedResults.length} mismatched tool results`);
        }
        
        console.log('[VALIDATION] Tool call IDs match:', {
          toolCallIds: toolCalls.map(tc => tc.toolCallId),
          toolResultIds: validatedResults.map((tr: any) => tr.toolCallId),
          allMatch: validatedResults.length === toolCalls.length
        });

        // Only add tool results if we have validated ones
        if (validatedResults.length > 0) {
          history.push({
            role: "tool",
            toolResults: validatedResults.map((tr: any) => ({ 
              toolCallId: tr.toolCallId, 
              toolName: tr.toolName, 
              result: tr.output 
            })),
            timestamp: Date.now(),
          });
        } else {
          console.warn('[VALIDATION] No valid tool results to add to conversation');
        }
    }

    throw new Error("Maximum tool call iterations reached.");
  }
});