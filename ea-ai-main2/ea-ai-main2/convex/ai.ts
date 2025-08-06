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
    const { toolName, toolCallId } = toolCall;
    const args = (toolCall as any).input; // ToolCallPart uses 'input' property
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
      return { type: 'tool-result', toolCallId, toolName, output: result } as unknown as ToolResultPart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      console.error(`[Executor] ❌ Tool ${toolName} failed:`, errorMessage);
      return { type: 'tool-result', toolCallId, toolName, output: errorMessage, isError: true } as unknown as ToolResultPart;
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
        system: `You are the AI Planner. Your job is to analyze the user's request and create a step-by-step plan using the available tools.
        - If an action is required, your ONLY output should be tool calls.
        - If no action is required, you may respond conversationally.
        - You MUST use database IDs returned from 'get' tools for any calls that reference existing items.`,
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
      const reporterResult = await generateText({
        model: anthropic(modelName),
        system: `You are the AI Reporter. You have been given the results of a plan that was just executed. Your job is to communicate these results to the user clearly and concisely.
        - If the plan was successful, confirm the action.
        - If any part of the plan failed, you MUST report the error clearly.`,
        messages: [
          ...messages,
          { role: 'assistant', content: plannerResult.toolCalls.map(tc => ({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: (tc as any).input
          })) },
          { role: 'tool', content: toolResults as ToolResultPart[] }
        ],
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
              args: (tc as any).input,
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