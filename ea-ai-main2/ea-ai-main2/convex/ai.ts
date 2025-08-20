import { action } from "./_generated/server";
import { v } from "convex/values";
import { 
  generateText, 
  tool,
  ModelMessage,
  UIMessage,
  convertToModelMessages,
  ToolResultPart
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { z } from "zod";
import { ActionCtx } from "./_generated/server";

// =================================================================
// EXECUTIVE ASSISTANT AI - TASK MANAGEMENT SYSTEM
// This AI acts as an intelligent executive assistant that helps users
// manage their personal and professional tasks and projects efficiently.
// =================================================================



// Type definitions for message content (for documentation purposes)

// OpenCode-inspired: Build UIMessage objects then convert using AI SDK
function convertConvexMessagesToModel(
  history: {
    role: "user" | "assistant" | "tool";
    content?: string;
    toolCalls?: { name: string; args: any; toolCallId: string }[];
    toolResults?: { toolCallId: string; toolName?: string; result: any }[];
    timestamp?: number;
  }[]
): ModelMessage[] {
  const uiMessages: UIMessage[] = [];
  
  // Group messages by conversation flow (user -> assistant -> tool results)
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    
    try {
      if (message.role === "user" && message.content && typeof message.content === 'string') {
        uiMessages.push({
          id: `user-${i}`,
          role: "user",
          parts: [{
            type: "text",
            text: message.content
          }]
        });
      }
      
      else if (message.role === "assistant") {
        const parts: UIMessage["parts"] = [];
        
        // Add text content if present
        if (message.content && typeof message.content === 'string') {
          parts.push({
            type: "text",
            text: message.content
          });
        }
        
        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const tc of message.toolCalls) {
            if (tc.toolCallId && tc.name) {
              // Find corresponding tool result in the next tool message
              const nextToolMsg = history.find((h, idx) => 
                idx > i && h.role === "tool" && 
                h.toolResults?.some(tr => tr.toolCallId === tc.toolCallId)
              );
              
              const toolResult = nextToolMsg?.toolResults?.find(tr => tr.toolCallId === tc.toolCallId);
              
              if (toolResult) {
                parts.push({
                  type: `tool-${tc.name}` as `tool-${string}`,
                  state: "output-available",
                  toolCallId: tc.toolCallId,
                  input: tc.args || {},
                  output: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result)
                });
              }
            }
          }
        }
        
        if (parts.length > 0) {
          uiMessages.push({
            id: `assistant-${i}`,
            role: "assistant",
            parts
          });
        }
      }
      
      // Skip tool messages as they're handled above with assistant messages
      
    } catch (error) {
      console.warn('[CONVERSION] Skipping invalid message:', error);
      continue;
    }
  }
  
  // Use AI SDK's conversion function like OpenCode
  return convertToModelMessages(uiMessages);
}



