// Delegation tools are currently disabled; keep file minimal to satisfy TypeScript unused checks

/**
 * Real OpenCode-style subagent delegation tools
 * 
 * These tools delegate to specialized subagents using the task tool,
 * following the same pattern as OpenCode for true hierarchical delegation.
 * Each tool creates a proper subagent session that returns actual results.
 */

/**
 * Planning delegation tool - DISABLED
 * The planning subagent has been replaced with the planning mode
 * Planning now happens in the primary mode conversation context
 */
// export const planTask: ToolDefinition = {
//   id: "planTask",
//   description: "DISABLED - Planning now handled by planning mode instead of subagent delegation",
//   inputSchema: z.object({
//     taskDescription: z.string().describe("Description of what needs to be planned"),
//   }),
//   async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
//     return {
//       title: "Planning Tool Disabled",
//       metadata: {
//         disabled: true,
//         reason: "planning_mode_replacement"
//       },
//       output: `Planning subagent has been disabled. Planning is now handled by the planning mode in the main conversation context.`
//     };
//   }
// };

// Export the real delegation tools
export const SimpleDelegationTools = {
  // planTask is now disabled - planning handled by planning mode
};