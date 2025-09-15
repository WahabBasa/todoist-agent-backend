import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";

/**
 * Real OpenCode-style subagent delegation tools
 * 
 * These tools delegate to specialized subagents using the task tool,
 * following the same pattern as OpenCode for true hierarchical delegation.
 * Each tool creates a proper subagent session that returns actual results.
 */

/**
 * Planning delegation tool - delegates to planning subagent
 * This replaces the broken "planTask" that only created todos
 */
export const planTask: ToolDefinition = {
  id: "planTask",
  description: "Delegate to the planning subagent for detailed task planning with Eisenhower Matrix prioritization. Use this when you need strategic planning and task breakdown.",
  inputSchema: z.object({
    taskDescription: z.string().describe("Description of what needs to be planned"),
    timeframe: z.string().optional().describe("Expected timeframe or deadline"),
    constraints: z.string().optional().describe("Any constraints or limitations to consider"),
    priority: z.enum(["high", "medium", "low"]).default("medium").describe("Initial priority assessment"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { taskDescription, timeframe, constraints, priority } = args;
      
      // Create detailed prompt for planning subagent
      const planningPrompt = [
        `PLANNING REQUEST: ${taskDescription}`,
        timeframe ? `Timeframe: ${timeframe}` : '',
        constraints ? `Constraints: ${constraints}` : '',
        priority ? `Initial Priority Assessment: ${priority}` : '',
        '',
        'Please analyze this request and create a detailed plan using the Eisenhower Matrix.',
        'Include specific tasks, realistic due dates, and proper prioritization.',
        'Consider the current date/time context and user\'s existing commitments.',
      ].filter(Boolean).join('\n');

      // Import the task tool for delegation
      const { taskTool } = await import("./taskTool");
      
      // Delegate to planning subagent
      const result = await taskTool.execute({
        subagentType: "planning",
        prompt: planningPrompt,
        description: `Planning: ${taskDescription.substring(0, 30)}...`
      }, ctx, actionCtx);

      return {
        title: "Planning Completed",
        metadata: { 
          delegatedTo: "planning",
          taskDescription: taskDescription.substring(0, 100),
          approach: "subagent_delegation"
        },
        output: result.output
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Planning delegation failed";
      
      return {
        title: "Planning Failed", 
        metadata: { 
          task: args.taskDescription,
          error: true 
        },
        output: `Planning delegation failed: ${errorMessage}\n\nThe planning subagent could not process this request. Please try rephrasing or breaking it into smaller planning tasks.`
      };
    }
  }
};

// Export the real delegation tools
export const SimpleDelegationTools = {
  planTask,
};