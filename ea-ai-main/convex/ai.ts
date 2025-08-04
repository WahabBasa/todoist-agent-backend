import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getAuthUserId } from "@convex-dev/auth/server";

// Internal task management tools for the ea-ai-backend system
const createTaskTool = tool({
  description: "Create a new task in the internal task management system",
  parameters: z.object({
    title: z.string().describe("The task title/content"),
    description: z.string().optional().describe("Additional task description"),
    priority: z.number().min(1).max(4).optional().describe("Priority level (1=normal, 2=high, 3=very high, 4=urgent)"),
    dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"),
    estimatedTime: z.number().optional().describe("Estimated time in minutes"),
    tags: z.array(z.string()).optional().describe("Task tags"),
    projectId: z.string().optional().describe("Project ID if task belongs to a project"),
  }),
  execute: async ({ title, description, priority, dueDate, estimatedTime, tags, projectId }) => {
    return {
      success: true,
      taskId: "placeholder", // Will be replaced with actual task ID
      task: {
        title,
        description,
        priority: priority ?? 3,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedTime,
        tags: tags ?? [],
        projectId,
      }
    };
  },
});

const getTasksTool = tool({
  description: "Get tasks from the internal task management system",
  parameters: z.object({
    completed: z.boolean().optional().describe("Filter by completion status"),
    projectId: z.string().optional().describe("Filter by project ID"),
  }),
  execute: async ({ completed, projectId }) => {
    return { success: true, completed, projectId };
  },
});

const updateTaskTool = tool({
  description: "Update an existing task in the internal system",
  parameters: z.object({
    taskId: z.string().describe("Task ID to update"),
    title: z.string().optional().describe("New task title"),
    description: z.string().optional().describe("New task description"),
    priority: z.number().min(1).max(4).optional().describe("New priority level"),
    isCompleted: z.boolean().optional().describe("Mark as completed/incomplete"),
    dueDate: z.string().optional().describe("New due date in ISO format"),
    estimatedTime: z.number().optional().describe("New estimated time in minutes"),
    tags: z.array(z.string()).optional().describe("New task tags"),
  }),
  execute: async ({ taskId, title, description, priority, isCompleted, dueDate, estimatedTime, tags }) => {
    return {
      success: true,
      taskId,
      updates: { title, description, priority, isCompleted, dueDate, estimatedTime, tags }
    };
  },
});

const deleteTaskTool = tool({
  description: "Delete a task from the internal system",
  parameters: z.object({
    taskId: z.string().describe("Task ID to delete"),
  }),
  execute: async ({ taskId }) => {
    return { success: true, taskId };
  },
});

const createProjectTool = tool({
  description: "Create a new project in the internal system",
  parameters: z.object({
    name: z.string().describe("Project name"),
    color: z.string().describe("Project color (hex code like #FF5733)"),
    description: z.string().optional().describe("Project description"),
  }),
  execute: async ({ name, color, description }) => {
    return { success: true, project: { name, color, description } };
  },
});

const getProjectsTool = tool({
  description: "Get all projects from the internal system",
  parameters: z.object({}),
  execute: async () => {
    return { success: true };
  },
});

const getUpcomingTasksTool = tool({
  description: "Get upcoming tasks for the next specified days",
  parameters: z.object({
    days: z.number().optional().describe("Number of days to look ahead (default: 7)"),
  }),
  execute: async ({ days }) => {
    return { success: true, days: days ?? 7 };
  },
});

