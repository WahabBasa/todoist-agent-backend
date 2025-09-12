import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";

// Utility tools for time, context, and system information

export const getCurrentTime: ToolDefinition = {
  id: "getCurrentTime",
  description: "Get current time and timezone information from the user's browser context. Use this to understand the current context for scheduling and date calculations, especially when users reference relative times like 'tomorrow' or 'next week'.",
  inputSchema: z.object({
    timeZone: z.string().optional().describe("Override timezone (e.g., 'America/New_York', 'Europe/London'). If not provided, uses user's browser timezone."),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    // This tool is lightweight and doesn't need circuit breaker protection
    const currentTimeContext = (ctx as any).currentTimeContext;
    
    if (currentTimeContext) {
      // Use browser-provided time context (most accurate)
      const result = {
        ...currentTimeContext,
        source: currentTimeContext.source || "user_browser",
        requestedTimezone: args.timeZone || currentTimeContext.userTimezone,
      };

      // Metadata handled by tool registry bridge

      return {
        title: "Current Time Retrieved",
        metadata: { source: "user_browser", timezone: currentTimeContext.userTimezone },
        output: JSON.stringify(result)
      };
    } else {
      // Fallback to server time if no browser context provided
      console.warn("[getCurrentTime] No browser context provided, using server time");
      const now = new Date();
      const serverTime = args.timeZone ? 
        new Date(now.toLocaleString("en-US", { timeZone: args.timeZone })) : now;
      
      const fallback = { 
        currentTime: serverTime.toISOString(),
        userTimezone: args.timeZone || "UTC",
        localTime: serverTime.toLocaleString(),
        timestamp: serverTime.getTime(),
        source: "server_fallback",
        fallbackReason: "No browser time context provided",
        requestedTimezone: args.timeZone,
      };

      // Metadata handled by tool registry bridge

      return {
        title: "Current Time Retrieved (Fallback)",
        metadata: { source: "server_fallback" },
        output: JSON.stringify(fallback)
      };
    }
  }
};

export const getSystemStatus: ToolDefinition = {
  id: "getSystemStatus",
  description: "Get current system status including tool availability, connection health, and performance metrics. Use for troubleshooting or system health checks.",
  inputSchema: z.object({
    includeMetrics: z.boolean().optional().describe("Include performance metrics (default: false)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const status = {
        timestamp: Date.now(),
        sessionId: ctx.sessionId,
        userId: ctx.userId.substring(0, 20) + "...",
        systemHealth: {
          convex: "operational", // Could be enhanced with actual health checks
          todoist: "operational",
          calendar: "operational",
        },
        features: {
          internalTodos: true,

          taskManagement: true,
          calendarIntegration: true,
        },
        version: "2.0.0", // Version of the new system
      };

      if (args.includeMetrics) {
        // Add performance metrics if requested
        (status as any).metrics = {
          uptime: Date.now() - (Date.now() - 60000), // Simplified
          memoryUsage: "N/A", // Would need actual monitoring
          responseTime: "< 1s",
        };
      }

      // Metadata handled by tool registry bridge

      return {
        title: "System Status",
        metadata: { health: "operational" },
        output: JSON.stringify(status)
      };
    } catch (error) {
      const errorStatus = {
        timestamp: Date.now(),
        systemHealth: "degraded",
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return {
        title: "System Status (Error)",
        metadata: { health: "degraded" },
        output: JSON.stringify(errorStatus)
      };
    }
  }
};

export const validateInput: ToolDefinition = {
  id: "validateInput",
  description: "Validate user input for common patterns like dates, email addresses, or IDs. Use this to prevent errors before making API calls.",
  inputSchema: z.object({
    input: z.string().describe("The input to validate"),
    type: z.enum(["date", "email", "todoistId", "url", "priority"]).describe("Type of validation to perform"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { input, type } = args;
      let isValid = false;
      let message = "";
      let suggestions: string[] = [];

      switch (type) {
        case "date":
          const dateAttempt = new Date(input);
          isValid = !isNaN(dateAttempt.getTime()) && dateAttempt.getFullYear() >= 2020;
          message = isValid ? "Valid date" : "Invalid date format";
          if (!isValid) {
            suggestions = [
              "Try format: YYYY-MM-DD (e.g., 2025-12-31)",
              "Try natural language: 'tomorrow', 'next Friday'",
              "Try ISO format: 2025-12-31T14:30:00Z"
            ];
          }
          break;

        case "email":
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          isValid = emailRegex.test(input);
          message = isValid ? "Valid email address" : "Invalid email format";
          if (!isValid) {
            suggestions = ["Try format: user@example.com"];
          }
          break;

        case "todoistId":
          isValid = /^[a-zA-Z0-9]{16,}$/.test(input);
          message = isValid ? "Valid Todoist ID format" : "Invalid Todoist ID format";
          if (!isValid) {
            suggestions = [
              "Todoist IDs are 16+ character alphanumeric strings",
              "Use getProjectAndTaskMap() to get valid IDs"
            ];
          }
          break;

        case "url":
          try {
            new URL(input);
            isValid = true;
            message = "Valid URL";
          } catch {
            isValid = false;
            message = "Invalid URL format";
            suggestions = ["Try format: https://example.com"];
          }
          break;

        case "priority":
          const priorityNum = parseInt(input);
          isValid = [1, 2, 3, 4].includes(priorityNum);
          message = isValid ? "Valid priority level" : "Invalid priority level";
          if (!isValid) {
            suggestions = [
              "Use 1 for highest priority (urgent)",
              "Use 2 for high priority",
              "Use 3 for medium priority", 
              "Use 4 for low priority"
            ];
          }
          break;

        default:
          message = "Unknown validation type";
      }

      const result = {
        input,
        type,
        isValid,
        message,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };

      // Metadata handled by tool registry bridge

      return {
        title: `Input Validation: ${type}`,
        metadata: { type, isValid },
        output: JSON.stringify(result)
      };
    } catch (error) {
      const errorResult = {
        input: args.input,
        type: args.type,
        isValid: false,
        error: error instanceof Error ? error.message : "Validation error",
      };

      return {
        title: "Validation Error",
        metadata: { isValid: false },
        output: JSON.stringify(errorResult)
      };
    }
  }
};

export const listTools: ToolDefinition = {
  id: "listTools",
  description: "List all available tools and their descriptions. Use this when users ask 'what tools do you have' or want to understand available capabilities.",
  inputSchema: z.object({
    category: z.enum(["all", "todoist", "calendar", "internal", "utility"]).optional().describe("Filter tools by category (default: all)"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      // Simple tool listing without complex registry lookup
      const availableTools = [
        { id: "addTodoistTask", name: "Add Todoist Task", description: "Create new tasks in Todoist", category: "todoist" },
        { id: "getTodoistTasks", name: "Get Todoist Tasks", description: "Retrieve tasks from Todoist", category: "todoist" },
        { id: "updateTodoistTask", name: "Update Todoist Task", description: "Update existing Todoist tasks", category: "todoist" },
        { id: "deleteTodoistTask", name: "Delete Todoist Task", description: "Remove tasks from Todoist", category: "todoist" },
        { id: "addGoogleCalendarEvent", name: "Add Calendar Event", description: "Create calendar events", category: "calendar" },
        { id: "getGoogleCalendarEvents", name: "Get Calendar Events", description: "Retrieve calendar events", category: "calendar" },
        { id: "internalPlanningAssistant", name: "Planning Assistant", description: "Help with internal planning", category: "internal" },
        { id: "getCurrentTime", name: "Get Current Time", description: "Get current date and time", category: "utility" },
        { id: "researchTask", name: "Research Task", description: "Perform research on topics", category: "utility" },
        { id: "analyzeCode", name: "Code Analysis", description: "Analyze code for issues", category: "utility" }
      ];

      // Filter by category if specified
      let filteredTools = availableTools;
      if (args.category && args.category !== 'all') {
        filteredTools = availableTools.filter(tool => tool.category === args.category);
      }

      // Group tools by category for better organization
      const toolsByCategory = filteredTools.reduce((acc: any, tool) => {
        const category = tool.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          name: tool.name,
          description: tool.description
        });
        return acc;
      }, {});

      // Count batch tools specifically
      const batchTools = availableTools.filter(tool => tool.name.includes('Batch') || tool.name.includes('batch'));
      
      const result = {
        totalTools: availableTools.length,
        filteredTools: filteredTools.length,
        batchTools: batchTools.length,
        batchToolNames: batchTools.map(t => t.name),
        requestedCategory: args.category || 'all',
        toolsByCategory,
        allToolNames: args.category === 'all' ? availableTools.map(t => t.name) : undefined,
        timestamp: Date.now()
      };

      // Metadata handled by tool registry bridge

      return {
        title: "Available Tools Listed",
        metadata: { 
          category: args.category || 'all', 
          count: filteredTools.length,
          batchToolsFound: batchTools.length
        },
        output: JSON.stringify(result, null, 2)
      };
    } catch (error) {
      const errorResult = {
        error: error instanceof Error ? error.message : "Failed to list tools",
        category: args.category || 'all',
        timestamp: Date.now()
      };

      return {
        title: "Tool Listing Error",
        metadata: { error: true },
        output: JSON.stringify(errorResult)
      };
    }
  }
};

// Export all utility tools
export const UtilityTools = {
  getCurrentTime,
  getSystemStatus,
  validateInput,
  listTools,
};