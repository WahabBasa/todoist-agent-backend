import { tool } from "ai";
import { z } from "zod";

// =================================================================
// SHARED PLANNER TOOLS
// Executive assistant capabilities for task and project management
// =================================================================

export const plannerTools = {
  createTask: tool({
    description: "Create a new task in the user's Todoist account. This is the PRIMARY tool for user task requests. EXAMPLES: User says 'Create task to call dentist' → use createTask. User says 'Create these 5 tasks: iron, clean, sweep, cook, shop' → use createTask (5 separate calls). NEVER use internalTodoWrite for user task creation.",
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
    description: "AI WORKFLOW COORDINATION ONLY. Use ONLY for complex multi-system operations requiring systematic coordination. NEVER use for simple user task creation. EXAMPLES: User wants to 'Delete all completed tasks AND reorganize by priority' → use internalTodoWrite for coordination. User wants to 'Create these 5 tasks' → do NOT use this, use createTask instead. This tool is for AI planning, not user task creation.",
    inputSchema: z.object({
      todos: z.array(z.object({
        id: z.string().describe("Unique identifier for the todo item"),
        content: z.string().describe("Brief description of the AI coordination task"),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
        priority: z.enum(["high", "medium", "low"]).describe("Priority level of the task"),
      })).describe("The updated todo list for your internal workflow coordination"),
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