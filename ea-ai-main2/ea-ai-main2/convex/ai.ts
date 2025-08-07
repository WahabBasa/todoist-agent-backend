import { action } from "./_generated/server";
import { v } from "convex/values";
import { 
  generateText, 
  tool, 
  ModelMessage, 
  ToolCallPart,
  ToolResultPart,
  TextPart
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

// Diagnostic function to pinpoint exact type mismatches
function diagnoseMessageStructure(messages: any[]): void {
  messages.forEach((msg, idx) => {
    console.log(`[DIAGNOSTIC] Message ${idx}:`, {
      role: msg.role,
      hasContent: !!msg.content,
      contentType: typeof msg.content,
      contentIsArray: Array.isArray(msg.content),
      contentStructure: Array.isArray(msg.content) 
        ? msg.content.map((c: any) => ({ type: c.type, hasRequiredFields: !!c.type }))
        : 'string'
    });
  });
}

// Helper function to validate ModelMessage structure
function validateModelMessage(msg: any): msg is ModelMessage {
  return msg.role && ['user', 'assistant', 'tool'].includes(msg.role);
}

// Type definitions for message content (for documentation purposes)

// Helper function to translate your stored message format to the Vercel AI SDK's ModelMessage format
function convertHistoryToModelMessages(
  history: {
    role: "user" | "assistant" | "tool";
    content?: string;
    toolCalls?: { name: string; args: any; toolCallId: string }[];
    toolResults?: { toolCallId: string; toolName?: string; result: any }[];
  }[]
): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];
  
  for (const message of history) {
    switch (message.role) {
      case "user":
        modelMessages.push({
          role: "user",
          content: message.content || ""
        });
        break;
        
      case "assistant":
        if (message.content) {
          // Text response
          modelMessages.push({
            role: "assistant", 
            content: message.content
          });
        } else if (message.toolCalls) {
          // Fix: Ensure proper ToolCallPart structure
          const content: ToolCallPart[] = message.toolCalls.map((tc: any): ToolCallPart => ({
            type: "tool-call" as const,
            toolCallId: tc.toolCallId,
            toolName: tc.name,
            input: tc.args
          }));
          
          modelMessages.push({
            role: "assistant",
            content
          });
        }
        break;
        
      case "tool":
        if (message.toolResults) {
          // Fix: Ensure proper ToolResultPart structure
          const content: ToolResultPart[] = message.toolResults.map((tr: any): ToolResultPart => ({
            type: "tool-result" as const,
            toolCallId: tr.toolCallId,
            toolName: tr.toolName || "unknown",
            output: tr.result
          }));
          
          modelMessages.push({
            role: "tool",
            content
          });
        }
        break;
    }
  }
  
  // Validate all messages before returning
  const validMessages = modelMessages.filter(validateModelMessage);
  if (validMessages.length !== modelMessages.length) {
    console.warn(`[Converter] Filtered ${modelMessages.length - validMessages.length} invalid messages`);
  }
  
  return validMessages;
}

// =================================================================
// 1. TOOL DEFINITIONS: What the executive assistant can do for users
//    These define the assistant's capabilities for task and project management.
// =================================================================
const plannerTools = {
  createTask: tool({
    description: "Create a new task for the user. Use this when they want to add something to their to-do list. You can optionally assign it to a specific project to keep things organized.",
    inputSchema: z.object({
      title: z.string().describe("The task title or description (e.g., 'Call the dentist', 'Review quarterly reports', 'Buy groceries')"),
      projectId: z.string().optional().describe("Optional: The project ID to categorize this task. Get project IDs by calling getProjects first."),
    }),
  }),
  getTasks: tool({
    description: "Retrieve the user's tasks. Use this to show their to-do list or find tasks within a specific project. Call without parameters to see all tasks, or with projectId to filter by project.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Optional: Filter tasks to show only those belonging to a specific project. Get project IDs using getProjects."),
    }),
  }),
  createProject: tool({
    description: "Create a new project category to help organize tasks. Use this when users want to group related tasks together (e.g., 'Work', 'Personal', 'Home Improvement', 'Vacation Planning').",
    inputSchema: z.object({
        name: z.string().describe("The project name (e.g., 'Work Projects', 'Personal Goals', 'Home Renovation', 'Marketing Campaign')"),
    }),
  }),
  getProjects: tool({
    description: "Get a list of all the user's projects with their names and IDs. Use this to find project IDs needed for other operations, or to show the user their project categories.",
    inputSchema: z.object({}),
  }),
};

