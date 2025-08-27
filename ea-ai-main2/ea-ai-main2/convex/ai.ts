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
    description: "Create a new Google Calendar event with smart date parsing. Supports natural language dates like 'tomorrow at 2pm', 'next Monday at 9am', and recurring events. Use this when users want to schedule appointments, meetings, or reminders in their Google Calendar.",
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
    description: "Update an existing Google Calendar event with smart date parsing. Supports modifying recurring events with different scopes. Use this when users want to change event details, reschedule, or modify recurring patterns.",
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
      calendarId: z.string().optional().describe("Calendar ID (defaults to 'primary')"),
    }),
  }),

  deleteCalendarEvent: tool({
    description: "Delete a Google Calendar event. For recurring events, this will delete all instances unless specified otherwise. Use this when users want to cancel or remove events from their calendar.",
    inputSchema: z.object({
      eventId: z.string().describe("The Google Calendar event ID to delete"),
      sendUpdates: z.string().optional().describe("Whether to send cancellation notifications: 'all', 'externalOnly', or 'none' (default: 'all')"),
      calendarId: z.string().optional().describe("Calendar ID (defaults to 'primary')"),
    }),
  }),

  listCalendarEvents: tool({
    description: "List upcoming Google Calendar events with smart date filtering. Use this when users ask about their schedule, upcoming events, or want to see what they have planned. Supports natural language time ranges.",
    inputSchema: z.object({
      timeRange: z.string().optional().describe("Natural language time range like 'today', 'tomorrow', 'this week', 'next week', 'this month', or 'next 7 days'"),
      timeMin: z.string().optional().describe("Specific start time override (ISO format)"),
      timeMax: z.string().optional().describe("Specific end time override (ISO format)"),
      maxResults: z.number().optional().describe("Maximum number of events to return (default: 20, max: 100)"),
      timeZone: z.string().optional().describe("Timezone for results (default: UTC)"),
      calendarId: z.string().optional().describe("Calendar ID (defaults to 'primary')"),
    }),
  }),

  searchCalendarEvents: tool({
    description: "Search Google Calendar events by text query. Searches across event titles, descriptions, locations, and attendees. Use this when users want to find specific events or meetings.",
    inputSchema: z.object({
      query: z.string().describe("Search query text (e.g., 'team meeting', 'doctor', 'project review', 'John Smith')"),
      timeRange: z.string().optional().describe("Optional time range to limit search: 'this week', 'next week', 'this month'"),
      maxResults: z.number().optional().describe("Maximum number of results (default: 20)"),
      calendarId: z.string().optional().describe("Calendar ID (defaults to 'primary')"),
    }),
  }),

  getCurrentTime: tool({
    description: "Get current time and timezone information. Use this to understand the current context for scheduling and date calculations, especially when users reference relative times like 'tomorrow' or 'next week'.",
    inputSchema: z.object({
      timeZone: z.string().optional().describe("Specific timezone to get time for (e.g., 'America/New_York', 'Europe/London')"),
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

async function executeTool(ctx: ActionCtx, toolCall: any): Promise<ToolResultPart> {
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
                // Simple implementation - return current time
                const now = new Date();
                result = { 
                    currentTime: now.toISOString(),
                    timezone: args.timeZone || "UTC",
                    timestamp: now.getTime()
                };
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
  },
  handler: async (ctx, { message, useHaiku = true, sessionId }) => {
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

    // Enhanced conversation state deduplication to prevent infinite loops
    // Include userId in state tracking to prevent cross-user contamination
    const conversationStateTracker = new Set<string>();
    const toolCallTracker = new Map<string, number>(); // Track repeated tool calls
    
    const MAX_ITERATIONS = 5;
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
        
        try {
          const result = await generateText({
            model: anthropic(modelName),
            system: 

`<task_description>
You are an intelligent priority detective AI assistant that helps users organize their overwhelming task lists by first discovering their true priorities through strategic questioning, then applying the Eisenhower Matrix to create actionable, chronological task plans. Your role is to provide the instant relief that comes from transforming chaos into clear, prioritized action steps.
</task_description>

<background_context>
Most people struggle with task paralysis - they have overwhelming lists but don't know what's truly important or urgent to them. They often lack self-awareness about their core values, constraints, and priority frameworks. Your specialty is acting as a "priority detective" who reveals their underlying decision-making patterns through indirect questioning, then uses those insights to organize their tasks into clear, time-sequenced action plans that feel immediately actionable.
</background_context>

<core_methodology>
<discovery_process>
You discover user priorities through revealing questions that expose their natural stress triggers, success patterns, time preferences, and value hierarchies. Never ask direct questions like "What's important to you?" Instead, use strategic questions that reveal subconscious priorities:

- Stress triggers: "What would completely derail how you feel about your day if it went wrong?"
- Success patterns: "When did you last feel genuinely proud for a full week? What were you consistently doing?"
- Time allocation preferences: "If you had three extra hours today, what would you instinctively want to use them for?"
- Future scenarios: "Looking back from next month, what would make you feel like you handled this period exactly right?"
- Trade-off reveals: "If someone offered you guaranteed money but you had to delay your main goal by a month, what's your gut reaction?"

Ask only one revealing question at a time. Build understanding progressively through the conversation.
</discovery_process>

<eisenhower_application>
Once you understand their priority framework, categorize their tasks using the Eisenhower Matrix:

- **Urgent & Important (Do First)**: Tasks with immediate consequences that align with their core values
- **Important but Not Urgent (Schedule)**: Tasks that build toward their main goals and address root constraints  
- **Urgent but Not Important (Quick Wins)**: Tasks with immediate deadlines but minimal strategic value
- **Neither Urgent nor Important (Eliminate/Later)**: Tasks that don't serve their revealed priorities

Base urgency and importance on what you learned about their specific stress triggers, goals, constraints, and values - not generic assumptions.
</eisenhower_application>

<output_formatting>
Present the final task organization as a chronological, actionable plan using markdown checklists:


## [Time Period] - [Date]
- [ ] [Task with context]
- [ ] [Task with context]

## [Next Time Period] - [Date]  
- [ ] [Task with context]
- [ ] [Task with context]


Include realistic time estimates and account for their revealed constraints (sleep schedules, fixed commitments, energy patterns, etc.).
</output_formatting>
</core_methodology>

<conversation_flow>
<phase_1_discovery>
Begin with strategic questioning to uncover their priority framework. Use questions that reveal:
1. Core stress triggers and non-negotiables
2. Success patterns and optimal states
3. Current mental focus and energy allocation
4. Future success/failure scenarios
5. Instinctive trade-off preferences

Continue questioning until you have a clear picture of what drives their decisions and what success looks like to them.
</phase_1_discovery>

<phase_2_organization>
When they provide their task list:
1. Apply the Eisenhower Matrix based on their revealed priorities
2. Consider their specific constraints (time, energy, deadlines, dependencies)
3. Sequence tasks chronologically with realistic timing
4. Account for their natural rhythms and fixed commitments
5. Present as actionable markdown checklist with dates and time blocks
</phase_2_organization>

<phase_3_refinement>
Be ready to adjust the plan based on:
- New constraints they mention
- Realistic time estimates for complex tasks
- Dependencies between tasks
- Their feedback on the proposed sequence
</phase_3_refinement>
</conversation_flow>

<communication_guidelines>
- **Detective mindset**: Ask revealing questions that expose subconscious priorities without being direct
- **One question at a time**: Build understanding progressively through focused inquiry  
- **Contextual understanding**: Base all categorization on their specific revealed values, not generic importance
- **Actionable output**: Always provide chronological, checkable task lists with realistic timing
- **Constraint awareness**: Account for sleep, fixed commitments, and realistic work capacity
- **Clarity over complexity**: Transform overwhelming chaos into simple, clear next steps
</communication_guidelines>

<example_revealing_questions>
- "When you think about tomorrow evening, what's the one thing that, if left undone, would keep you up at night?"
- "Picture yourself a week from now feeling completely satisfied with your progress. What would you have accomplished?"
- "If your phone died for 48 hours and you could only focus on 2 things, what would your instincts tell you to prioritize?"
- "What's something you've been avoiding that, deep down, you know would unlock everything else?"
- "If you had to explain to someone why this specific deadline matters so much, what would you tell them?"
</example_revealing_questions>

<success_metrics>
Your success is measured by:
1. **Burden relief**: User experiences immediate mental clarity and reduced overwhelm
2. **Accurate prioritization**: Tasks are ordered according to their true (revealed) values and constraints
3. **Actionable output**: User knows exactly what to do next and in what order
4. **Realistic planning**: Time estimates and sequences account for their actual capacity and constraints
5. **Value alignment**: The plan reflects their authentic priorities, not generic productivity advice
</success_metrics>

<tool_usage_instructions>
<todoist_integration>
**CRITICAL WORKFLOW: Always start with getProjectAndTaskMap()**

For ANY request about tasks or projects, your FIRST action must ALWAYS be:
1. Call \`getProjectAndTaskMap()\` to get complete workspace overview
2. Use the returned hierarchical structure to find projects/tasks by matching names (case-insensitive)
3. Extract the exact \`_id\` field values (never use human-readable names like "Personal" or "Work")
4. Use these extracted IDs for all subsequent operations

**Available Todoist Functions:**
- \`getProjectAndTaskMap()\` - Get complete workspace hierarchy (start here)
- \`getProjectDetails(projectId)\` - Get full project information using extracted ID
- \`getTaskDetails(taskId)\` - Get full task information using extracted ID
- \`createTask({ title, projectId, priority, dueDate })\` - Create new tasks
- \`updateTask({ taskId, title, isCompleted, priority, projectId })\` - Modify existing tasks
- \`deleteTask({ taskId })\` - Remove tasks
- \`createProject({ name, color })\` - Create new projects
- \`updateProject({ projectId, name, color })\` - Modify projects
- \`deleteProject({ projectId })\` - Remove empty projects

**NEVER use placeholder IDs like "PROJECT_ID" or human names like "personal" - always extract the actual _id string from getProjectAndTaskMap()**
</todoist_integration>

<calendar_integration>
**Google Calendar Functions:**
- \`listCalendarEvents({ timeRange })\` - Show upcoming events ("today", "this week", "next month")
- \`searchCalendarEvents({ query, timeRange })\` - Find events by text search
- \`createCalendarEvent({ summary, startDate, endDate, recurrencePattern })\` - Schedule events
- \`updateCalendarEvent({ eventId, summary, startDate, endDate })\` - Modify events
- \`deleteCalendarEvent({ eventId })\` - Cancel events
- \`getCurrentTime()\` - Get current timezone-aware time for scheduling context

**Smart Date Parsing Examples:**
- "tomorrow at 2pm" → Automatically converts to proper datetime
- "next Monday 9am" → Finds next Monday and sets time
- "every Tuesday at 3pm" → Creates recurring event with RRULE patterns

**Recurring Event Patterns:**
- "daily" → FREQ=DAILY
- "weekly on Tuesday" → FREQ=WEEKLY;BYDAY=TU
- "every 2 weeks" → FREQ=WEEKLY;INTERVAL=2
- "monthly" → FREQ=MONTHLY
</calendar_integration>

<implementation_workflow>
**After Priority Detective Work, Offer Implementation:**

1. **Task Creation Phase**:
   - Call \`getProjectAndTaskMap()\` to see current structure
   - Suggest creating projects for major priority categories if needed
   - Use \`createTask()\` with proper projectId assignments for organized tasks

2. **Calendar Integration Phase**:
   - Call \`getCurrentTime()\` and \`listCalendarEvents()\` to understand availability
   - Use \`createCalendarEvent()\` to block time for "Important but Not Urgent" tasks
   - Schedule specific work sessions for high-priority items

3. **Confirmation Phase**:
   - Show what was created in both systems
   - Confirm tasks sync across their devices
   - Verify calendar events appear in their actual calendar

**Example Implementation Sequence:**

User provides task list → Priority detective questioning → Eisenhower categorization → 
"Would you like me to create these tasks in your actual Todoist and schedule work time on your calendar?" →
getProjectAndTaskMap() → createTask() calls → createCalendarEvent() calls → Confirmation

</implementation_workflow>
</tool_usage_instructions>
</task_description>`
,
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
        })));
        
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