import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText, tool, CoreMessage, ToolResultPart, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { z } from "zod";
import { Id } from "./_generated/dataModel";
import { ActionCtx } from "./_generated/server";

// Helper function to validate messages before API calls. This is a good practice
// to prevent sending empty or invalid messages to the AI model.
function validateMessages(messages: CoreMessage[]): CoreMessage[] {
  return messages.filter(msg => {
    if (!msg.content) return false;
    if (typeof msg.content === 'string' && msg.content.trim().length === 0) return false;
    return true;
  });
}

// Create configured Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to create a typed set of tools
const defineTools = (ctx: ActionCtx): Record<string, any> => ({
  createTask: tool({
    description: "Create a new task with a title, description, priority, due date, and project.",
    inputSchema: z.object({
      title: z.string().describe("The task title."),
      description: z.string().optional().describe("A detailed description of the task."),
      priority: z.number().min(1).max(4).optional().describe("Priority: 1=high, 2=medium, 3=normal, 4=low. Defaults to 3."),
      dueDate: z.string().optional().describe("Due date in ISO format (e.g., YYYY-MM-DDTHH:mm)."),
      projectId: z.string().optional().describe("The exact database-generated project ID from getProjects - NOT the project name like 'Personal' or 'Work'"),
    }),
    execute: async (toolArgs): Promise<Id<"tasks">> => {
      console.log(`🔧 createTask called with:`, toolArgs);
      return await ctx.runMutation(api.tasks.createTask, {
        ...toolArgs,
        projectId: toolArgs.projectId ? (() => {
          // Validate projectId format if provided
          if (toolArgs.projectId && (toolArgs.projectId.length < 8 || /\s/.test(toolArgs.projectId) || /[A-Z]/.test(toolArgs.projectId))) {
            throw new Error(`Invalid projectId format: "${toolArgs.projectId}". You must call getProjects first to get the actual database ID, not the project name.`);
          }
          return toolArgs.projectId as Id<"projects">;
        })() : undefined,
        dueDate: toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined,
      });
    },
  }),
  getTasks: tool({
    description: "Retrieve a list of tasks, with optional filters. This is the primary way to get task IDs and details.",
    inputSchema: z.object({
      completed: z.boolean().optional().describe("Filter by completion status (true for completed, false for active)."),
      projectId: z.string().optional().describe("Filter tasks for a specific project using its exact database ID from getProjects - NOT project name"),
    }),
    execute: async (toolArgs): Promise<any[]> => {
      console.log(`🔧 getTasks called with:`, toolArgs);
      return await ctx.runQuery(api.tasks.getTasks, {
        completed: toolArgs.completed,
        projectId: toolArgs.projectId as Id<"projects"> | undefined,
      });
    },
  }),
  updateTask: tool({
    description: "Update an existing task. MANDATORY WORKFLOW: 1) Call getTasks first to get current task data and exact taskId (_id field), 2) Use that exact taskId in this tool call.",
    inputSchema: z.object({
      taskId: z.string().describe("The exact database-generated task ID (_id field) from getTasks result - NOT the task title or description"),
      title: z.string().optional().describe("New title for the task."),
      description: z.string().optional().describe("New description for the task."),
      projectId: z.string().optional().describe("Move task to a new project by providing its exact database ID from getProjects - NOT project name"),
      isCompleted: z.boolean().optional().describe("Mark task as completed (true) or active (false)."),
      priority: z.number().min(1).max(4).optional().describe("New priority for the task."),
      dueDate: z.string().optional().describe("New due date in ISO format."),
    }),
    execute: async (toolArgs): Promise<Id<"tasks">> => {
      console.log(`🔧 updateTask called with:`, toolArgs);
      const { taskId, ...updateData } = toolArgs;
      
      // Validate taskId format - must be database ID, not human text
      if (!taskId || taskId.length < 8 || /\s/.test(taskId) || /[A-Z]/.test(taskId)) {
        throw new Error(`Invalid taskId format: "${taskId}". You must call getTasks first to get the actual database ID (like "j57abc123def4gh8"), not the task title or description.`);
      }
      
      const task = await ctx.runQuery(api.tasks.getTaskById, { taskId: taskId as Id<"tasks"> });
      if (!task) {
          throw new Error(`Task with ID '${taskId}' not found. Call getTasks to see available tasks and their correct database IDs.`);
      }

      return await ctx.runMutation(api.tasks.updateTask, {
        id: taskId as Id<"tasks">,
        ...updateData,
        projectId: updateData.projectId ? (() => {
          // Validate projectId format if provided
          if (updateData.projectId && (updateData.projectId.length < 8 || /\s/.test(updateData.projectId) || /[A-Z]/.test(updateData.projectId))) {
            throw new Error(`Invalid projectId format: "${updateData.projectId}". You must call getProjects first to get the actual database ID, not the project name.`);
          }
          return updateData.projectId as Id<"projects">;
        })() : undefined,
        dueDate: updateData.dueDate ? new Date(updateData.dueDate).getTime() : undefined,
      });
    },
  }),
  deleteTask: tool({
    description: "Delete a task by its ID. MANDATORY WORKFLOW: 1) Call getTasks first to confirm the task exists and get its exact _id, 2) Use that database _id in this tool call.",
    inputSchema: z.object({
      taskId: z.string().describe("The exact database-generated task ID (_id field) from getTasks - NOT the task title"),
    }),
    execute: async ({ taskId }): Promise<Id<"tasks">> => {
      console.log(`🔧 deleteTask called with taskId:`, taskId);
      
      // Validate taskId format - must be database ID, not human text
      if (!taskId || taskId.length < 8 || /\s/.test(taskId) || /[A-Z]/.test(taskId)) {
        throw new Error(`Invalid taskId format: "${taskId}". You must call getTasks first to get the actual database ID, not the task title.`);
      }
      
      const task = await ctx.runQuery(api.tasks.getTaskById, { taskId: taskId as Id<"tasks"> });
      if (!task) {
          throw new Error(`Task with ID '${taskId}' not found. Call getTasks to see available tasks and their correct database IDs.`);
      }

      return await ctx.runMutation(api.tasks.deleteTask, { id: taskId as Id<"tasks"> });
    },
  }),
  getProjects: tool({
    description: "Retrieve all projects to get their names and IDs.",
    inputSchema: z.object({}),
    execute: async (): Promise<any[]> => {
      console.log(`🔧 getProjects called`);
      return await ctx.runQuery(api.projects.getProjects, {});
    },
  }),
  createProject: tool({
    description: "Create a new project.",
    inputSchema: z.object({
        name: z.string().describe("The project name."),
        color: z.string().describe("A hex color code for the project (e.g., '#FF5733')."),
        description: z.string().optional().describe("Optional project description."),
    }),
    execute: async (toolArgs): Promise<Id<"projects">> => {
        console.log(`🔧 createProject called with:`, toolArgs);
        return await ctx.runMutation(api.projects.createProject, toolArgs);
    },
  }),
  deleteProject: tool({
    description: "Delete a project by its ID. MANDATORY: Call getProjects first to get the exact database ID. Fails if the project contains tasks.",
    inputSchema: z.object({
      id: z.string().describe("The exact database-generated project ID from getProjects - NOT the project name"),
    }),
    execute: async ({ id }): Promise<Id<"projects">> => {
      console.log(`🔧 deleteProject called with id:`, id);
      
      // Validate projectId format - must be database ID, not project name
      if (!id || id.length < 8 || /\s/.test(id) || /[A-Z]/.test(id)) {
        throw new Error(`Invalid project ID format: "${id}". You must call getProjects first to get the actual database ID, not the project name like "Personal" or "Work".`);
      }
      
      return await ctx.runMutation(api.projects.deleteProject, { id: id as Id<"projects"> });
    },
  }),
});