// =================================================================
// 2. SYSTEM EXECUTOR: A separate, deterministic function for execution.
//    This implements the *how*.
// =================================================================
async function executeTool(ctx: ActionCtx, toolCall: any): Promise<ToolResultPart> {
    const { toolName, args, toolCallId } = toolCall;
    console.log(`[Executor] 🔧 Executing tool: ${toolName} with args:`, args);

    try {
        let result: any;
        switch (toolName) {
            case "createTask":
                result = await ctx.runMutation(api.tasks.createTask, args);
                break;
            case "getTasks":
                result = await ctx.runQuery(api.tasks.getTasks, args);
                break;
            case "createProject": {
                const color = `#${Math.floor(Math.random()*16777215).toString(16)}`;
                result = await ctx.runMutation(api.projects.createProject, { ...args, color });
                break;
            }
            case "getProjects":
                result = await ctx.runQuery(api.projects.getProjects, {});
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
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
        return {
            type: 'tool-result' as const,
            toolCallId,
            toolName,
            output: { error: errorMessage } as any,
            isError: true,
        } as ToolResultPart;
    }
}

// =================================================================
// 3. THE ORCHESTRATOR: Manages the agentic workflow.
// =================================================================
export const chatWithAI = action({
  args: {
    message: v.string(),
    useHaiku: v.optional(v.boolean()),
  },
  handler: async (ctx, { message, useHaiku = false }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User must be authenticated.");

    const modelName = useHaiku ? "claude-3-haiku-20240307" : "claude-3-5-sonnet-20240620";
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const conversation = await ctx.runQuery(api.conversations.getConversation);
    const history = (conversation?.messages as any[]) || [];
    history.push({ role: "user", content: message, timestamp: Date.now() });

    console.log(`[Orchestrator] Starting interaction for user message: "${message}"`);

    const MAX_ITERATIONS = 5;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`[Orchestrator] -> Planning iteration ${i + 1}...`);
        
        // Add debug logging to verify message structure before conversion
        const historySlice = history.slice(-10);
        console.log(`[DEBUG] Raw history structure:`, JSON.stringify(historySlice.slice(-3), null, 2));
        
        const modelMessages = convertHistoryToModelMessages(historySlice);
        console.log(`[Orchestrator] Messages count before AI call: ${modelMessages.length}`);
        console.log(`[DEBUG] Converted messages:`, JSON.stringify(modelMessages, null, 2));
        
        // Add diagnostic and validation
        diagnoseMessageStructure(modelMessages);
        
        // Validate each message conforms to ModelMessage interface
        modelMessages.forEach((msg, idx) => {
          if (!msg.role || !['user', 'assistant', 'tool'].includes(msg.role)) {
            throw new Error(`Invalid message role at index ${idx}: ${msg.role}`);
          }
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            msg.content.forEach((part: any, partIdx: number) => {
              if (!part.type) {
                throw new Error(`Missing type in assistant content part ${partIdx} at message ${idx}`);
              }
            });
          }
          if (msg.role === 'tool' && Array.isArray(msg.content)) {
            msg.content.forEach((part: any, partIdx: number) => {
              if (!part.type || part.type !== 'tool-result') {
                throw new Error(`Invalid type in tool content part ${partIdx} at message ${idx}: expected 'tool-result', got '${part.type}'`);
              }
              if (!part.toolCallId) {
                throw new Error(`Missing toolCallId in tool content part ${partIdx} at message ${idx}`);
              }
            });
          }
        });
        
        let text: string;
        let toolCalls: any[];
        
        try {
          const result = await generateText({
            model: anthropic(modelName),
            system: `You are an intelligent executive assistant that helps users manage their personal and professional tasks and projects. Whether they're executives, professionals, or anyone looking to stay organized, you help them streamline their workflow and boost productivity.

## Your Role
- **Personal Task Manager**: Help users create, organize, and track their tasks efficiently
- **Project Coordinator**: Assist with project organization and task categorization
- **Productivity Partner**: Provide proactive suggestions and maintain organized task lists

## Critical Multi-Step Workflow Rules

<critical_rule>
For ANY request that refers to a specific project or task by name (e.g., "my personal project", "tasks in the Website Redesign project", "the Deploy task"), you MUST follow this exact sequence:

1. **READ FIRST**: Always call the appropriate list function (\`getProjects()\` or \`getTasks()\`) to retrieve current data
2. **FIND & MATCH**: Look through the results to find items that match the user's description (case-insensitive matching)
3. **EXTRACT ID**: Get the exact \`_id\` field from the matching item
4. **EXECUTE**: Use that extracted \`_id\` in subsequent tool calls

**NEVER** use human-readable names, placeholders, or invented IDs like "PERSONAL_PROJECT_ID" or "personal" as arguments.
</critical_rule>

## Examples of Correct Multi-Step Workflows

**Example 1**: User asks "Show me tasks in my Personal project"
1. Call \`getProjects()\` to get all projects
2. Find project where \`name\` matches "Personal" (case-insensitive)
3. Extract the \`_id\` from that project (e.g., "jx7891k2m3n4o5p6q7r8s9t0")
4. Call \`getTasks({ projectId: "jx7891k2m3n4o5p6q7r8s9t0" })\`

**Example 2**: User asks "Create a task called 'Review documents' in the Marketing project"
1. Call \`getProjects()\` to find the Marketing project
2. Extract the Marketing project's \`_id\`
3. Call \`createTask({ title: "Review documents", projectId: "extracted_id" })\`

## Communication Style
- **Professional yet Friendly**: Use a warm, helpful tone like a trusted assistant
- **Proactive**: Anticipate needs and offer helpful suggestions
- **Clear & Organized**: Present information in easy-to-read formats with bullet points or numbers
- **Confirmative**: Always confirm completed actions (e.g., "✅ I've added 'Review quarterly reports' to your Work project")

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
          if (error.message.includes('Invalid prompt')) {
            console.warn('[FALLBACK] Using simplified message history due to format error');
            // Fall back to just the current user message
            const fallbackResult = await generateText({ 
              model: anthropic(modelName),
              system: `You are an intelligent executive assistant that helps users manage their personal and professional tasks and projects.`,
              messages: [{ role: 'user', content: message }],
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
            await ctx.runMutation(api.conversations.updateConversation, { messages: history as any });
            return { response: text };
        }

        history.push({
          role: "assistant",
          toolCalls: toolCalls.map(tc => ({ name: tc.toolName, args: (tc as any).input, toolCallId: tc.toolCallId })),
          timestamp: Date.now(),
        });

        console.log(`[Orchestrator] Executing ${toolCalls.length} tool(s)...`);
        const toolResults = await Promise.all(toolCalls.map(call => executeTool(ctx, {
            toolName: call.toolName,
            args: call.input,
            toolCallId: call.toolCallId
        })));
        
        // Verify tool call ID consistency
        console.log('[VALIDATION] Tool call IDs match:', {
          toolCallIds: toolCalls.map(tc => tc.toolCallId),
          toolResultIds: toolResults.map(tr => tr.toolCallId)
        });

        history.push({
          role: "tool",
          toolResults: toolResults.map(tr => ({ toolCallId: tr.toolCallId, toolName: tr.toolName, result: tr.output })),
          timestamp: Date.now(),
        });
    }

    throw new Error("Maximum tool call iterations reached.");
  }
});