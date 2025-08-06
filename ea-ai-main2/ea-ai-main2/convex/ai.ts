import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText, tool, CoreMessage, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { z } from "zod";
import { Id, Doc } from "./_generated/dataModel";
import { ActionCtx } from "./_generated/server";

// Create configured Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to create a typed set of tools
const defineTools = (ctx: ActionCtx) => ({
  createTask: tool({
    description: "Create a new task with comprehensive options including recurring patterns, time estimation, tags, and due dates",
    inputSchema: z.object({
      title: z.string().describe("The task title or name"),
      description: z.string().optional().describe("Optional detailed description of the task"),
      priority: z.number().min(1).max(4).optional().describe("Task priority: 1=highest, 4=lowest (default: 3)"),
      dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD or ISO datetime)"),
      projectId: z.string().optional().describe("The ID of the project to associate the task with"),
      estimatedHours: z.number().min(0).optional().describe("Estimated hours to complete the task"),
      estimatedMinutes: z.number().min(0).max(59).optional().describe("Estimated minutes to complete the task (0-59)"),
      tags: z.array(z.string()).optional().describe("Array of tags for categorizing the task"),
      isRecurring: z.boolean().optional().describe("Whether this task repeats on a schedule"),
      recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().describe("How often the task recurs (only if isRecurring is true)"),
    }),
    execute: async (toolArgs): Promise<Id<"tasks">> => {
      console.log(`🔧 createTask called with:`, toolArgs);
      try {
        const result = await ctx.runMutation(api.tasks.createTask, {
          ...toolArgs,
          projectId: toolArgs.projectId as Id<"projects"> | undefined,
          dueDate: toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined,
        });
        console.log(`✅ createTask succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ createTask failed:`, error);
        throw error;
      }
    },
  }),
  getTasks: tool({
    description: "Retrieve tasks with optional filtering by completion status or project",
    inputSchema: z.object({
      completed: z.boolean().optional().describe("Filter by completion status (true=completed, false=pending)"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
    }),
    execute: async (toolArgs): Promise<Doc<"tasks">[]> => {
      console.log(`🔧 getTasks called with:`, toolArgs);
      try {
        const queryArgs: any = { completed: toolArgs.completed };
        if (toolArgs.projectId) {
          queryArgs.projectId = toolArgs.projectId as any;
        }
        const result = await ctx.runQuery(api.tasks.getTasks, queryArgs);
        console.log(`✅ getTasks succeeded - found ${result.length} tasks:`, result.map(t => ({ id: t._id, title: t.title, completedAt: t.completedAt })));
        return result;
      } catch (error) {
        console.error(`❌ getTasks failed:`, error);
        throw error;
      }
    },
  }),
  updateTask: tool({
    description: "Update an existing task with comprehensive options. Use getTasks first to get the exact task ID (_id field). Use isCompleted: true to mark tasks as completed. Supports recurring patterns, time estimation, and tags.",
    inputSchema: z.object({
      taskId: z.string().describe("The exact task ID from getTasks result (_id field)"),
      title: z.string().optional().describe("Updated task title"),
      description: z.string().optional().describe("Updated task description"),
      projectId: z.string().optional().describe("Move task to a different project by providing the target project ID"),
      isCompleted: z.boolean().optional().describe("Mark task as completed (true) or pending (false)"),
      priority: z.number().min(1).max(4).optional().describe("Updated priority: 1=highest, 4=lowest"),
      dueDate: z.string().optional().describe("Updated due date in ISO format"),
      estimatedHours: z.number().min(0).optional().describe("Updated estimated hours to complete the task"),
      estimatedMinutes: z.number().min(0).max(59).optional().describe("Updated estimated minutes (0-59)"),
      tags: z.array(z.string()).optional().describe("Updated array of tags for the task"),
      isRecurring: z.boolean().optional().describe("Whether this task should repeat on a schedule"),
      recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().describe("How often the task recurs"),
    }),
    execute: async (toolArgs): Promise<Id<"tasks">> => {
      console.log(`🔧 updateTask called with:`, toolArgs);
      if (!toolArgs.taskId) {
        console.error(`❌ updateTask missing taskId`);
        throw new Error("taskId is required for updateTask");
      }
      try {
        const { taskId, ...updateData } = toolArgs;
        const result = await ctx.runMutation(api.tasks.updateTask, {
          id: taskId as Id<"tasks">,
          ...updateData,
          projectId: updateData.projectId as Id<"projects"> | undefined,
          dueDate: updateData.dueDate ? new Date(updateData.dueDate).getTime() : undefined,
        });
        console.log(`✅ updateTask succeeded:`, result, `with data:`, updateData);
        return result;
      } catch (error) {
        console.error(`❌ updateTask failed:`, error);
        throw error;
      }
    },
  }),
  deleteTask: tool({
    description: "Delete a task by its ID. Use getTasks first to get the exact task ID (_id field).",
    inputSchema: z.object({
      taskId: z.string().describe("The exact task ID from getTasks result (_id field)"),
    }),
    execute: async ({ taskId }): Promise<Id<"tasks">> => {
      console.log(`🔧 deleteTask called with taskId:`, taskId);
      if (!taskId) {
        console.error(`❌ deleteTask missing taskId`);
        throw new Error("taskId is required for deleteTask");
      }
      try {
        const result = await ctx.runMutation(api.tasks.deleteTask, { id: taskId as Id<"tasks"> });
        console.log(`✅ deleteTask succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ deleteTask failed:`, error);
        throw error;
      }
    },
  }),
  createProject: tool({
    description: "Create a new project with name, color, and optional description",
    inputSchema: z.object({
      name: z.string().describe("The project name"),
      color: z.string().describe("Project color (hex code or color name)"),
      description: z.string().optional().describe("Optional project description"),
    }),
    execute: async (toolArgs): Promise<Id<"projects">> => {
      console.log(`🔧 createProject called with:`, toolArgs);
      try {
        const result = await ctx.runMutation(api.projects.createProject, toolArgs);
        console.log(`✅ createProject succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ createProject failed:`, error);
        throw error;
      }
    },
  }),
  getProjects: tool({
    description: "Retrieve all projects for the current user",
    inputSchema: z.object({}),
    execute: async (): Promise<Doc<"projects">[]> => {
      console.log(`🔧 getProjects called`);
      try {
        const result = await ctx.runQuery(api.projects.getProjects, {});
        console.log(`✅ getProjects succeeded - found ${result.length} projects:`, result.map(p => ({ id: p._id, name: p.name })));
        return result;
      } catch (error) {
        console.error(`❌ getProjects failed:`, error);
        throw error;
      }
    },
  }),
  deleteProject: tool({
    description: "Delete a project by its ID.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the project to delete."),
    }),
    execute: async ({ id }): Promise<Id<"projects">> => {
      console.log(`🔧 deleteProject called with id:`, id);
      if (!id) {
        console.error(`❌ deleteProject missing id`);
        throw new Error("id is required for deleteProject");
      }
      try {
        const result = await ctx.runMutation(api.projects.deleteProject, { id: id as Id<"projects"> });
        console.log(`✅ deleteProject succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ deleteProject failed:`, error);
        throw error;
      }
    },
  }),
  getProjectByName: tool({
    description: "Get a project by its name to find its ID.",
    inputSchema: z.object({
      name: z.string().describe("The name of the project to find."),
    }),
    execute: async ({ name }): Promise<Doc<"projects"> | null> => {
      console.log(`🔧 getProjectByName called with name:`, name);
      try {
        const projects: Doc<"projects">[] = await ctx.runQuery(api.projects.getProjects, {});
        const result = projects.find((p: Doc<"projects">) => p.name === name) || null;
        console.log(`✅ getProjectByName ${result ? 'found' : 'not found'} project:`, result ? { id: result._id, name: result.name } : 'null');
        return result;
      } catch (error) {
        console.error(`❌ getProjectByName failed:`, error);
        throw error;
      }
    },
  }),
  getUpcomingTasks: tool({
    description: "Get tasks that are due within a specified number of days (default 7 days). Useful for deadline awareness and planning.",
    inputSchema: z.object({
      days: z.number().min(1).max(30).optional().describe("Number of days ahead to look for upcoming tasks (1-30, default: 7)"),
    }),
    execute: async (toolArgs): Promise<Doc<"tasks">[]> => {
      console.log(`🔧 getUpcomingTasks called with:`, toolArgs);
      try {
        const result = await ctx.runQuery(api.tasks.getUpcomingTasks, {
          days: toolArgs.days || 7,
        });
        console.log(`✅ getUpcomingTasks succeeded - found ${result.length} upcoming tasks`);
        return result;
      } catch (error) {
        console.error(`❌ getUpcomingTasks failed:`, error);
        throw error;
      }
    },
  }),
  getTasksByFilter: tool({
    description: "Get tasks with advanced filtering and sorting options. Use this for complex task queries and organization.",
    inputSchema: z.object({
      completed: z.boolean().optional().describe("Filter by completion status (true=completed, false=active)"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
      priority: z.number().min(1).max(4).optional().describe("Filter by priority level (1=highest, 4=lowest)"),
      sortBy: z.enum(['priority', 'dueDate', 'createdAt']).optional().describe("Sort tasks by priority, due date, or creation date"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort order: ascending or descending"),
    }),
    execute: async (toolArgs): Promise<Doc<"tasks">[]> => {
      console.log(`🔧 getTasksByFilter called with:`, toolArgs);
      try {
        const result = await ctx.runQuery(api.tasks.getTasksByFilter, {
          ...toolArgs,
          projectId: toolArgs.projectId as Id<"projects"> | undefined,
        });
        console.log(`✅ getTasksByFilter succeeded - found ${result.length} tasks`);
        return result;
      } catch (error) {
        console.error(`❌ getTasksByFilter failed:`, error);
        throw error;
      }
    },
  }),
  getTaskStats: tool({
    description: "Get comprehensive statistics about tasks including totals, priority distribution, and overdue counts.",
    inputSchema: z.object({}),
    execute: async (): Promise<any> => {
      console.log(`🔧 getTaskStats called`);
      try {
        const result = await ctx.runQuery(api.tasks.getTaskStats, {});
        console.log(`✅ getTaskStats succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ getTaskStats failed:`, error);
        throw error;
      }
    },
  }),
});

