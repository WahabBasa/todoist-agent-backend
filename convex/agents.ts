import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { TodoistClient } from "./todoist";
import { api } from "./_generated/api";

export const storeConversation = mutation({
  args: {
    userId: v.string(),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.object({
      toolName: v.string(),
      args: v.any(),
    }))),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversations", {
      userId: args.userId,
      message: args.message,
      response: args.response,
      timestamp: args.timestamp,
      toolCalls: args.toolCalls,
    });
  },
});

const createTaskTool = tool({
  description: "Create a new task in Todoist",
  parameters: z.object({
    content: z.string().describe("The task content/title"),
    description: z.string().optional().describe("Additional task description"),
    due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    due_string: z.string().optional().describe("Natural language due date for recurring tasks and specific times (e.g., 'every Monday at 9am', 'tomorrow at 3pm', 'every week')"),
    due_datetime: z.string().optional().describe("Specific date/time in RFC3339 UTC format (e.g., '2024-12-25T15:30:00Z')"),
    due_lang: z.string().optional().describe("Language code for parsing due_string (default: 'en')"),
    priority: z.number().min(1).max(4).optional().describe("Priority level (1=normal, 2=high, 3=very high, 4=urgent)"),
  }),
  execute: async ({ content, description, due_date, due_string, due_datetime, due_lang, priority }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    const task = await client.createTask({
      content,
      description,
      due_date,
      due_string,
      due_datetime,
      due_lang,
      priority,
    });
    
    return {
      success: true,
      task: {
        id: task.id,
        content: task.content,
        due: task.due?.string,
        priority: task.priority,
      },
    };
  },
});

const getTasksTool = tool({
  description: "Get all tasks from Todoist",
  parameters: z.object({
    project_id: z.string().optional().describe("Optional project ID to filter tasks"),
  }),
  execute: async ({ project_id }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    const tasks = await client.getTasks(project_id);
    
    return {
      success: true,
      tasks: tasks.map(task => ({
        id: task.id,
        content: task.content,
        is_completed: task.is_completed,
        due: task.due?.string,
        priority: task.priority,
      })),
    };
  },
});

const updateTaskTool = tool({
  description: "Update an existing task in Todoist by searching for it by name",
  parameters: z.object({
    task_name: z.string().describe("Name/content of the task to search for and update"),
    content: z.string().optional().describe("New task content/title"),
    description: z.string().optional().describe("New task description"),
    due_date: z.string().optional().describe("New due date in YYYY-MM-DD format"),
    due_string: z.string().optional().describe("Natural language due date for recurring tasks and specific times (e.g., 'every Monday at 9am', 'tomorrow at 3pm', 'every week')"),
    due_datetime: z.string().optional().describe("Specific date/time in RFC3339 UTC format (e.g., '2024-12-25T15:30:00Z')"),
    due_lang: z.string().optional().describe("Language code for parsing due_string (default: 'en')"),
    priority: z.number().min(1).max(4).optional().describe("New priority level"),
  }),
  execute: async ({ task_name, content, description, due_date, due_string, due_datetime, due_lang, priority }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    
    // First, search for the task
    const tasks = await client.getTasks();
    const matchingTask = tasks.find(task => 
      task.content.toLowerCase().includes(task_name.toLowerCase())
    );

    if (!matchingTask) {
      return {
        success: false,
        message: `Could not find a task matching "${task_name}"`,
      };
    }

    // Build update data
    const updateData: any = {};
    if (content) updateData.content = content;
    if (description) updateData.description = description;
    if (due_date) updateData.due_date = due_date;
    if (due_string) updateData.due_string = due_string;
    if (due_datetime) updateData.due_datetime = due_datetime;
    if (due_lang) updateData.due_lang = due_lang;
    if (priority) updateData.priority = priority;

    const updatedTask = await client.updateTask(matchingTask.id, updateData);
    
    return {
      success: true,
      task: {
        id: updatedTask.id,
        content: updatedTask.content,
        due: updatedTask.due?.string,
        priority: updatedTask.priority,
      },
      message: `Successfully updated task: "${matchingTask.content}"`,
    };
  },
});

