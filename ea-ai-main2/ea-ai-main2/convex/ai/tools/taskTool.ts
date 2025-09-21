import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import { PrimaryModeRegistry } from "../modes/registry";
import { SubagentRegistry } from "../subagents/registry";
import { executeSubagent } from "../subagents/executor";
import { logSubagentCall, logSubagentResponse } from "../langfuse/logger";
import { Id } from "../../_generated/dataModel";

/**
 * Type guard to ensure sessionId is a valid Convex ID
 */
function validateSessionId(sessionId: string | Id<"chatSessions"> | undefined): Id<"chatSessions"> {
  if (!sessionId) {
    throw new Error("Session ID is required for task delegation");
  }
  
  // Since Id<"chatSessions"> is just a string at runtime, cast it directly
  return sessionId as Id<"chatSessions">;
}

/**
 * Enhanced TaskTool - Unified Primary Mode + Subagent System
 * 
 * Supports two distinct systems:
 * 1. Primary Modes (context-preserving): primary, information-collector
 * 2. Subagents (isolated execution): planning, execution, general, custom
 * 
 * Following OpenCode's pattern but adapted for Convex multi-user environment
 */

// Generate dynamic description with available subagents
function generateTaskToolDescription(): string {
  const subagentList = SubagentRegistry.generateSubagentListDescription();
  
  return `Launch specialized modes or subagents for complex, multi-step tasks autonomously.

PRIMARY MODES (context preserved, same conversation):
- information-collector: Systematic information gathering and user questioning

AVAILABLE SUBAGENTS (isolated execution, no parent context):
${subagentList}

USAGE GUIDELINES:
- Use primary-mode for information gathering that needs conversation context
- Use subagents for isolated analysis, planning, or execution tasks
- Primary modes preserve all conversation history and context
- Subagents run in complete isolation with only the provided prompt

WHEN TO USE:
- Complex tasks requiring specialized expertise
- Multi-step operations requiring focused processing
- Tasks that benefit from specialized system prompts and tool sets

WHEN NOT TO USE:
- Simple, single-step tasks that can be handled directly
- Quick lookups or basic operations`;
}

export const taskTool: ToolDefinition = {
  id: "task",
  description: generateTaskToolDescription(),
  
  inputSchema: z.object({
    targetType: z.enum(["primary-mode", "subagent"]).describe("Type of delegation: primary-mode for context-preserving modes, subagent for isolated execution"),
    targetName: z.string().describe("Name of the target: 'information-collector' for primary-mode, or subagent name like 'planning', 'execution', 'general'"),
    prompt: z.string().describe("Clear, detailed description of the task to delegate. Be specific about what analysis, research, or work is needed."),
    description: z.string().optional().describe("Short 3-5 word description of the task for progress tracking"),
  }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    const { targetType, targetName, prompt, description } = args;
    const taskDescription = description || `${targetName} task`;
    
    console.log(`[TASK_DELEGATION] Starting ${targetType} delegation to ${targetName}: ${taskDescription}`);

    if (targetType === "primary-mode") {
      return await executePrimaryMode(targetName, prompt, ctx, actionCtx);
    } else {
      return await executeSubagentMode(targetName, prompt, ctx, actionCtx);
    }
  }
};

/**
 * Execute primary mode (context-preserving, same conversation)
 */