// =================================================================
// 1. TOOL DEFINITIONS: What the executive assistant can do for users
//    These define the assistant's capabilities for task and project management.
// =================================================================
const plannerTools = {
  createTask: tool({
    description: "Create a new task in the user's Todoist account. Use this when they want to add something to their real to-do list. You can optionally assign it to a specific Todoist project to keep things organized.",
    inputSchema: z.object({
      title: z.string().describe("The task title or description (e.g., 'Call the dentist', 'Review quarterly reports', 'Buy groceries')"),
      projectId: z.string().optional().describe("Optional: The Todoist project ID to categorize this task. Get project IDs by calling getProjectAndTaskMap first."),
    }),
  }),
  getTasks: tool({
    description: "Retrieve the user's Todoist tasks with full details from their account. Use this to show their to-do list or find tasks within a specific Todoist project. Call without parameters to see all tasks, or with projectId to filter by project.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Optional: Filter tasks to show only those belonging to a specific Todoist project. Get project IDs using getProjectAndTaskMap."),
    }),
  }),
  createProject: tool({
    description: "Create a new project in the user's Todoist account to help organize tasks. Use this when users want to group related tasks together (e.g., 'Work', 'Personal', 'Home Improvement', 'Vacation Planning').",
    inputSchema: z.object({
        name: z.string().describe("The project name (e.g., 'Work Projects', 'Personal Goals', 'Home Renovation', 'Marketing Campaign')"),
    }),
  }),
  getProjectAndTaskMap: tool({
    description: "Get a complete hierarchical overview of the user's entire Todoist workspace - all projects with their associated tasks (showing only _id and title for efficiency), plus unassigned tasks. This is your PRIMARY tool for understanding the user's Todoist data structure. Use this FIRST when the user asks about projects, tasks, or organization. By default shows only incomplete tasks to focus on actionable items.",
    inputSchema: z.object({
      includeCompleted: z.boolean().optional().describe("Set to true to include completed tasks in the results. Defaults to false (shows only incomplete tasks)."),
    }),
  }),
  getProjectDetails: tool({
    description: "Get detailed information about a specific project including all associated tasks with full details. Use this AFTER using getProjectAndTaskMap to identify the project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
    }),
  }),
  getTaskDetails: tool({
    description: "Get detailed information about a specific task including associated project information. Use this AFTER using getProjectAndTaskMap to identify the task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
    }),
  }),
  updateTask: tool({
    description: "Update an existing task's properties such as completion status, title, priority, due date, or project assignment. Use this when users want to modify, complete, or move tasks. Always call getProjectAndTaskMap first to get the correct task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
      title: z.string().optional().describe("New task title (e.g., 'Review quarterly reports', 'Client strategy meeting')"),
      description: z.string().optional().describe("Task description or notes"),
      projectId: z.string().optional().describe("Project ID to move task to, or null to unassign from project. Get project IDs from getProjectAndTaskMap."),
      priority: z.number().optional().describe("Task priority: 1=high/urgent, 2=medium/normal, 3=low"),
      dueDate: z.number().optional().describe("Due date as timestamp (milliseconds since epoch). Use null to remove due date."),
      isCompleted: z.boolean().optional().describe("Mark task as completed (true) or incomplete (false)"),
    }),
  }),
  deleteTask: tool({
    description: "Permanently delete a task from the system. Use this when users want to remove tasks that are no longer needed, duplicates, or canceled items. Always call getProjectAndTaskMap first to get the correct task ID.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID obtained from getProjectAndTaskMap"),
    }),
  }),
  updateProject: tool({
    description: "Update an existing project's properties such as name, color, or description. Use this when users want to rename projects, change colors, or modify project details. Always call getProjectAndTaskMap first to get the correct project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
      name: z.string().optional().describe("New project name (e.g., 'Client Projects', 'Personal Goals', 'Q1 Planning')"),
      color: z.string().optional().describe("Project color as hex code (e.g., '#FF5722', '#2196F3'). Will be auto-generated if not specified."),
      description: z.string().optional().describe("Project description or notes"),
    }),
  }),
  deleteProject: tool({
    description: "Delete a project from the system. Projects with existing tasks cannot be deleted unless tasks are moved or deleted first. Use this when users want to remove empty or unused projects. Always call getProjectAndTaskMap first to get the correct project ID.",
    inputSchema: z.object({
      projectId: z.string().describe("The project ID obtained from getProjectAndTaskMap"),
    }),
  }),
};

// =================================================================
// 2. SYSTEM EXECUTOR: A separate, deterministic function for execution.
//    This implements the *how*.
// =================================================================

// Circuit breaker to prevent infinite tool execution loops
const toolFailureTracker = new Map<string, { count: number; lastFailure: number }>();
const MAX_TOOL_FAILURES = 3;
const FAILURE_RESET_TIME = 5 * 60 * 1000; // 5 minutes

function checkCircuitBreaker(toolName: string): boolean {
  const failure = toolFailureTracker.get(toolName);
  if (!failure) return true;
  
  // Reset if enough time has passed
  if (Date.now() - failure.lastFailure > FAILURE_RESET_TIME) {
    toolFailureTracker.delete(toolName);
    return true;
  }
  
  return failure.count < MAX_TOOL_FAILURES;
}

function recordToolFailure(toolName: string): void {
  const failure = toolFailureTracker.get(toolName) || { count: 0, lastFailure: 0 };
  failure.count++;
  failure.lastFailure = Date.now();
  toolFailureTracker.set(toolName, failure);
}

