import { z } from "zod";
import { ModeController } from "../modes/controller";
import { ToolDefinition } from "../toolRegistry";

// Enhanced switchMode tool based on Roo-Code pattern but without user approval mechanism
// Allows LLM to autonomously switch modes for goal-driven execution
export const switchModeTool: ToolDefinition = {
  id: "switchMode",
  description: "Autonomously switch to a different mode for specialized task execution. Use this when the current mode lacks the appropriate tools or context for the task at hand. This helps reduce user overwhelm and operational overhead by automatically selecting the most appropriate execution context.",
  inputSchema: z.object({
    modeName: z.string().describe("The name of the mode to switch to (e.g., 'primary', 'information-collector', 'planning', etc.)"),
    reason: z.string().describe("The reason for switching to this mode - what specific capabilities or tools this mode provides that the current mode doesn't have"),
    goalDrivenSwitch: z.boolean().optional().describe("Set to true if this switch is goal-driven to reduce user overwhelm or operational overhead (default: true)"),
  }),
  async execute(args: any, ctx: any, actionCtx: any) {
    const { modeName, reason, goalDrivenSwitch } = args;
    
    // Ensure sessionId is available for mode switching
    if (!ctx.sessionId) {
      throw new Error("Switch mode operation requires an active session");
    }
    
    // Perform the mode switch using ModeController
    const switchSuccess = await ModeController.handleModeSwitch(ctx.sessionId, modeName, ctx);
    
    if (switchSuccess) {
      return {
        title: `Successfully switched to ${modeName} mode`,
        metadata: {
          modeName,
          reason,
          goalDrivenSwitch: goalDrivenSwitch || false,
          success: true
        },
        output: `Successfully switched to ${modeName} mode because: ${reason}`
      };
    } else {
      return {
        title: `Failed to switch to ${modeName} mode`,
        metadata: {
          modeName,
          reason,
          success: false,
          error: `Mode switch failed - mode may not exist or switch operation failed`
        },
        output: `Failed to switch to ${modeName} mode. Mode may not exist or switch operation failed.`
      };
    }
  }
};