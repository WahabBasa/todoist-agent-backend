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
      console.log(`🔍 getTasks received parameters:`, JSON.stringify(toolArgs, null, 2));
      console.log(`🔍 Validating projectId format if provided...`);
      
      // Enhanced validation for projectId if provided
      if (toolArgs.projectId) {
        if (toolArgs.projectId.length < 8 || /\s/.test(toolArgs.projectId) || /[A-Z]/.test(toolArgs.projectId)) {
          console.log(`❌ Invalid projectId format detected: "${toolArgs.projectId}"`);
          console.log(`❌ Expected: Database ID like "k789def456ghi"`);
          console.log(`❌ Received: ${toolArgs.projectId?.includes(' ') ? 'Human-readable project name' : 'Invalid ID format'}`);
          console.log(`❌ SOLUTION: Call getProjects() first to get actual database IDs`);
          throw new Error(`Invalid projectId format: "${toolArgs.projectId}". You must call getProjects first to get the actual database ID, not the project name like "Personal" or "Work".`);
        }
        console.log(`✅ projectId format validation passed: "${toolArgs.projectId}"`);
      }
      
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
      console.log(`🔍 updateTask received parameters:`, JSON.stringify(toolArgs, null, 2));
      console.log(`🔍 Validating ID formats...`);
      const { taskId, ...updateData } = toolArgs;
      
      // Enhanced validation with detailed logging
      if (!taskId || taskId.length < 8 || /\s/.test(taskId) || /[A-Z]/.test(taskId)) {
        console.log(`❌ Invalid taskId format detected: "${taskId}"`);
        console.log(`❌ Expected: Database ID like "j57abc123def4gh8"`);
        console.log(`❌ Received: ${taskId?.includes(' ') ? 'Human-readable text with spaces' : 'Invalid ID format'}`);
        console.log(`❌ SOLUTION: Call getTasks() first to get actual database IDs`);
        throw new Error(`Invalid taskId format: "${taskId}". You must call getTasks first to get the actual database ID (like "j57abc123def4gh8"), not the task title or description.`);
      }
      
      console.log(`✅ taskId format validation passed: "${taskId}"`);
      console.log(`🔧 updateTask called with:`, toolArgs);
      
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
      
      // Enhanced logging: Track user request and AI planning phase
      console.log(`🎯 User Request: "${message}"`);
      console.log(`🤖 AI Planning Phase: Model will analyze request for tool usage`);
      
      // STEP 1: Plan and Execute Tools
      // The AI is instructed to think, decide which tools to use, and call them.
      const executionResult: any = await generateText({
        model: anthropic(modelName),
        system: `<task_description>
You are a database-aware task management assistant. Your role is to execute user requests by calling the correct tools with valid database IDs, never human-readable text as identifiers.
</task_description>

<context>
The system uses Convex database with auto-generated IDs like "j57abc123def4gh8" for tasks and projects. Users refer to items by human names, but tools require database IDs. You must translate between human descriptions and database identifiers.
</context>

<instructions>
For ANY operation involving specific tasks or projects:

1. **Read First**: Always call getTasks() or getProjects() to retrieve current data
2. **Locate Item**: Find the item that matches the user's description in the results
3. **Extract ID**: Copy the exact _id field value from the matching item
4. **Execute Operation**: Use that database ID in subsequent tool calls

**ID Format Validation**:
- Valid database IDs: "j57abc123def4gh8" (8+ characters, lowercase, no spaces)
- Invalid human text: "Put dad's golf bag in the car", "Personal", "Work"

**Workflow Enforcement**:
- Never assume you know database IDs
- Never use task titles or project names as IDs
- Always fetch fresh data before update/delete operations
</instructions>

<examples>
**Correct workflow for completing a task**:
User: "Mark the grocery shopping task as done"
1. getTasks() → returns [{_id: "k89def456ghi", title: "Buy groceries"}, ...]
2. updateTask(taskId: "k89def456ghi", isCompleted: true)

**Correct workflow for project filtering**:
User: "Show me tasks in my Personal project"  
1. getProjects() → returns [{_id: "m12ghi789jkl", name: "Personal"}, ...]
2. getTasks(projectId: "m12ghi789jkl")

**Direct response (no tools needed)**:
User: "What can you help me with?"
Response: Explain your capabilities without calling tools.
</examples>

<task_reminder>
Critical: Never use human-readable text as database IDs. Always follow the read-first pattern: get current data, locate the item, extract the _id, then execute the operation.
</task_reminder>`,
        messages: validateMessages(initialMessages),
        tools: tools,
        stopWhen: stepCountIs(5),
      });

      // Tool call inspection: Log what the AI decided to call and parameters
      if (executionResult.toolCalls && executionResult.toolCalls.length > 0) {
        console.log(`🔧 AI Generated ${executionResult.toolCalls.length} tool calls:`);
        executionResult.toolCalls.forEach((call: any, idx: number) => {
          console.log(`   ${idx + 1}. ${call.toolName}(${JSON.stringify(call.args, null, 2)})`);
        });
      }

      // If the model didn't call any tools, its text response is the final answer.
      if (executionResult.toolCalls === undefined || executionResult.toolCalls.length === 0) {
        console.log("✅ No tool calls needed. Responding directly.");
        await ctx.runMutation(api.conversations.addMessage, { role: "user", content: message });
        await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: executionResult.text });
        return { response: executionResult.text };
      }

      // Enhanced workflow pattern analysis logging
      const hasUpdateOrDelete = executionResult.toolCalls.some((call: any) => 
        ['updateTask', 'deleteTask', 'deleteProject'].includes(call.toolName)
      );
      const hasReadOperation = executionResult.toolCalls.some((call: any) =>
        ['getTasks', 'getProjects'].includes(call.toolName)
      );
      
      console.log(`📊 Workflow Analysis:`);
      console.log(`   Update/Delete operations: ${hasUpdateOrDelete ? '✓' : '✗'}`);
      console.log(`   Read operations: ${hasReadOperation ? '✓' : '✗'}`);
      console.log(`   Tool sequence: ${executionResult.toolCalls.map((tc: any) => tc.toolName).join(' → ')}`);
      
      if (hasUpdateOrDelete && !hasReadOperation) {
        console.log(`❌ WORKFLOW VIOLATION: Tools [${executionResult.toolCalls.filter((tc: any) => ['updateTask', 'deleteTask', 'deleteProject'].includes(tc.toolName)).map((tc: any) => tc.toolName).join(', ')}]`);
        console.log(`❌ Missing required read operations before update/delete`);
        console.log(`❌ AI must call getTasks or getProjects first to get database IDs`);
      } else if (hasReadOperation && hasUpdateOrDelete) {
        console.log(`✅ PROPER WORKFLOW: AI used read-first pattern`);
      } else if (!hasUpdateOrDelete && !hasReadOperation) {
        console.log(`ℹ️  NO CRITICAL OPERATIONS: Safe workflow (create/read only)`);
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