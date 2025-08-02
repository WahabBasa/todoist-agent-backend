import { action, mutation, query, QueryCtx } from "./_generated/server";
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

export const createOrUpdateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existingUser) {
      // Create new Clerk user
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        displayName: args.displayName,
        photoUrl: args.photoUrl,
        preferences: {
          timezone: undefined,
          defaultProject: undefined,
        },
      });
    } else {
      // Update existing Clerk user with latest info
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        photoUrl: args.photoUrl,
      });
    }
  },
});

export const getUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    const userId = identity.subject || identity.tokenIdentifier;
    
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getAllUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    // Only return if authenticated (basic check)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    return await ctx.db.query("users").collect();
  },
});

export const getUserActivitySummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    
    return await ctx.db
      .query("userActivity")
      .withIndex("by_last_active")
      .order("desc")
      .collect();
  },
});

export const getUserTodayView = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    const userId = identity.subject || identity.tokenIdentifier;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    return user?.todayViewText || null;
  },
});

export const updateUserActivity = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    toolCallsCount: v.number(),
    modelUsed: v.string(),
    toolsUsed: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const existingActivity = await ctx.db
      .query("userActivity")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Count specific todo operations from tools used
    const todosCreated = args.toolsUsed.filter(tool => tool === 'createTask').length;
    const todosCompleted = args.toolsUsed.filter(tool => tool === 'completeTask').length;
    const todosUpdated = args.toolsUsed.filter(tool => tool === 'updateTask').length;
    const todosDeleted = args.toolsUsed.filter(tool => tool === 'deleteTask').length;

    if (!existingActivity) {
      // Create new activity record
      await ctx.db.insert("userActivity", {
        userId: args.userId,
        displayName: args.displayName,
        email: args.email,
        totalMessages: 1,
        totalToolCalls: args.toolCallsCount,
        lastActiveAt: Date.now(),
        todosCreated,
        todosCompleted,
        todosUpdated,
        todosDeleted,
        preferredModel: args.modelUsed,
        dailyUsage: {
          date: today,
          messageCount: 1,
          toolCallCount: args.toolCallsCount
        }
      });
    } else {
      // Update existing activity record
      const isNewDay = existingActivity.dailyUsage.date !== today;
      
      await ctx.db.patch(existingActivity._id, {
        displayName: args.displayName,
        email: args.email,
        totalMessages: existingActivity.totalMessages + 1,
        totalToolCalls: existingActivity.totalToolCalls + args.toolCallsCount,
        lastActiveAt: Date.now(),
        todosCreated: existingActivity.todosCreated + todosCreated,
        todosCompleted: existingActivity.todosCompleted + todosCompleted,
        todosUpdated: existingActivity.todosUpdated + todosUpdated,
        todosDeleted: existingActivity.todosDeleted + todosDeleted,
        preferredModel: args.modelUsed,
        dailyUsage: {
          date: today,
          messageCount: isNewDay ? 1 : existingActivity.dailyUsage.messageCount + 1,
          toolCallCount: isNewDay ? args.toolCallsCount : existingActivity.dailyUsage.toolCallCount + args.toolCallsCount
        }
      });
    }
  },
});

export const updateUserTodayView = mutation({
  args: {
    userId: v.string(),
    todayViewText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        todayViewText: args.todayViewText,
      });
    }
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

const updateTodayViewTool = tool({
  description: "Update the Today view text display that the user sees in their Today tab",
  parameters: z.object({
    text: z.string().describe("Formatted text content to display in the Today view (can include task details, summaries, etc.)"),
  }),
  execute: async ({ text }) => {
    // The user ID will be injected when this tool is called from the processMessage action
    return {
      success: true,
      message: "Today view updated",
      text: text,
      shouldUpdateTodayView: true, // Flag to indicate this tool result should update the today view
    };
  },
});

