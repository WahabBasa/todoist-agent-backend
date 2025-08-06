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
    description: "Update an existing task. Use getTasks first to get the exact task ID (_id field). Use isCompleted: true to mark tasks as completed. Use projectId to move tasks between projects.",
    inputSchema: z.object({
      taskId: z.string().describe("The exact task ID from getTasks result (_id field)"),
      title: z.string().optional().describe("Updated task title"),
      description: z.string().optional().describe("Updated task description"),
      projectId: z.string().optional().describe("Move task to a different project by providing the target project ID"),
      isCompleted: z.boolean().optional().describe("Mark task as completed (true) or pending (false)"),
      priority: z.number().min(1).max(4).optional().describe("Updated priority: 1=highest, 4=lowest"),
      dueDate: z.string().optional().describe("Updated due date in ISO format"),
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

For multi-step operations, you have up to ${useHaiku ? 6 : 10} steps to complete complex tasks:

1. ALWAYS call getTasks first to see current tasks and get their exact IDs
2. Use the exact _id field from getTasks results when calling updateTask or deleteTask  
3. For "complete all tasks" or "tick off all active tasks": 
   - Step 1: Call getTasks with completed: false to get all pending tasks
   - Step 2-N: Call updateTask for each task with isCompleted: true using their exact _id values

4. For moving tasks between projects:
   - Step 1: Call getProjects to see available projects and their IDs
   - Step 2: Call getTasks to find tasks to move
   - Step 3: Call updateTask with projectId to move each task

5. For task updates, use the isCompleted field - set to true when completing tasks

Example multi-step workflow for "move tasks to project X":
1. getProjects() -> find target project ID
2. getTasks() -> find tasks to move  
3. updateTask(taskId: "task1_id", projectId: "target_project_id")
4. updateTask(taskId: "task2_id", projectId: "target_project_id")
5. Continue for all tasks

IMPORTANT: Always execute the tool calls - don't just plan or describe actions!

Be conversational and explain what you're doing step by step. Use the tools systematically to accomplish complex operations.`,
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