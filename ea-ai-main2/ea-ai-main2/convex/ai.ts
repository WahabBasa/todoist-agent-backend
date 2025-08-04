import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create configured Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});


export const chatWithAI = action({
  args: { 
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Store user message first
    await ctx.runMutation(api.conversations.addMessage, {
      role: "user",
      content: args.message,
    });

    // Define tools using AI SDK v5 format with manual execution
    const createTaskTool = {
      description: "Create a new task with optional project assignment and priority",
      inputSchema: z.object({
        title: z.string().describe("Task title (required)"),
        description: z.string().optional().describe("Task description"),
        priority: z.number().min(1).max(4).optional().describe("Priority level: 1=High, 2=Medium, 3=Normal, 4=Low"),
        dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD)"),
        projectId: z.string().optional().describe("Project ID to assign task to"),
        tags: z.array(z.string()).optional().describe("Array of tags for the task"),
        estimatedTime: z.number().optional().describe("Estimated time in minutes"),
      }),
    };

    const getTasksTool = {
      description: "Get tasks, optionally filtered by completion status and project",
      inputSchema: z.object({
        completed: z.boolean().optional().describe("Filter by completion status"),
        projectId: z.string().optional().describe("Filter by project ID"),
      }),
    };

    const updateTaskTool = {
      description: "Update an existing task (completion status, title, priority, etc.)",
      inputSchema: z.object({
        taskId: z.string().describe("Task ID to update"),
        title: z.string().optional().describe("New task title"),
        description: z.string().optional().describe("New task description"),
        isCompleted: z.boolean().optional().describe("Mark task as completed/incomplete"),
        priority: z.number().min(1).max(4).optional().describe("New priority level"),
        dueDate: z.string().optional().describe("New due date in ISO format"),
        projectId: z.string().optional().describe("New project ID"),
        tags: z.array(z.string()).optional().describe("New tags array"),
        estimatedTime: z.number().optional().describe("New estimated time in minutes"),
      }),
    };

    const createProjectTool = {
      description: "Create a new project to organize tasks",
      inputSchema: z.object({
        name: z.string().describe("Project name (required)"),
        color: z.string().describe("Project color (hex code or color name)"),
        description: z.string().optional().describe("Project description"),
      }),
    };

    const getProjectsTool = {
      description: "Get all projects with task counts",
      inputSchema: z.object({}),
    };

    const deleteTaskTool = {
      description: "Delete a task permanently",
      inputSchema: z.object({
        taskId: z.string().describe("Task ID to delete"),
      }),
    };

    try {
      // Generate AI response with tools
      const result = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: `You are an intelligent task management assistant. You help users manage their tasks and projects through natural language conversations.

Available capabilities:
- Create, update, and delete tasks
- Organize tasks with projects, priorities, due dates, and tags
- Mark tasks as complete/incomplete
- Create and manage projects
- Search and filter tasks

Priority levels: 1=High (urgent), 2=Medium, 3=Normal (default), 4=Low
Colors for projects: Use standard color names or hex codes

Be helpful, concise, and proactive in suggesting task organization improvements. Always confirm successful operations and provide clear feedback about what was accomplished.`,
        messages: [{ role: "user", content: args.message }],
        tools: {
          createTask: createTaskTool,
          getTasks: getTasksTool,
          updateTask: updateTaskTool,
          createProject: createProjectTool,
          getProjects: getProjectsTool,
          deleteTask: deleteTaskTool,
        },
      });

      // Execute tool calls and collect results
      const toolResults: any[] = [];

      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          try {
            let toolResult: any = {};

            switch (toolCall.toolName) {
              case "createTask":
                const taskArgs = (toolCall as any).args;
                const dueDate = taskArgs.dueDate ? new Date(taskArgs.dueDate).getTime() : undefined;
                
                const taskId = await ctx.runMutation(api.tasks.createTask, {
                  title: taskArgs.title,
                  description: taskArgs.description,
                  priority: taskArgs.priority,
                  dueDate,
                  projectId: taskArgs.projectId,
                  tags: taskArgs.tags,
                  estimatedTime: taskArgs.estimatedTime,
                });
                toolResult = { success: true, taskId, message: `Created task: ${taskArgs.title}` };
                break;

              case "getTasks":
                const filterArgs = (toolCall as any).args;
                const tasks = await ctx.runQuery(api.tasks.getTasks, {
                  completed: filterArgs.completed,
                  projectId: filterArgs.projectId,
                });
                toolResult = { success: true, tasks, count: tasks.length };
                break;

              case "updateTask":
                const updateArgs = (toolCall as any).args;
                const updateDueDate = updateArgs.dueDate ? new Date(updateArgs.dueDate).getTime() : undefined;
                
                await ctx.runMutation(api.tasks.updateTask, {
                  id: updateArgs.taskId,
                  title: updateArgs.title,
                  description: updateArgs.description,
                  isCompleted: updateArgs.isCompleted,
                  priority: updateArgs.priority,
                  dueDate: updateDueDate,
                  projectId: updateArgs.projectId,
                  tags: updateArgs.tags,
                  estimatedTime: updateArgs.estimatedTime,
                });
                toolResult = { success: true, message: `Updated task ${updateArgs.taskId}` };
                break;

              case "createProject":
                const projectArgs = (toolCall as any).args;
                const projectId = await ctx.runMutation(api.projects.createProject, {
                  name: projectArgs.name,
                  color: projectArgs.color,
                  description: projectArgs.description,
                });
                toolResult = { success: true, projectId, message: `Created project: ${projectArgs.name}` };
                break;

              case "getProjects":
                const projects = await ctx.runQuery(api.projects.getProjects, {});
                toolResult = { success: true, projects, count: projects.length };
                break;

              case "deleteTask":
                const deleteArgs = (toolCall as any).args;
                await ctx.runMutation(api.tasks.deleteTask, {
                  id: deleteArgs.taskId,
                });
                toolResult = { success: true, message: `Deleted task ${deleteArgs.taskId}` };
                break;

              default:
                toolResult = { success: false, error: `Unknown tool: ${toolCall.toolName}` };
            }

            toolResults.push({
              name: toolCall.toolName,
              args: (toolCall as any).args,
              result: toolResult,
            });

          } catch (error) {
            console.error(`Error executing tool ${toolCall.toolName}:`, error);
            toolResults.push({
              name: toolCall.toolName,
              args: (toolCall as any).args,
              result: { 
                success: false, 
                error: error instanceof Error ? error.message : "Unknown error" 
              },
            });
          }
        }
      }

      // Store AI response with tool call results
      await ctx.runMutation(api.conversations.addMessage, {
        role: "assistant",
        content: result.text,
        toolCalls: toolResults,
      });

      return {
        response: result.text,
        toolCalls: toolResults,
        usage: result.usage,
      };

    } catch (error) {
      console.error("AI chat error:", error);
      
      // Store error response
      const errorMessage = error instanceof Error ? error.message : "An error occurred while processing your request.";
      await ctx.runMutation(api.conversations.addMessage, {
        role: "assistant",
        content: `I apologize, but I encountered an error: ${errorMessage}`,
      });

      throw new Error(`AI processing failed: ${errorMessage}`);
    }
  },
});

// Helper action to get conversation context for the AI  
export const getConversationContext = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const messages: any[] = await ctx.runQuery(api.conversations.getMessages, {
      limit: args.limit || 10,
    });

    return messages;
  },
});