const getTodayTasksTool = tool({
  description: "Get today's tasks from Todoist to show the user or update their Today view",
  parameters: z.object({
    format_as_text: z.boolean().optional().describe("If true, format the tasks as readable text for the Today view"),
  }),
  execute: async ({ format_as_text = false }) => {
    const todoistToken = process.env.TODOIST_TOKEN;
    if (!todoistToken) {
      throw new Error("Todoist token not configured");
    }
    
    const client = new TodoistClient(todoistToken);
    
    // Get today's tasks using Todoist filter
    const todayTasks = await client.getTasks(); // We'll filter on the client side for now
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const filteredTasks = todayTasks.filter(task => {
      if (!task.due) return false;
      const taskDate = task.due.date;
      return taskDate === today || new Date(taskDate) < new Date();
    });

    if (format_as_text) {
      if (filteredTasks.length === 0) {
        return {
          success: true,
          text: "🎉 No tasks for today! You're all caught up.",
          tasks_count: 0,
        };
      }

      let formattedText = `📅 Today's Tasks (${filteredTasks.length})\n\n`;
      
      filteredTasks.forEach((task, index) => {
        const priority = task.priority > 1 ? '🔥'.repeat(task.priority - 1) : '';
        const overdue = task.due && new Date(task.due.date) < new Date() ? '⚠️ OVERDUE: ' : '';
        formattedText += `${index + 1}. ${overdue}${priority}${task.content}\n`;
        if (task.description) {
          formattedText += `   📝 ${task.description}\n`;
        }
        formattedText += `\n`;
      });

      return {
        success: true,
        text: formattedText,
        tasks_count: filteredTasks.length,
      };
    }

    return {
      success: true,
      tasks: filteredTasks.map(task => ({
        id: task.id,
        content: task.content,
        description: task.description,
        due: task.due?.string,
        priority: task.priority,
        is_completed: task.is_completed,
      })),
      tasks_count: filteredTasks.length,
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
      
      // Create or update Clerk user in database
      await ctx.runMutation(api.agents.createOrUpdateUser, {
        clerkId: userId,
        email: identity.email,
        displayName: identity.name,
        photoUrl: identity.pictureUrl,
      });
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
          getTodayTasks: getTodayTasksTool,
          updateTodayView: updateTodayViewTool,
        },
        system: `You are a friendly and efficient Todoist assistant. Help users manage their tasks naturally and conversationally.

        Special Features:
        - You can update the user's "Today View" tab with formatted text using the updateTodayView tool
        - Use getTodayTasks to fetch today's tasks from Todoist and format them nicely
        - When users ask to "show my today view" or similar, use getTodayTasks with format_as_text=true, then updateTodayView with the result

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
        - When updating the Today View, format the text nicely with emojis and clear structure
        
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

      // Check if any tool calls should update the today view
      const updateTodayViewCalls = result.toolCalls?.filter(call => 
        call.toolName === 'updateTodayView'
      );

      if (updateTodayViewCalls && updateTodayViewCalls.length > 0) {
        // Use the last updateTodayView call if there are multiple
        const lastUpdateCall = updateTodayViewCalls[updateTodayViewCalls.length - 1];
        // Extract text from the args since results aren't available immediately
        const todayViewText = lastUpdateCall.args?.text || 'Updated today view';
        await ctx.runMutation(api.agents.updateUserTodayView, {
          userId,
          todayViewText,
        });
      }

      // Update user activity tracking
      await ctx.runMutation(api.agents.updateUserActivity, {
        userId,
        displayName: identity.name,
        email: identity.email,
        toolCallsCount: result.toolCalls?.length || 0,
        modelUsed: modelProvider === "anthropic" ? "Claude 3.5 Sonnet" : "GPT-4",
        toolsUsed: result.toolCalls?.map(call => call.toolName) || []
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

// User Identity Helper Functions (Following threads-clone pattern)
export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByClerkId(ctx, identity.subject);
}

async function userByClerkId(ctx: QueryCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

export const getUserByClerkId = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;
    return await userByClerkId(ctx, args.clerkId);
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});