async function executeTool(ctx: ActionCtx, toolCall: any): Promise<ToolResultPart> {
    const { toolName, args, toolCallId } = toolCall;
    console.log(`[Executor] 🔧 Executing tool: ${toolName} with args:`, JSON.stringify(args, null, 2));
    
    // Circuit breaker check
    if (!checkCircuitBreaker(toolName)) {
        console.warn(`[Executor] 🚫 Circuit breaker active for tool: ${toolName}`);
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: "Tool temporarily unavailable due to repeated failures. Please try again later."
        } as unknown as ToolResultPart;
    }

    try {
        let result: any;
        
        // Add project ID validation for getTasks
        if (toolName === "getTasks" && args.projectId) {
            // Validate that projectId looks like a Convex ID (not a project name)
            if (!/^[a-zA-Z0-9]{16,}$/.test(args.projectId)) {
                throw new Error(`Invalid project ID format: "${args.projectId}". Use getProjectAndTaskMap() first to get the correct project ID.`);
            }
        }
        
        switch (toolName) {
            case "createTask": {
                // Map internal format to Todoist API format
                const todoistArgs = {
                    content: args.title,
                    projectId: args.projectId,
                    priority: args.priority,
                    dueString: args.dueDate ? new Date(args.dueDate).toISOString().split('T')[0] : undefined,
                    description: args.description
                };
                result = await ctx.runAction(api.todoist.api.createTodoistTask, todoistArgs);
                
                // Convert back to expected format
                if (result) {
                    result = {
                        _id: result.id,
                        title: result.content,
                        projectId: result.project_id,
                        isCompleted: result.is_completed,
                        createdAt: new Date(result.created_at).getTime()
                    };
                }
                break;
            }
            case "getTasks": {
                result = await ctx.runAction(api.todoist.api.getTodoistTasks, {
                    projectId: args.projectId
                });
                
                // Convert to expected format
                if (result) {
                    result = result.map((task: any) => ({
                        _id: task.id,
                        title: task.content,
                        description: task.description || "",
                        projectId: task.project_id,
                        priority: task.priority || 1,
                        dueDate: task.due ? new Date(task.due.datetime || task.due.date).getTime() : undefined,
                        isCompleted: task.is_completed,
                        createdAt: new Date(task.created_at).getTime()
                    }));
                }
                break;
            }
            case "updateTask": {
                const { taskId, title, description, priority, dueDate, isCompleted, ...updateArgs } = args;
                const todoistArgs: any = {};
                
                if (title) todoistArgs.content = title;
                if (description !== undefined) todoistArgs.description = description;
                if (priority) todoistArgs.priority = priority;
                if (dueDate) todoistArgs.dueString = new Date(dueDate).toISOString().split('T')[0];
                
                // Handle task completion separately
                if (isCompleted === true) {
                    result = await ctx.runAction(api.todoist.api.completeTodoistTask, { taskId });
                } else if (isCompleted === false) {
                    result = await ctx.runAction(api.todoist.api.reopenTodoistTask, { taskId });
                } else if (Object.keys(todoistArgs).length > 0) {
                    result = await ctx.runAction(api.todoist.api.updateTodoistTask, {
                        taskId,
                        ...todoistArgs
                    });
                }
                
                // Return success confirmation
                result = { success: true, _id: taskId };
                break;
            }
            case "deleteTask":
                result = await ctx.runAction(api.todoist.api.deleteTodoistTask, { taskId: args.taskId });
                break;
            case "createProject": {
                const todoistArgs = {
                    name: args.name,
                    color: args.color || `#${Math.floor(Math.random()*16777215).toString(16)}`,
                    parentId: args.parentId
                };
                result = await ctx.runAction(api.todoist.api.createTodoistProject, todoistArgs);
                
                // Convert to expected format
                if (result) {
                    result = {
                        _id: result.id,
                        name: result.name,
                        color: result.color,
                        createdAt: Date.now()
                    };
                }
                break;
            }
            case "updateProject": {
                const { projectId, ...updateArgs } = args;
                result = await ctx.runAction(api.todoist.api.updateTodoistProject, {
                    projectId,
                    ...updateArgs
                });
                
                // Return success confirmation
                result = { success: true, _id: projectId };
                break;
            }
            case "deleteProject":
                result = await ctx.runAction(api.todoist.api.deleteTodoistProject, { projectId: args.projectId });
                break;
            case "getProjectAndTaskMap":
                result = await ctx.runAction(api.todoist.integration.getTodoistProjectAndTaskMap, {
                    includeCompleted: args.includeCompleted || false
                });
                break;
            case "getProjectDetails":
                result = await ctx.runAction(api.todoist.integration.getTodoistProjectDetails, { 
                    projectId: args.projectId 
                });
                break;
            case "getTaskDetails":
                result = await ctx.runAction(api.todoist.integration.getTodoistTaskDetails, { 
                    taskId: args.taskId 
                });
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        
        // Reset failure counter on success
        toolFailureTracker.delete(toolName);
        
        console.log(`[Executor] ✅ Tool ${toolName} executed successfully.`);
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: result || {},
        } as ToolResultPart;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error(`[Executor] ❌ Tool ${toolName} failed:`, errorMessage);
        
        // Record the failure for circuit breaker
        recordToolFailure(toolName);
        
        // Provide helpful error messages for Todoist integration issues
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes("Todoist not connected")) {
            userFriendlyMessage = "🔗 Please connect your Todoist account first. Go to Settings to link your Todoist account and start managing your real tasks.";
        } else if (errorMessage.includes("authentication expired")) {
            userFriendlyMessage = "🔑 Your Todoist connection has expired. Please reconnect your account in Settings.";
        } else if (errorMessage.includes("Todoist API error")) {
            userFriendlyMessage = "⚠️ Todoist service is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes("Rate limit")) {
            userFriendlyMessage = "⏱️ Too many requests to Todoist. Please wait a moment before trying again.";
        }
        
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: `Error: ${userFriendlyMessage}`
        } as unknown as ToolResultPart;
    }
}