export const chatWithAI = action({
  args: { 
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
  },
  handler: async (ctx, { message, useHaiku = false }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const tools = defineTools(ctx);

    const conversation = await ctx.runQuery(api.conversations.getConversation, {});
    const initialMessages: CoreMessage[] = (conversation?.messages as CoreMessage[]) || [];
    initialMessages.push({ role: "user", content: message });
    
    try {
      const modelName = useHaiku ? "claude-3-5-haiku-20241022" : "claude-3-5-sonnet-20240620";
      console.log(`🤖 Using AI model: ${modelName}`);
      
      const result = await generateText({
        model: useHaiku ? anthropic("claude-3-5-haiku-20241022") : anthropic("claude-3-5-sonnet-20240620"),
        system: `You are a helpful AI assistant for task and project management. You can create, read, update, and delete tasks and projects.

CRITICAL: You MUST actually call the tools to perform actions - don't just describe what you would do!

You have powerful task management tools at your disposal:
- createTask: Supports recurring patterns, time estimation, tags, due dates, and project assignment
- updateTask: Can modify any task property including recurring settings and time estimates
- getUpcomingTasks: Shows tasks due within specified days for deadline awareness
- getTasksByFilter: Advanced filtering and sorting by priority, project, completion status
- getTaskStats: Comprehensive task analytics and priority distribution

For multi-step operations, you have up to ${useHaiku ? 6 : 10} steps to complete complex tasks:

1. ALWAYS call getTasks or getTasksByFilter first to see current tasks and get their exact IDs
2. Use getUpcomingTasks to check for deadline-sensitive tasks when relevant
3. Use getTaskStats to understand overall task distribution and priority levels
4. For complex queries, use getTasksByFilter with appropriate filters and sorting

Common Workflows:

🔄 **Creating Recurring Tasks:**
- createTask with isRecurring: true and recurringPattern: 'daily/weekly/monthly/yearly'
- Include estimatedHours/estimatedMinutes for time planning
- Add tags for easy categorization

⏰ **Time Management:**
- Use getUpcomingTasks to check deadlines
- createTask or updateTask with estimatedHours and estimatedMinutes
- Set priority levels based on urgency and importance

📊 **Task Organization:**
- Use getTasksByFilter for complex queries (filter by project, priority, completion)
- Sort tasks by priority, dueDate, or createdAt
- Use getTaskStats to understand workload distribution

✅ **Bulk Operations:**
- Step 1: Use getTasksByFilter to find specific tasks
- Step 2-N: Apply updateTask to each task with desired changes

IMPORTANT: Always execute the tool calls - don't just plan or describe actions!

Be conversational and explain what you're doing step by step. Use the enhanced task management capabilities systematically:
- When users mention deadlines or time constraints, use getUpcomingTasks
- For recurring tasks (daily standup, weekly reviews), use the recurring task features
- For time estimation requests, use estimatedHours and estimatedMinutes
- For filtering requests, use getTasksByFilter with appropriate parameters
- Always provide task statistics when users ask for overviews or summaries`,
        messages: initialMessages,
        tools: tools,
        stopWhen: stepCountIs(useHaiku ? 6 : 10), // Reduce steps for Haiku
      });

      // Log AI response details for debugging
      console.log(`🤖 AI Response - Tool Calls:`, result.toolCalls?.length || 0);
      console.log(`🤖 AI Response - Tool Results:`, result.toolResults?.length || 0);
      console.log(`🤖 AI Response - Text:`, result.text);
      
      // Warning if no tools were called when they might be needed
      if (!result.toolCalls || result.toolCalls.length === 0) {
        if (message.toLowerCase().includes('move') || 
            message.toLowerCase().includes('update') || 
            message.toLowerCase().includes('complete') ||
            message.toLowerCase().includes('create')) {
          console.log(`⚠️ WARNING: No tools executed for potential action request: "${message}"`);
        }
      }
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`🤖 AI Tool Calls Details:`, JSON.stringify(result.toolCalls, null, 2));
      }
      if (result.toolResults && result.toolResults.length > 0) {
        console.log(`🤖 AI Tool Results Details:`, JSON.stringify(result.toolResults, null, 2));
      }

      // Store user message
      await ctx.runMutation(api.conversations.addMessage, {
        role: "user",
        content: message,
      });

      // Store AI response  
      await ctx.runMutation(api.conversations.addMessage, {
        role: "assistant", 
        content: result.text,
      });
      
      return {
        response: result.text,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        usage: result.usage,
      };

    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while processing your request.";
      await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: `I apologize, but I encountered an error: ${errorMessage}` });
      throw new Error(`AI processing failed: ${errorMessage}`);
    }
  },
});