async function executePrimaryMode(
  modeName: string,
  prompt: string,
  ctx: ToolContext,
  actionCtx: ActionCtx
): Promise<any> {
  // Validate primary mode exists
  if (!PrimaryModeRegistry.isValidPrimaryMode(modeName)) {
    throw new Error(`Invalid primary mode: ${modeName}. Available modes: primary, information-collector`);
  }

  const modeConfig = PrimaryModeRegistry.getPrimaryMode(modeName);
  if (!modeConfig) {
    throw new Error(`Primary mode configuration not found: ${modeName}`);
  }

  console.log(`[PRIMARY_MODE] Switching to ${modeName} mode in current conversation`);

  // For primary modes, we inject the mode prompt into the current conversation
  // This preserves context like OpenCode's plan/build mode switching
  
  // Validate and get proper sessionId
  const validSessionId = validateSessionId(ctx.sessionId);

  if (modeConfig.promptInjection) {
    // Add synthetic message part with mode prompt (like OpenCode)
    await actionCtx.runMutation(api.conversations.addSyntheticMessage, {
      sessionId: validSessionId,
      content: modeConfig.promptInjection,
      timestamp: Date.now(),
    });
  }

  // Update session to track primary mode
  await actionCtx.runMutation(api.chatSessions.updateChatSession, {
    sessionId: validSessionId,
    modeName: modeName,
  });

  // Return indication that mode switch occurred
  // The actual mode execution happens in the continuing conversation
  return {
    title: `Switched to ${modeName} mode`,
    metadata: { 
      modeType: "primary-mode",
      modeName,
      contextPreserved: true,
      promptInjected: !!modeConfig.promptInjection
    },
    output: `Now in ${modeName} mode. ${modeConfig.description}. Context from this conversation is preserved.`
  };
}

/**
 * Execute subagent (isolated execution, new conversation)
 */
async function executeSubagentMode(
  subagentName: string,
  prompt: string,
  ctx: ToolContext,
  actionCtx: ActionCtx
): Promise<any> {
  // Validate subagent exists
  if (!SubagentRegistry.isValidSubagent(subagentName)) {
    const availableSubagents = SubagentRegistry.listSubagents().map(s => s.name).join(", ");
    throw new Error(`Invalid subagent: ${subagentName}. Available subagents: ${availableSubagents}`);
  }

  const subagentConfig = SubagentRegistry.getSubagent(subagentName);
  if (!subagentConfig) {
    throw new Error(`Subagent configuration not found: ${subagentName}`);
  }

  console.log(`[SUBAGENT] Executing ${subagentName} subagent in isolated conversation`);

  // Log subagent call for monitoring
  logSubagentCall({
    subagentType: subagentName,
    systemPrompt: subagentConfig.systemPrompt,
    userMessage: prompt,
    conversationHistory: [], // No parent context passed
    timestamp: new Date().toLocaleTimeString()
  });

  // Validate and get proper sessionId
  const validSessionId = validateSessionId(ctx.sessionId);

  const executionStartTime = Date.now();

  try {
    // Execute subagent in complete isolation (like OpenCode pattern)
    const result = await executeSubagent(actionCtx, {
      subagentName,
      prompt,
      parentSessionId: validSessionId,
      userId: ctx.userId,
      currentTimeContext: ctx.currentTimeContext,
    });

    const executionTime = Date.now() - executionStartTime;

    // Log subagent response
    logSubagentResponse({
      subagentType: subagentName,
      response: result.result,
      executionTime
    });

    console.log(`[SUBAGENT_COMPLETED] ${subagentName} completed in ${result.executionTimeMs}ms`);

    return {
      title: `${subagentName} Task Completed`,
      metadata: { 
        modeType: "subagent",
        subagentName,
        executionTimeMs: result.executionTimeMs,
        toolCallsCount: result.toolCallsCount,
        isolated: true,
        sessionId: result.sessionId
      },
      output: result.result
    };

  } catch (error) {
    const executionTime = Date.now() - executionStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[SUBAGENT_ERROR] ${subagentName} failed after ${executionTime}ms:`, errorMessage);

    return {
      title: `${subagentName} Task Failed`,
      metadata: { 
        modeType: "subagent",
        subagentName,
        executionTimeMs: executionTime,
        error: errorMessage,
        isolated: true
      },
      output: `Subagent execution failed: ${errorMessage}`
    };
  }
}

// Export the TaskTool for registration
export const TaskTool = {
  task: taskTool,
};

// Helper function to refresh task tool description when subagents change
export function refreshTaskToolDescription(): void {
  taskTool.description = generateTaskToolDescription();
}