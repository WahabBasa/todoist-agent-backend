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
    description: "Create a new task with title, optional description, priority (1-4), due date, and projectId",
    inputSchema: z.object({
      title: z.string().describe("The task title or name"),
      description: z.string().optional().describe("Optional detailed description of the task"),
      priority: z.number().min(1).max(4).optional().describe("Task priority: 1=highest, 4=lowest (default: 3)"),
      dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD or ISO datetime)"),
      projectId: z.string().optional().describe("The ID of the project to associate the task with."),
    }),
    execute: async (toolArgs): Promise<Id<"tasks">> => {
      return await ctx.runMutation(api.tasks.createTask, {
        ...toolArgs,
        projectId: toolArgs.projectId as Id<"projects"> | undefined,
        dueDate: toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined,
      });
    },
  }),
  getTasks: tool({
    description: "Retrieve tasks with optional filtering by completion status or project",
    inputSchema: z.object({
      completed: z.boolean().optional().describe("Filter by completion status (true=completed, false=pending)"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
    }),
    execute: async (toolArgs): Promise<Doc<"tasks">[]> => {
      const queryArgs: any = { completed: toolArgs.completed };
      if (toolArgs.projectId) {
        queryArgs.projectId = toolArgs.projectId as any;
      }
      return await ctx.runQuery(api.tasks.getTasks, queryArgs);
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
      return await ctx.runMutation(api.projects.createProject, toolArgs);
    },
  }),
  getProjects: tool({
    description: "Retrieve all projects for the current user",
    inputSchema: z.object({}),
    execute: async (): Promise<Doc<"projects">[]> => {
      return await ctx.runQuery(api.projects.getProjects, {});
    },
  }),
  deleteProject: tool({
    description: "Delete a project by its ID.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the project to delete."),
    }),
    execute: async ({ id }): Promise<Id<"projects">> => {
      return await ctx.runMutation(api.projects.deleteProject, { id: id as Id<"projects"> });
    },
  }),
  getProjectByName: tool({
    description: "Get a project by its name to find its ID.",
    inputSchema: z.object({
      name: z.string().describe("The name of the project to find."),
    }),
    execute: async ({ name }): Promise<Doc<"projects"> | null> => {
      const projects: Doc<"projects">[] = await ctx.runQuery(api.projects.getProjects, {});
      return projects.find((p: Doc<"projects">) => p.name === name) || null;
    },
  }),
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

    const tools = defineTools(ctx);

    const conversation = await ctx.runQuery(api.conversations.getConversation, {});
    const initialMessages: CoreMessage[] = (conversation?.messages as CoreMessage[]) || [];
    initialMessages.push({ role: "user", content: args.message });
    
    try {
      const result = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: `You are a helpful AI assistant...`, // System prompt omitted for brevity
        messages: initialMessages,
        tools: tools,
        stopWhen: stepCountIs(5),
      });

      // Transform the AI SDK messages into the format our database and UI expect.
      const messagesToStore = result.response.messages.map((msg: CoreMessage) => {
        let toolCalls;
        let content: string | object = msg.content;

        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            const toolCallParts = msg.content.filter(part => part.type === 'tool-call');
            if (toolCallParts.length > 0) {
              toolCalls = toolCallParts.map(part => {
                if (part.type === 'tool-call') {
                  const matchingResult = result.toolResults.find(tr => tr.toolCallId === part.toolCallId);
                  return {
                    name: part.toolName,
                    // --- THIS IS THE FIX ---
                    args: part.input,
                    result: matchingResult?.output,
                  };
                }
                return null;
              }).filter(Boolean);
              
              content = result.text || `Using ${toolCallParts.length} tool(s)...`;
            }
          } else if (msg.role === 'tool') {
            return null; 
          }

        return {
          role: msg.role,
          content: content,
          timestamp: Date.now(),
          toolCalls: toolCalls,
        };
      }).filter(Boolean);


      // SAVE CONVERSATION
      await ctx.runMutation(api.conversations.updateConversation, { 
        messages: messagesToStore as any 
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