const completeTaskTool = tool({
  description: "Mark a task as completed in Todoist by searching for it by name",
  parameters: z.object({
    task_name: z.string().describe("Name/content of the task to search for and complete"),
  }),
  execute: async ({ task_name }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    
    // First, search for the task
    const tasks = await client.getTasks();
    const matchingTask = tasks.find(task => 
      task.content.toLowerCase().includes(task_name.toLowerCase())
    );

    if (!matchingTask) {
      return {
        success: false,
        message: `Could not find a task matching "${task_name}"`,
      };
    }

    // Complete the task
    await client.closeTask(matchingTask.id);
    
    return {
      success: true,
      message: `Successfully completed task: "${matchingTask.content}"`,
    };
  },
});

const deleteTaskTool = tool({
  description: "Delete a task from Todoist by searching for it by name",
  parameters: z.object({
    task_name: z.string().describe("Name/content of the task to search for and delete"),
  }),
  execute: async ({ task_name }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    
    // First, search for the task
    const tasks = await client.getTasks();
    const matchingTask = tasks.find(task => 
      task.content.toLowerCase().includes(task_name.toLowerCase())
    );

    if (!matchingTask) {
      return {
        success: false,
        message: `Could not find a task matching "${task_name}"`,
      };
    }

    // Delete the task
    await client.deleteTask(matchingTask.id);
    
    return {
      success: true,
      message: `Successfully deleted task: "${matchingTask.content}"`,
    };
  },
});

export const processMessage = action({
  args: { 
    message: v.string(),
    modelProvider: v.optional(v.string())
  },
  handler: async (ctx, { message, modelProvider = "openai" }) => {
    try {
      // Get authenticated user identity
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return {
          success: false,
          error: "Authentication required. Please sign in to continue.",
        };
      }
      
      const userId = identity.subject || identity.tokenIdentifier;
      // Select model based on provider
      const model = modelProvider === "anthropic" 
        ? anthropic("claude-3-5-sonnet-20241022")
        : openai("gpt-4");
      
      const result = await generateText({
        model: model,
        maxSteps: 10,
        tools: {
          createTask: createTaskTool,
          getTasks: getTasksTool,
          updateTask: updateTaskTool,
          completeTask: completeTaskTool,
          deleteTask: deleteTaskTool,
        },
        system: `You are a friendly and efficient Todoist assistant. Help users manage their tasks naturally and conversationally.

        Guidelines:
        - Be warm, helpful, and encouraging in your responses
        - When creating tasks, confirm what you've added and offer suggestions
        - When listing tasks, organize them clearly and highlight important details like due dates
        - For updates/completions, celebrate progress and acknowledge achievements
        - For deletions, confirm what was removed to avoid confusion
        - Always check current tasks before making changes to provide accurate information
        - Use casual, friendly language - avoid technical jargon
        - Ask clarifying questions if requests are ambiguous
        - Offer proactive suggestions when appropriate (e.g., "Would you like me to set a due date for that?")
        
        Remember: You're helping people stay organized and productive, so make the experience pleasant and motivating!`,
        messages: [{ role: "user", content: message }],
      });

      // Store conversation in database
      await ctx.runMutation(api.agents.storeConversation, {
        userId,
        message,
        response: result.text,
        timestamp: Date.now(),
        toolCalls: result.toolCalls?.map(call => ({
          toolName: call.toolName,
          args: call.args,
        })),
      });

      return {
        success: true,
        response: result.text,
        toolCalls: result.toolCalls?.length || 0,
        modelUsed: modelProvider === "anthropic" ? "Claude 3.5 Sonnet" : "GPT-4",
      };
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});