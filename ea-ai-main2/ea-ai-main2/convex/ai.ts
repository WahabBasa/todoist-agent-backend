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

// Helper function to get the last N user-assistant message pairs for context
function getRecentMessagePairs(messages: any[], maxPairs: number): any[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Work backwards through messages to find user-assistant pairs
  const recentPairs: any[] = [];
  let pairCount = 0;
  
  // Start from the end and work backwards, but skip the very last message 
  // since it might be incomplete (we're about to add a new user message)
  for (let i = messages.length - 1; i >= 0 && pairCount < maxPairs; i--) {
    const message = messages[i];
    
    if (message.role === "assistant") {
      // Look for the preceding user message
      for (let j = i - 1; j >= 0; j--) {
        const prevMessage = messages[j];
        if (prevMessage.role === "user") {
          // Found a user-assistant pair, add them to the beginning of our array
          recentPairs.unshift(
            { role: "user", content: prevMessage.content },
            { role: "assistant", content: message.content }
          );
          pairCount++;
          i = j; // Skip to before the user message we just processed
          break;
        }
      }
    }
  }
  
  return recentPairs;
}


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
      description: "Update an existing task using the exact taskId from getTasks results",
      inputSchema: z.object({
        taskId: z.string().describe("Exact task ID from getTasks results (required)"),
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
      description: "Delete a task permanently using the exact taskId from getTasks results",
      inputSchema: z.object({
        taskId: z.string().describe("Exact task ID from getTasks results (required)"),
      }),
    };

    // Get recent conversation history for context (limited to last 6 user-assistant pairs to reduce token usage)
    const conversation = await ctx.runQuery(api.conversations.getConversation, {});
    const recentMessages = getRecentMessagePairs(conversation?.messages || [], 6);

    try {
      // Generate AI response with tools and limited conversation context
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

TOOL COORDINATION RULES:
- When users request multiple actions, execute ALL relevant tools in a SINGLE response
- Always batch related operations together - never ask "would you like me to..." 
- Use multiple tool calls when the user's intent clearly requires multiple actions
- Process all requested tasks, projects, or updates simultaneously
- Don't wait for confirmation between multiple tool calls

BATCHING EXAMPLES:
User: "Create 3 tasks: review docs, update website, call client"
Response: Execute createTask tool 3 times in one response, one for each task

User: "Show my tasks and create a new project called Marketing"
Response: Execute getTasks tool, then createProject tool in the same response

User: "Add a high priority task to review the budget and mark the presentation task as done"
Response: Execute createTask tool with priority=1, then updateTask tool with isCompleted=true

User: "Create tasks for groceries, laundry, and cleaning"
Response: Execute createTask tool 3 times immediately, don't ask for details

User: "Make a Shopping project and add buy milk task to it"
Response: Execute createProject tool first, then createTask tool with the new projectId

WORKFLOW PATTERNS:
- Before updating/deleting tasks, ALWAYS call getTasks first to see available tasks
- When user says "mark the presentation task as done", first call getTasks, find tasks matching "presentation", then call updateTask
- When user says "delete my grocery task", first call getTasks, identify the grocery task ID, then call deleteTask
- For ambiguous references, show the user available options from getTasks results
- Chain tool calls in the same response: getTasks → updateTask/deleteTask

WORKFLOW EXAMPLES:
User: "Mark my presentation task as completed"
Response: First call getTasks to find tasks, then call updateTask with the matching task ID

User: "Delete the grocery task"
Response: First call getTasks to find the grocery task, then call deleteTask with that task ID

User: "Show me my tasks and mark the urgent ones as high priority"
Response: Call getTasks first, then call updateTask multiple times for tasks that need priority updates

SIMPLIFIED WORKFLOW:
- When getTasks returns task data, use the exact _id values in updateTask/deleteTask calls
- Task IDs are provided in the getTasks results - use them exactly as returned
- Match tasks by examining the task titles and descriptions from getTasks results

ID USAGE EXAMPLES:
getTasks returns: [{"_id": "abc123", "title": "Buy groceries", "isCompleted": false}]
To mark as complete: updateTask with taskId="abc123" and isCompleted=true

User: "Mark all my tasks as complete"
Response: Call getTasks, then for each task in results, call updateTask with that task's _id

User: "Delete the grocery task"
Response: Call getTasks, find task with title containing "grocery", then call deleteTask with that task's _id

User: "Show me my tasks and mark urgent ones as high priority"
Response: Call getTasks, examine results, then call updateTask for tasks that need priority=1 using their exact _id values

Be helpful, concise, and proactive in suggesting task organization improvements. Always confirm successful operations and provide clear feedback about what was accomplished. Execute multiple tools efficiently in a single response when the user's request involves multiple actions.`,
        messages: [
          ...recentMessages,
          { role: "user", content: args.message }
        ],
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
            
            // AI SDK v5 uses 'input' instead of 'args' for tool call arguments
            const toolArgs = (toolCall as any)?.input || {};

            // Validate tool call has required structure
            if (!toolCall.toolName) {
              throw new Error("Tool call missing toolName");
            }

            switch (toolCall.toolName) {
              case "createTask":
                // Validate required fields
                if (!toolArgs.title || typeof toolArgs.title !== 'string') {
                  throw new Error("createTask requires a valid title");
                }
                
                const dueDate = toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined;
                
                const taskId = await ctx.runMutation(api.tasks.createTask, {
                  title: toolArgs.title,
                  description: toolArgs.description || undefined,
                  priority: typeof toolArgs.priority === 'number' ? toolArgs.priority : undefined,
                  dueDate,
                  projectId: toolArgs.projectId || undefined,
                  tags: Array.isArray(toolArgs.tags) ? toolArgs.tags : undefined,
                  estimatedTime: typeof toolArgs.estimatedTime === 'number' ? toolArgs.estimatedTime : undefined,
                });
                toolResult = { success: true, taskId, message: `Created task: ${toolArgs.title}` };
                break;

              case "getTasks":
                const tasks = await ctx.runQuery(api.tasks.getTasks, {
                  completed: typeof toolArgs.completed === 'boolean' ? toolArgs.completed : undefined,
                  projectId: toolArgs.projectId || undefined,
                });
                toolResult = { success: true, tasks, count: tasks.length };
                break;

              case "updateTask":
                // Validate required fields
                if (!toolArgs.taskId || typeof toolArgs.taskId !== 'string') {
                  throw new Error("updateTask requires a valid taskId");
                }
                
                const updateDueDate = toolArgs.dueDate ? new Date(toolArgs.dueDate).getTime() : undefined;
                
                try {
                  const result = await ctx.runMutation(api.tasks.updateTask, {
                    id: toolArgs.taskId as any, // Cast to handle Convex ID type
                    title: toolArgs.title || undefined,
                    description: toolArgs.description || undefined,
                    isCompleted: typeof toolArgs.isCompleted === 'boolean' ? toolArgs.isCompleted : undefined,
                    priority: typeof toolArgs.priority === 'number' ? toolArgs.priority : undefined,
                    dueDate: updateDueDate,
                    projectId: toolArgs.projectId || undefined,
                    tags: Array.isArray(toolArgs.tags) ? toolArgs.tags : undefined,
                    estimatedTime: typeof toolArgs.estimatedTime === 'number' ? toolArgs.estimatedTime : undefined,
                  });
                  toolResult = { success: true, message: `Updated task ${toolArgs.taskId}`, updatedId: result };
                } catch (mutationError) {
                  console.error("updateTask mutation failed:", mutationError);
                  throw new Error(`Failed to update task: ${mutationError instanceof Error ? mutationError.message : 'Unknown error'}`);
                }
                break;

              case "createProject":
                // Validate required fields
                if (!toolArgs.name || typeof toolArgs.name !== 'string') {
                  throw new Error("createProject requires a valid name");
                }
                if (!toolArgs.color || typeof toolArgs.color !== 'string') {
                  throw new Error("createProject requires a valid color");
                }
                
                const projectId = await ctx.runMutation(api.projects.createProject, {
                  name: toolArgs.name,
                  color: toolArgs.color,
                  description: toolArgs.description || undefined,
                });
                toolResult = { success: true, projectId, message: `Created project: ${toolArgs.name}` };
                break;

              case "getProjects":
                const projects = await ctx.runQuery(api.projects.getProjects, {});
                toolResult = { success: true, projects, count: projects.length };
                break;

              case "deleteTask":
                // Validate required fields
                if (!toolArgs.taskId || typeof toolArgs.taskId !== 'string') {
                  throw new Error("deleteTask requires a valid taskId");
                }
                
                try {
                  const result = await ctx.runMutation(api.tasks.deleteTask, {
                    id: toolArgs.taskId as any, // Cast to handle Convex ID type
                  });
                  toolResult = { success: true, message: `Deleted task ${toolArgs.taskId}`, deletedId: result };
                } catch (mutationError) {
                  console.error("deleteTask mutation failed:", mutationError);
                  throw new Error(`Failed to delete task: ${mutationError instanceof Error ? mutationError.message : 'Unknown error'}`);
                }
                break;

              default:
                toolResult = { success: false, error: `Unknown tool: ${toolCall.toolName}` };
            }

            toolResults.push({
              name: toolCall.toolName,
              args: toolArgs, // This now contains the actual input data
              result: toolResult,
            });

          } catch (error) {
            console.error(`Error executing tool ${toolCall.toolName || 'unknown'}:`, error);
            toolResults.push({
              name: toolCall.toolName || 'unknown',
              args: (toolCall as any)?.input || {},
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

