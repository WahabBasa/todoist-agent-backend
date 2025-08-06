import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateText, tool, CoreMessage, ToolCallPart, ToolResultPart } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { z } from "zod";
import { Id } from "./_generated/dataModel";
import { ActionCtx } from "./_generated/server";

// =================================================================
// 1. AI PLANNER'S VIEW: Tools the AI can *request*.
// These definitions only describe what the tool does and what inputs
// it needs. The actual execution logic is handled by the Executor.
// =================================================================
const plannerTools = {
  createTask: tool({
    description: "Create a new task. The `title` is required.",
    inputSchema: z.object({
      title: z.string().describe("The title for the new task."),
      projectId: z.string().optional().describe("To add this task to a project, provide the project's database ID here. You can get this ID by calling `getProjects`."),
    }),
  }),
  getTasks: tool({
    description: "Retrieve a list of all tasks. Can be filtered by project.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("The database ID of a project to filter tasks by."),
    }),
  }),
  createProject: tool({
    description: "Create a new project. The `name` is required.",
    inputSchema: z.object({
        name: z.string().describe("The name for the new project."),
    }),
  }),
  getProjects: tool({
    description: "Retrieve a list of all projects to get their names and database IDs.",
    inputSchema: z.object({}),
  }),
};

// =================================================================
// 2. SYSTEM EXECUTOR: The reliable "dumb" worker.
// This part of the system doesn't think. It receives a plan from the
// AI Planner and executes the corresponding functions deterministically.
// =================================================================
namespace SystemExecutor {
  export async function executeTool(ctx: ActionCtx, toolCall: ToolCallPart): Promise<ToolResultPart> {
    const { toolName, input: args, toolCallId } = toolCall;
    console.log(`[Executor] 🔧 Executing tool: ${toolName} with args: ${JSON.stringify(args)}`);

    try {
      let result: any;
      switch (toolName) {
        case "createTask":
          result = await ctx.runMutation(api.tasks.createTask, args as any);
          break;
        case "getTasks":
          result = await ctx.runQuery(api.tasks.getTasks, args as any);
          break;
        case "createProject":
          const color = `#${Math.floor(Math.random()*16777215).toString(16)}`;
          result = await ctx.runMutation(api.projects.createProject, { ...(args as any), color });
          break;
        case "getProjects":
          result = await ctx.runQuery(api.projects.getProjects, {});
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      console.log(`[Executor] ✅ Tool ${toolName} executed successfully.`);
      // --- FIX: Return object must use the 'result' property ---
      return { type: 'tool-result', toolCallId, toolName, output: result } as ToolResultPart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      console.error(`[Executor] ❌ Tool ${toolName} failed:`, errorMessage);
      // --- FIX: Errors must also be returned in the 'result' property ---
      return { type: 'tool-result', toolCallId, toolName, output: { error: errorMessage }, isError: true } as unknown as ToolResultPart;
    }
  }
}

// =================================================================
// 3. THE ORCHESTRATOR: Manages the entire workflow.
// This is the main action that coordinates between the user, the
// AI Planner, and the System Executor.
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

    // --- Context Assembly ---
    const conversation = await ctx.runQuery(api.conversations.getConversation);
    const messages: CoreMessage[] = (conversation?.messages as CoreMessage[])?.slice(-10) || [];
    messages.push({ role: "user", content: message });
    
    console.log(`[Orchestrator] Starting interaction for user message: "${message}"`);

