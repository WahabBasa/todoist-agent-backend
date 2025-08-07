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
      return { type: 'tool-result', toolCallId, toolName, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      console.error(`[Executor] ❌ Tool ${toolName} failed:`, errorMessage);
      return { type: 'tool-result', toolCallId, toolName, output: { error: errorMessage }, isError: true } as unknown as ToolResultPart;
    }
  }
}

// =================================================================
// 3. HELPER FUNCTIONS: Support multi-step planning
// =================================================================
function buildContextFromPreviousResults(allToolCalls: ToolCallPart[], allToolResults: ToolResultPart[]): string {
  if (allToolResults.length === 0) return '';
  
  const resultsSummary = allToolResults.map(tr => 
    `Tool ${tr.toolName}: ${JSON.stringify(tr.output)}`
  ).join('\n');
  
  return `\nPrevious tool execution results:\n${resultsSummary}\n\nUse this information to continue planning if needed.`;
}

// =================================================================
// 4. THE ORCHESTRATOR: Manages the entire workflow.
// This is the main action that coordinates between the user, the
// AI Planner, and the System Executor with iterative planning.
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
      // --- Step 1: Iterative Planning Loop ---
      const allToolCalls: ToolCallPart[] = [];
      const allToolResults: ToolResultPart[] = [];
      let planningComplete = false;
      let iterations = 0;
      const MAX_ITERATIONS = 5;
      
      console.log(`[Orchestrator] Starting iterative planning loop...`);
      
      while (!planningComplete && iterations < MAX_ITERATIONS) {
        console.log(`[Orchestrator] -> Planning iteration ${iterations + 1}...`);
        
        // Build proper conversation context  
        const contextMessages: CoreMessage[] = [...messages];
        
        // Add all previous tool calls and results in proper sequence
        for (let i = 0; i < allToolCalls.length; i++) {
          // Add assistant message with tool call
          contextMessages.push({
            role: 'assistant',
            content: [{
              type: 'tool-call' as const,
              toolCallId: allToolCalls[i].toolCallId,
              toolName: allToolCalls[i].toolName,
              input: allToolCalls[i].input
            }]
          });
          
          // Add corresponding tool result
          if (allToolResults[i]) {
            contextMessages.push({
              role: 'tool',
              content: [{
                type: 'tool-result' as const,
                toolCallId: allToolResults[i].toolCallId,
                toolName: allToolResults[i].toolName,
                output: allToolResults[i].output
              }]
            });
          }
        }
        
        const plannerResult = await generateText({
          model: anthropic(modelName),
          system: `You are a database-aware AI Planner that creates tool call sequences.
  
When previous results are provided, use them to continue the plan.
If the user asks about specific items (like "tasks in project X"), you MUST:
1. First call the appropriate list function if you don't have the data
2. Use the results to get the specific ID
3. Call the next function with that ID

<critical_rule>
For ANY request that refers to a specific project or task by name (e.g., "my personal project", "the 'Deploy' task"), you MUST follow this exact sequence:
1.  **READ**: Call \`getProjects()\` or \`getTasks()\` to retrieve a list of all items.
2.  **FIND**: In your internal reasoning, find the item in the list that matches the user's description (e.g., the project where \`name\` is "Personal").
3.  **EXTRACT**: Get the exact \`_id\` value from that item.
4.  **EXECUTE**: Use that extracted \`_id\` in the subsequent tool call (e.g., \`getTasks({ projectId: "jx123abc" })\`).

You are forbidden from using human-readable names or invented placeholders like "PERSONAL_PROJECT_ID" as arguments for \`projectId\` or \`taskId\`.
</critical_rule>

<example_correct_workflow>
User Request: "What are the tasks in my 'Personal' project?"
Your Plan (Tool Calls):
1. \`getProjects()\`
2. \`getTasks({ projectId: "id_from_step_1_result" })\`
</example_correct_workflow>

Respond with tool calls OR indicate completion with a text response when you have enough information to answer the user's question.`,
          messages: contextMessages,
          tools: plannerTools,
        });
        
        // Check if planning is complete
        if (!plannerResult.toolCalls || plannerResult.toolCalls.length === 0) {
          console.log(`[Orchestrator] Planning complete after ${iterations + 1} iterations.`);
          planningComplete = true;
          
          // If this is the first iteration and no tools needed, respond directly
          if (iterations === 0) {
            console.log(`[Orchestrator] No tools needed. Responding directly.`);
            console.log(`[Orchestrator] Planner's response: "${plannerResult.text}"`);
            await ctx.runMutation(api.conversations.addMessage, { role: "user", content: message });
            await ctx.runMutation(api.conversations.addMessage, { role: "assistant", content: plannerResult.text });
            return { response: plannerResult.text };
          }
          
          break;
        }
        
        // Execute new tool calls
        console.log(`[Orchestrator] Executing ${plannerResult.toolCalls.length} tool(s) in iteration ${iterations + 1}...`);
        console.log('[Orchestrator] Tool calls:', JSON.stringify(plannerResult.toolCalls, null, 2));
        
        for (const toolCall of plannerResult.toolCalls) {
          const result = await SystemExecutor.executeTool(ctx, toolCall);
          allToolCalls.push(toolCall);
          allToolResults.push(result);
        }
        
        iterations++;
      }
      
      console.log(`[Orchestrator] Planning completed with ${allToolCalls.length} total tool calls across ${iterations} iterations.`);

      // --- Step 2: Call the AI Reporter ---
      console.log(`[Orchestrator] -> Calling AI Reporter to summarize results...`);
      
      const toolResultsContext = allToolResults.map(tr => 
        `Tool ${tr.toolName}: ${JSON.stringify(tr.output)}`
      ).join('\n');

      const reporterResult = await generateText({
        model: anthropic(modelName),
        system: `You are the AI Reporter. The following tools were executed successfully:
${toolResultsContext}

Based on the user's request: "${message}"
Summarize these results clearly for the user. If the plan was successful, confirm the action. If any part failed, report the error clearly.`,
        messages: [{ role: "user", content: message }], // Provide the current user message
      });
      
      // NEW LOGGING
      console.log(`[Orchestrator] Reporter's response: "${reporterResult.text}"`);

      // --- Step 3: Persist and Return ---
      console.log(`[Orchestrator] Interaction complete. Saving history and returning final response.`);
      
      const assistantMessage = { 
        role: "assistant", 
        content: reporterResult.text,
        timestamp: Date.now(),
        toolCalls: allToolCalls.map((tc, idx) => ({
          name: tc.toolName,
          args: tc.input,
          result: allToolResults[idx]?.output,
        })),
      };
      
      console.log('[Orchestrator] About to store assistant message:', {
        content: assistantMessage.content,
        toolCallsCount: assistantMessage.toolCalls?.length || 0
      });
      
      await ctx.runMutation(api.conversations.updateConversation, {
        messages: [
          ...(conversation?.messages || []),
          { role: "user", content: message, timestamp: Date.now() },
          assistantMessage
        ] as any,
      });

      return {
        response: reporterResult.text,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      };

    } catch (error) {
      console.error("[Orchestrator] ❌ An error occurred during the interaction:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      await ctx.runMutation(api.conversations.addMessage, { 
        role: "assistant", 
        content: `I'm sorry, I encountered an internal error: ${errorMessage}` 
      });
      throw error;
    }
  },
});