// =================================================================
// 3. THE ORCHESTRATOR: Manages the agentic workflow.
// =================================================================
export const chatWithAI = action({
  args: {
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, { message, useHaiku = true, sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated.");

    const modelName = useHaiku ? "claude-3-5-haiku-20241022" : "claude-3-haiku-20240307";
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get conversation history - session-aware or default
    let conversation;
    if (sessionId) {
      conversation = await ctx.runQuery(api.conversations.getConversationBySession, { sessionId });
    } else {
      // For backward compatibility, use default conversation
      conversation = await ctx.runQuery(api.conversations.getConversation);
    }
    
    const history = (conversation?.messages as any[]) || [];
    history.push({ role: "user", content: message, timestamp: Date.now() });

    console.log(`[Orchestrator] Starting interaction for user message: "${message}"`);

    // Reset circuit breaker for new conversation to give tools a fresh start
    toolFailureTracker.clear();

    // Enhanced conversation state deduplication to prevent infinite loops
    const conversationStateTracker = new Set<string>();
    const toolCallTracker = new Map<string, number>(); // Track repeated tool calls
    
    const MAX_ITERATIONS = 5;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`[Orchestrator] -> Planning iteration ${i + 1}...`);
        
        // Advanced state tracking: message content + history length + last 3 message types
        const recentMessageTypes = history.slice(-3).map(h => h.role).join('-');
        const lastToolCalls = history.slice(-1)[0]?.toolCalls?.map((tc: any) => tc.name).sort().join(',') || 'none';
        const stateKey = `${message.slice(0, 50)}-${history.length}-${recentMessageTypes}-${lastToolCalls}`;
        
        if (conversationStateTracker.has(stateKey)) {
            console.warn(`[CIRCUIT_BREAKER] Duplicate conversation state detected at iteration ${i + 1}`);
            throw new Error(`Conversation loop detected. State: ${stateKey.slice(0, 100)}...`);
        }
        conversationStateTracker.add(stateKey);
        
        // Track repeated tool calls to detect oscillation patterns
        if (history.length > 0) {
          const lastMessage = history[history.length - 1];
          if (lastMessage.toolCalls?.length > 0) {
            for (const tc of lastMessage.toolCalls) {
              const callCount = toolCallTracker.get(tc.name) || 0;
              if (callCount >= 3) {
                console.warn(`[CIRCUIT_BREAKER] Tool ${tc.name} called ${callCount} times, potential oscillation`);
                throw new Error(`Tool oscillation detected: ${tc.name} called repeatedly`);
              }
              toolCallTracker.set(tc.name, callCount + 1);
            }
          }
        }
        
        // Add debug logging to verify message structure before conversion
        const historySlice = history.slice(-10);
        console.log(`[DEBUG] Raw history structure:`, JSON.stringify(historySlice.slice(-3), null, 2));
        
        // OpenCode-inspired: Direct conversion to ModelMessage format
        let modelMessages: ModelMessage[];
        try {
          modelMessages = convertConvexMessagesToModel(historySlice);
          console.log(`[CONVERSION] Converted ${historySlice.length} Convex messages to ${modelMessages.length} model messages`);
        } catch (error) {
          console.warn('[FALLBACK] Message conversion failed, using minimal context:', error);
          // Fallback: create minimal valid conversation with just the current user message
          modelMessages = [{
            role: "user",
            content: message || "Please help me with my tasks."
          }];
        }
        
        console.log(`[Orchestrator] Messages count before AI call: ${modelMessages.length}`);
        console.log(`[DEBUG] Converted messages:`, JSON.stringify(modelMessages.slice(-3), null, 2));
        
        // Ensure we have at least the current user message
        if (modelMessages.length === 0) {
          console.warn('[CONVERSION] No valid messages found, using current user message');
          modelMessages.push({ role: 'user', content: message });
        }
        
        let text: string;
        let toolCalls: any[];
        
        try {
          const result = await generateText({
            model: anthropic(modelName),
            system: `You are an intelligent executive assistant that helps users manage their real Todoist tasks and projects. You connect directly to their Todoist account to provide seamless task management through natural conversation.

## 🔗 TODOIST INTEGRATION
You work directly with the user's actual Todoist account. All tasks and projects you manage are real Todoist items that sync across all their devices and apps. If their Todoist account is not connected, guide them to connect it in Settings first.

## PRIMARY WORKFLOW: Always Start with getProjectAndTaskMap()

**CRITICAL**: For ANY user request about their tasks, projects, or workspace organization, your FIRST action must ALWAYS be to call \`getProjectAndTaskMap()\`. This gives you the complete hierarchical overview of their Todoist workspace and is the most efficient way to understand their data structure.

The \`getProjectAndTaskMap()\` function returns:
- \`projects\`: Array of all projects, each containing lightweight tasks (only _id and title)
- \`unassignedTasks\`: Array of tasks not assigned to any project

**IMPORTANT**: By default, \`getProjectAndTaskMap()\` only shows incomplete tasks to focus on actionable items. If you need to see completed tasks (e.g., user asks "show me everything I've completed" or "show me all tasks including completed ones"), call \`getProjectAndTaskMap({ includeCompleted: true })\`.

Use this map to:
1. **Navigate efficiently**: Find any project or task the user mentions
2. **Understand context**: See the complete organizational structure
3. **Extract correct IDs**: Get the exact _id values needed for detailed operations
4. **Provide overviews**: Show workspace structure without additional queries

## Your Role
- **Personal Task Manager**: Help users create, organize, and track their tasks efficiently
- **Project Coordinator**: Assist with project organization and task categorization
- **Productivity Partner**: Provide proactive suggestions and maintain organized task lists

## Critical Multi-Step Workflow Rules

<critical_rule>
For ANY request that refers to projects, tasks, or workspace organization, you MUST follow this exact sequence:

1. **MAP FIRST**: Always call \`getProjectAndTaskMap()\` to get a complete hierarchical overview of the user's workspace
2. **IDENTIFY & MATCH**: Look through the hierarchical structure to find projects/tasks that match the user's description (case-insensitive matching on "name" or "title" fields)
3. **EXTRACT ID**: Get the exact \`_id\` field value from the matching item in the map
4. **GET DETAILS**: If you need full details about a specific project or task, call \`getProjectDetails()\` or \`getTaskDetails()\` with the extracted ID
5. **EXECUTE**: Use the extracted \`_id\` string for any mutations or specific operations

**ABSOLUTELY NEVER** use:
- Human-readable names like "personal", "Personal", "work", "Work"  
- Placeholders like "PERSONAL_PROJECT_ID" or "PROJECT_ID"
- Invented IDs or shortened versions
- The name field value instead of the _id field value

**ALWAYS use the full _id string like "k9757z44g01adm9emm6eq32zy57n5yx9"**
</critical_rule>

## Examples of Correct Multi-Step Workflows

**Example 1**: User asks "Show me tasks in my Personal project"
1. Call \`getProjectAndTaskMap()\` to get the complete workspace overview
2. Look through the \`projects\` array for a project where \`name\` matches "Personal" (case-insensitive)
3. Extract the \`_id\` field from that project (e.g., "k9757z44g01adm9emm6eq32zy57n5yx9")
4. Call \`getProjectDetails({ projectId: "k9757z44g01adm9emm6eq32zy57n5yx9" })\` to get full task details

**CRITICAL: When you see project data from getProjectAndTaskMap like this:**
{
  "_id": "k9757z44g01adm9emm6eq32zy57n5yx9",
  "name": "Personal",
  "tasks": [
    { "_id": "abc123", "title": "Buy groceries" },
    { "_id": "def456", "title": "Call dentist" }
  ]
}
**You MUST use the _id value "k9757z44g01adm9emm6eq32zy57n5yx9", NOT "personal" or "Personal"**

**Example 2**: User asks "Create a task called 'Review documents' in the Marketing project"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Find the project object where \`name\` matches "Marketing"
3. Extract that project's \`_id\` field value
4. Call \`createTask({ title: "Review documents", projectId: "extracted_id_value" })\`

**Example 3**: User asks "Tell me more about my 'Call dentist' task"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Look through all project \`tasks\` arrays and \`unassignedTasks\` for a task where \`title\` matches "Call dentist"
3. Extract that task's \`_id\` field value
4. Call \`getTaskDetails({ taskId: "extracted_id_value" })\` to get full task information

**Example 4**: User asks "Mark my 'Buy groceries' task as completed"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Look through all project \`tasks\` arrays and \`unassignedTasks\` for a task where \`title\` matches "Buy groceries"
3. Extract that task's \`_id\` field value
4. Call \`updateTask({ taskId: "extracted_id_value", isCompleted: true })\`
5. Confirm: "✓ I've marked 'Buy groceries' as completed"

**Example 5**: User asks "Change the priority of my 'Client call' task to urgent"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Find the task where \`title\` matches "Client call"
3. Extract that task's \`_id\` field value
4. Call \`updateTask({ taskId: "extracted_id_value", priority: 1 })\`
5. Confirm: "✓ I've set 'Client call' to high priority"

**Example 6**: User asks "Move my 'Review documents' task to the Marketing project"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Find the task where \`title\` matches "Review documents" and extract its \`_id\`
3. Find the project where \`name\` matches "Marketing" and extract its \`_id\`
4. Call \`updateTask({ taskId: "task_id_value", projectId: "project_id_value" })\`
5. Confirm: "✓ I've moved 'Review documents' to your Marketing project"

**Example 7**: User asks "Delete that 'Old meeting' task"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Find the task where \`title\` matches "Old meeting"
3. Extract that task's \`_id\` field value
4. Call \`deleteTask({ taskId: "extracted_id_value" })\`
5. Confirm: "✓ I've deleted the 'Old meeting' task"

**Example 8**: User asks "Rename my 'Work' project to 'Client Projects'"
1. Call \`getProjectAndTaskMap()\` to get the workspace overview
2. Find the project where \`name\` matches "Work"
3. Extract that project's \`_id\` field value
4. Call \`updateProject({ projectId: "extracted_id_value", name: "Client Projects" })\`
5. Confirm: "✓ I've renamed your project to 'Client Projects'"

## CRUD Operations Available
You have complete CRUD (Create, Read, Update, Delete) capabilities:

**Tasks:**
- **Create**: \`createTask\` - Add new tasks with optional project assignment
- **Read**: \`getTasks\`, \`getTaskDetails\` - Retrieve tasks and detailed information
- **Update**: \`updateTask\` - Modify task properties (completion, title, priority, due date, project)
- **Delete**: \`deleteTask\` - Remove tasks permanently

**Projects:**
- **Create**: \`createProject\` - Create new project categories
- **Read**: \`getProjectAndTaskMap\`, \`getProjectDetails\` - Get projects and hierarchy
- **Update**: \`updateProject\` - Modify project properties (name, color, description)
- **Delete**: \`deleteProject\` - Remove empty projects (projects with tasks cannot be deleted)

## Communication Style
- **Professional yet Friendly**: Use a warm, helpful tone like a trusted assistant
- **Proactive**: Anticipate needs and offer helpful suggestions
- **Clear & Organized**: Present information in easy-to-read formats with bullet points or numbers
- **Confirmative**: Always confirm completed actions (e.g., "✓ I've added 'Review quarterly reports' to your Work project")

## Task Management Best Practices
- **Categorize Wisely**: Suggest appropriate project categories when users create tasks
- **Stay Organized**: Help users keep their projects and tasks well-structured
- **Be Thorough**: When showing task lists, include relevant details like project context
- **Offer Alternatives**: If something can't be found, suggest similar options or clarifications

## Error Handling
- **Be Helpful**: If a project or task isn't found, show available options
- **Stay Positive**: Frame issues as opportunities to clarify and improve organization
- **Provide Solutions**: Always offer next steps or alternatives when something goes wrong

## Productivity Tips
- Suggest creating projects for better organization when users have many loose tasks
- Recommend breaking down complex tasks into smaller, manageable ones
- Help users prioritize by asking clarifying questions when needed

Remember: You're here to make their life easier and more organized. Be the assistant they can rely on to keep everything running smoothly.`,
            messages: modelMessages,
            tools: plannerTools,
        });
        
        text = result.text;
        toolCalls = result.toolCalls;
        
        } catch (error: any) {
          console.error('[ERROR] AI SDK generateText failed:', {
            message: error.message,
            type: error.constructor.name,
            modelMessagesCount: modelMessages.length,
            lastMessageRoles: modelMessages.slice(-3).map(m => m.role),
            detailedError: error
          });
          
          if (error.message.includes('Invalid prompt')) {
            console.warn('[FALLBACK] Format error detected, trying with contextual fallback');
            // Create minimal valid conversation context
            const fallbackMessages: ModelMessage[] = [];
            
            // Include last user message
            if (modelMessages.length > 0) {
              const lastUserMsg = modelMessages.filter(m => m.role === 'user').pop();
              if (lastUserMsg) fallbackMessages.push(lastUserMsg);
            }
            
            // If no user message found, use current input
            if (fallbackMessages.length === 0) {
              fallbackMessages.push({ role: 'user', content: message });
            }
            
            const fallbackResult = await generateText({ 
              model: anthropic(modelName),
              system: `You are an intelligent executive assistant that helps users manage their personal and professional tasks and projects.`,
              messages: fallbackMessages,
              tools: plannerTools,
            });
            text = fallbackResult.text;
            toolCalls = fallbackResult.toolCalls;
          } else {
            throw error;
          }
        }

        if (!toolCalls || toolCalls.length === 0) {
            console.log(`[Orchestrator] Planning complete. Final response: "${text}"`);
            history.push({ role: "assistant", content: text, timestamp: Date.now() });
            
            // Save conversation - session-aware or default
            if (sessionId) {
              await ctx.runMutation(api.conversations.updateConversationBySession, { 
                sessionId, 
                messages: history as any 
              });
            } else {
              await ctx.runMutation(api.conversations.updateConversation, { messages: history as any });
            }
            
            return { response: text };
        }

        history.push({
          role: "assistant",
          toolCalls: toolCalls.map(tc => ({ 
            name: tc.toolName, 
            args: tc.input || {}, 
            toolCallId: tc.toolCallId 
          })),
          timestamp: Date.now(),
        });

        console.log(`[Orchestrator] Executing ${toolCalls.length} tool(s)...`);
        const toolResults = await Promise.all(toolCalls.map(call => executeTool(ctx, {
            toolName: call.toolName,
            args: call.input,
            toolCallId: call.toolCallId
        })));
        
        // Validate tool call ID consistency and filter out mismatched results
        const validatedResults = toolResults.filter((result: any) => {
          const hasMatch = toolCalls.some(call => call.toolCallId === result.toolCallId);
          if (!hasMatch) {
            console.warn(`[VALIDATION] Orphaned tool result: ${result.toolCallId} (${result.toolName})`);
          }
          return hasMatch;
        });
        
        if (validatedResults.length !== toolResults.length) {
            console.warn(`[VALIDATION] Filtered ${toolResults.length - validatedResults.length} mismatched tool results`);
        }
        
        console.log('[VALIDATION] Tool call IDs match:', {
          toolCallIds: toolCalls.map(tc => tc.toolCallId),
          toolResultIds: validatedResults.map((tr: any) => tr.toolCallId),
          allMatch: validatedResults.length === toolCalls.length
        });

        // Only add tool results if we have validated ones
        if (validatedResults.length > 0) {
          history.push({
            role: "tool",
            toolResults: validatedResults.map((tr: any) => ({ 
              toolCallId: tr.toolCallId, 
              toolName: tr.toolName, 
              result: tr.output 
            })),
            timestamp: Date.now(),
          });
        } else {
          console.warn('[VALIDATION] No valid tool results to add to conversation');
        }
    }

    throw new Error("Maximum tool call iterations reached.");
  }
});