    try {
      // --- Step 1: Call the AI Planner ---
      console.log(`[Orchestrator] -> Calling AI Planner...`);
      const plannerResult = await generateText({
        model: anthropic(modelName),
        // --- FIX: Injected the new, stricter system prompt ---
        system: `You are a database-aware AI Planner. Your only job is to create a sequence of tool calls to fulfill the user's request.

<critical_rule>
For ANY request that refers to a specific project or task by name (e.g., "my personal project", "the 'Deploy' task"), you MUST follow this exact sequence:
1.  **READ**: Call \`getProjects()\` or \`getTasks()\` to retrieve a list of all items.
2.  **FIND**: In your internal reasoning, find the item in the list that matches the user's description (e.g., the project where \`name\` is "Personal").
3.  **EXTRACT**: Get the exact \`_id\` value from that item.
4.  **EXECUTE**: Use that extracted \`_id\` in the next tool call (e.g., \`getTasks({ projectId: "jx123abc" })\`).

You are forbidden from using human-readable names or invented placeholders like "PERSONAL_PROJECT_ID" as arguments for \`projectId\` or \`taskId\`.
</critical_rule>

<example_correct_workflow>
User Request: "What are the tasks in my 'Personal' project?"
Your Plan (Tool Calls):
1. \`getProjects()\`
2. \`getTasks({ projectId: "id_from_step_1_result" })\`
</example_correct_workflow>

If a request is conversational (e.g., "hello"), you may respond with text. Otherwise, your only output should be tool calls.`,
        messages,
        tools: plannerTools,
      });

      // --- Step 2: Orchestrate Execution ---
      
      // Case A: The Planner decided no tools were needed.
      if (!plannerResult.toolCalls || plannerResult.toolCalls.length === 0) {
        console.log(`[Orchestrator] Planner decided no tools were needed. Responding directly.`);
        await ctx.runMutation(api.conversations.addMessage, { role: "user", content: message });
        await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: plannerResult.text });
        return { response: plannerResult.text };
      }

      // Case B: The Planner created a plan. Now, the Executor runs it.
      console.log(`[Orchestrator] Planner returned a plan with ${plannerResult.toolCalls.length} step(s).`);
      const toolResults = await Promise.all(
        plannerResult.toolCalls.map(toolCall => SystemExecutor.executeTool(ctx, toolCall))
      );
      
      // --- Step 3: Call the AI Reporter ---
      console.log(`[Orchestrator] -> Calling AI Reporter to summarize results...`);
      
      const toolResultsContext = toolResults.map(tr => 
        `Tool ${tr.toolName}: ${JSON.stringify(tr.output)}`
      ).join('\n');

      const reporterMessages: CoreMessage[] = [
        ...messages.slice(0, -1), // All messages except the current user message
        { role: "user", content: message }, // Current user message as simple string
      ];

      const reporterResult = await generateText({
        model: anthropic(modelName),
        system: `You are the AI Reporter. The following tools were executed successfully:
${toolResultsContext}

Summarize these results clearly for the user. If the plan was successful, confirm the action. If any part failed, report the error clearly.`,
        messages: reporterMessages,
      });

      // --- Step 4: Persist and Return ---
      console.log(`[Orchestrator] Interaction complete. Saving history and returning final response.`);
      await ctx.runMutation(api.conversations.updateConversation, {
        messages: [
          ...(conversation?.messages || []),
          { role: "user", content: message, timestamp: Date.now() },
          { 
            role: "assistant", 
            content: reporterResult.text,
            timestamp: Date.now(),
            toolCalls: plannerResult.toolCalls.map(tc => ({
              name: tc.toolName,
              // --- FIX: Use 'args' to match the ToolCallPart schema ---
              args: tc.input,
              // --- FIX: Use 'result' to match the ToolResultPart schema ---
              result: toolResults.find(tr => tr.toolCallId === tc.toolCallId)?.output,
            })),
          }
        ] as any,
      });

      return {
        response: reporterResult.text,
        toolCalls: plannerResult.toolCalls,
        toolResults,
      };

    } catch (error) {
      console.error("[Orchestrator] ❌ An error occurred during the interaction:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      // Persist the error message for the user
      await ctx.runMutation(api.conversations.addMessage, { 
        role: "assistant", 
        content: `I'm sorry, I encountered an internal error: ${errorMessage}` 
      });
      throw error;
    }
  },
});