export const chatWithAI: any = action({
  args: { 
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
  },
  handler: async (ctx, { message, useHaiku = false }): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const tools: any = defineTools(ctx);

    const conversation = await ctx.runQuery(api.conversations.getConversation, {});
    const initialMessages: CoreMessage[] = (conversation?.messages as CoreMessage[]) || [];
    initialMessages.push({ role: "user", content: message });
    
    try {
      const modelName = useHaiku ? "claude-3-haiku-20240307" : "claude-3-5-sonnet-20240620";
      console.log(`🤖 Using AI model: ${modelName}`);
      
      // STEP 1: Plan and Execute Tools
      // The AI is instructed to think, decide which tools to use, and call them.
      const executionResult: any = await generateText({
        model: anthropic(modelName),
        system: `You are an expert AI assistant for task and project management.

        **CRITICAL ID REQUIREMENTS:**
        - Task IDs and Project IDs are database-generated strings like "j57abc123def4gh8", NOT human-readable names
        - BEFORE updating, deleting, or filtering tasks: MUST call getTasks to get actual task IDs
        - BEFORE referencing projects: MUST call getProjects to get actual project IDs  
        - NEVER use task titles like "Put dad's golf bag in the car" or project names like "Personal" as IDs

        **CORE INSTRUCTIONS:**
        1.  **READ-FIRST PATTERN**: For ANY operation involving specific tasks/projects, start with getTasks or getProjects
        2.  **PLAN & EXECUTE**: Use the exact database IDs returned by get operations for all subsequent tool calls
        3.  **NO ASSUMPTIONS**: Never assume you know IDs - always fetch current data first
        4.  If no tool is required, you may respond directly to the user.

        **MANDATORY WORKFLOW EXAMPLES:**
        - To complete a task: 1) getTasks to find the task and get its _id, 2) updateTask with that exact _id
        - To move a task to project: 1) getTasks for task _id, 2) getProjects for project _id, 3) updateTask
        - To delete a task: 1) getTasks to confirm existence and get _id, 2) deleteTask with that _id`,
        messages: validateMessages(initialMessages),
        tools: tools,
        stopWhen: stepCountIs(5),
      });

      // If the model didn't call any tools, its text response is the final answer.
      if (executionResult.toolCalls === undefined || executionResult.toolCalls.length === 0) {
        console.log("✅ No tool calls needed. Responding directly.");
        await ctx.runMutation(api.conversations.addMessage, { role: "user", content: message });
        await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: executionResult.text });
        return { response: executionResult.text };
      }

      // Validate workflow: Check for read-first pattern compliance
      const hasUpdateOrDelete = executionResult.toolCalls.some((call: any) => 
        ['updateTask', 'deleteTask', 'deleteProject'].includes(call.toolName)
      );
      const hasReadOperation = executionResult.toolCalls.some((call: any) =>
        ['getTasks', 'getProjects'].includes(call.toolName)
      );
      
      if (hasUpdateOrDelete && !hasReadOperation) {
        console.log(`⚠️  WORKFLOW VIOLATION: AI attempted update/delete without reading data first`);
        console.log(`Tool calls: ${executionResult.toolCalls.map((tc: any) => tc.toolName).join(', ')}`);
      } else if (hasReadOperation && hasUpdateOrDelete) {
        console.log(`✅ PROPER WORKFLOW: AI used read-first pattern`);
      }

      // STEP 2: Respond based on Tool Results
      // If tools were called, the AI's job is now to interpret the results and formulate a final,
      // user-facing response that accurately reflects what happened.
      console.log(`🔄 ${executionResult.toolCalls.length} tool calls made. Generating final response...`);

      const finalResponse = await generateText({
        model: anthropic(modelName),
        system: `You have just executed tools and their results are provided below. Your task is to summarize these results for the user.
        
        **CORE INSTRUCTIONS:**
        1.  **VERIFY RESULTS**: Base your response ONLY on the actual outcomes from the provided 'tool_results'.
        2.  **CONFIRM ACTIONS**: If a tool call was successful, confirm the action and mention the key results (e.g., "I've created the task 'Deploy to production'.").
        3.  **REPORT FAILURES**: If a tool call failed, you MUST apologize and clearly report the error message from the tool result (e.g., "I tried to delete the project, but the action failed because it still has tasks in it.").`,
        messages: validateMessages([
            ...initialMessages,
            {
                role: 'assistant',
                content: executionResult.toolCalls.map((call: any) => ({
                    type: 'tool-call',
                    toolCallId: call.toolCallId,
                    toolName: call.toolName,
                    args: call.args,
                }))
            },
            {
                role: 'tool',
                content: executionResult.toolResults as ToolResultPart[]
            }
        ]),
      });

      // Save the complete interaction history to the database
      await ctx.runMutation(api.conversations.updateConversation, {
        messages: [
            ...initialMessages,
            { 
              role: "assistant", 
              content: finalResponse.text,
              timestamp: Date.now(),
              toolCalls: executionResult.toolCalls.map((tc: any) => ({
                name: tc.toolName,
                args: tc.args,
                result: executionResult.toolResults?.find((tr: any) => tr.toolCallId === tc.toolCallId)?.result,
              })),
            }
        ] as any,
      });

      return {
        response: finalResponse.text,
        toolCalls: executionResult.toolCalls,
        toolResults: executionResult.toolResults,
      };

    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred.";
      await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: `I apologize, but I encountered an error: ${errorMessage}` });
      throw new Error(`AI processing failed: ${errorMessage}`);
    }
  },
});