export const chatWithAI = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ content: string; toolCalls: any[] }> => {
    // Get authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required. Please sign in to continue.");
    }

    // Get conversation history
    const conversation: any = await ctx.runQuery(api.conversations.getConversation);
    const messages: any[] = conversation?.messages || [];

    // Get current tasks and projects for context
    const tasks: any[] = await ctx.runQuery(api.tasks.getTasks, { completed: false });
    const projects: any[] = await ctx.runQuery(api.projects.getProjects);
    const upcomingTasks: any[] = await ctx.runQuery(api.tasks.getUpcomingTasks, { days: 7 });

    const systemMessage: any = {
      role: "system" as const,
      content: `You are a warm, friendly, and efficient personal AI assistant that helps users manage their tasks and projects. You have access to an internal task management system.

Current context:
- Active tasks: ${tasks.length}
- Projects: ${projects.length}
- Upcoming tasks (next 7 days): ${upcomingTasks.length}

You can:
1. Create, update, and delete tasks with priorities, due dates, and time estimates
2. Create and manage projects with colors and descriptions
3. Get task lists filtered by completion status or project
4. Help with scheduling and time management
5. Get upcoming tasks to help with planning

Guidelines:
- Be warm, helpful, and encouraging in your responses
- When creating tasks, confirm what you've added and offer suggestions
- When listing tasks, organize them clearly and highlight important details like due dates and priorities
- For updates/completions, celebrate progress and acknowledge achievements
- For deletions, confirm what was removed to avoid confusion
- Always check current tasks before making changes to provide accurate information
- Use casual, friendly language - avoid technical jargon
- Ask clarifying questions if requests are ambiguous
- Offer proactive suggestions when appropriate (e.g., "Would you like me to set a due date for that?")
- When working with projects, suggest organizing related tasks together
- Use emojis appropriately to make interactions more engaging

Remember: You're helping people stay organized and productive, so make the experience pleasant and motivating!`,
    };

    const chatMessages: any[] = [
      systemMessage,
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: args.message,
      },
    ];

    const tools = {
      createTask: createTaskTool,
      getTasks: getTasksTool,
      updateTask: updateTaskTool,
      deleteTask: deleteTaskTool,
      createProject: createProjectTool,
      getProjects: getProjectsTool,
      getUpcomingTasks: getUpcomingTasksTool,
    };

    const result: any = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      maxSteps: 10,
      tools,
      system: systemMessage.content,
      messages: chatMessages.slice(1), // Remove system message as it's passed separately
    });

    let toolResults: any[] = [];

    // Handle tool calls by executing the actual Convex operations
    if (result.toolCalls) {
      for (const toolCall of result.toolCalls) {
        const { toolName, args: toolArgs } = toolCall;
        let toolResult;

        try {
          // Map tool calls directly to Convex operations based on tool name
          switch (toolName) {
            case "createTask":
              const createArgs = {
                title: toolArgs.title,
                description: toolArgs.description,
                priority: toolArgs.priority ?? 3,
                dueDate: toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined,
                estimatedTime: toolArgs.estimatedTime,
                tags: toolArgs.tags ?? [],
                projectId: toolArgs.projectId,
              };
              toolResult = await ctx.runMutation(api.tasks.createTask, createArgs);
              break;
              
            case "getTasks":
              toolResult = await ctx.runQuery(api.tasks.getTasks, {
                completed: toolArgs.completed,
                projectId: toolArgs.projectId,
              });
              break;
              
            case "updateTask":
              const updateArgs = {
                taskId: toolArgs.taskId,
                title: toolArgs.title,
                description: toolArgs.description,
                priority: toolArgs.priority,
                isCompleted: toolArgs.isCompleted,
                dueDate: toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined,
                estimatedTime: toolArgs.estimatedTime,
                tags: toolArgs.tags,
              };
              toolResult = await ctx.runMutation(api.tasks.updateTask, updateArgs);
              break;
              
            case "deleteTask":
              toolResult = await ctx.runMutation(api.tasks.deleteTask, {
                taskId: toolArgs.taskId,
              });
              break;
              
            case "createProject":
              toolResult = await ctx.runMutation(api.projects.createProject, {
                name: toolArgs.name,
                color: toolArgs.color,
                description: toolArgs.description,
              });
              break;
              
            case "getProjects":
              toolResult = await ctx.runQuery(api.projects.getProjects);
              break;
              
            case "getUpcomingTasks":
              toolResult = await ctx.runQuery(api.tasks.getUpcomingTasks, {
                days: toolArgs.days ?? 7,
              });
              break;
              
            default:
              toolResult = { error: "Unknown tool" };
          }

          toolResults.push({
            name: toolName,
            args: toolArgs,
            result: toolResult,
          });
        } catch (error) {
          toolResults.push({
            name: toolName,
            args: toolArgs,
            result: { error: error instanceof Error ? error.message : "Unknown error" },
          });
        }
      }
    }

    // Save user message
    await ctx.runMutation(api.conversations.addMessage, {
      role: "user",
      content: args.message,
    });

    // Save assistant response
    await ctx.runMutation(api.conversations.addMessage, {
      role: "assistant",
      content: result.text || "I performed the requested actions.",
      toolCalls: toolResults.length > 0 ? toolResults : undefined,
    });

    return {
      content: result.text || "I performed the requested actions.",
      toolCalls: toolResults,
    };
  },
});