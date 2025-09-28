import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import { PrimaryModeRegistry } from "../modes/registry";
import { SubagentRegistry } from "../subagents/registry";
import { executeSubagent } from "../subagents/executor";
import { logSubagentCall, logSubagentResponse } from "../langfuse/logger";
import { Id } from "../../_generated/dataModel";
import { ConversationState } from "../state/ConversationState";

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
- information-collector: Natural conversations to understand when important tasks are due and how long they take. Focuses on tasks that matter most.

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
  
  inputSchema: z.object({ // Enhanced Zod for structured delegation
    targetType: z.enum(["primary-mode", "subagent"]),
    targetName: z.string().min(1).max(50),
    prompt: z.string().min(10).max(2000),
    description: z.string().max(100).optional(),
    delegationMetadata: z.object({ // New: AgentPart-like structure
      reason: z.string().optional(),
      expectedOutput: z.string().optional(),
      priority: z.enum(["high", "medium", "low"]).optional()
    }).optional()
  }).refine((data) => {
    if (data.targetType === "primary-mode") {
      return ["primary", "information-collector"].includes(String(data.targetName));
    }
    return true;
  }, { message: "Invalid target for type" }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    // Zod validation already handled by schema
    const validatedArgs = taskTool.inputSchema.parse(args);
    const { targetType, targetName, prompt, description, delegationMetadata } = validatedArgs;
    const taskDescription = description || `${targetName} task`;
    
    console.log(`[TASK_DELEGATION] Starting ${targetType} to ${targetName}: ${taskDescription}`);
    
    // Update ConversationState with delegation (OpenCode AgentPart)
    const convState = new ConversationState(); // Assume loaded from session
    convState.setCurrentMode(targetName);
    const delegationId = `del_${Date.now()}`;
    convState.startToolExecution('task', delegationId);
    convState.updateToolState(delegationId, 'running');
  
    const refinedPrompt = prompt;
  
    let result;
    if (targetType === "primary-mode") {
      result = await executePrimaryMode(targetName, refinedPrompt, ctx, actionCtx);
    } else {
      result = await executeSubagentMode(targetName, refinedPrompt, ctx, actionCtx);
    }
  
    // Update state post-execution
    convState.updateToolState(delegationId, 'completed', result);
    // Embed in return for message
    return {
      ...result,
      embeddedMetadata: {
        delegation: {
          target: targetName,
          status: 'completed',
          reason: delegationMetadata?.reason
        },
        toolStates: convState.getEmbeddedToolStates()
      }
    };
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
      content: prompt, // Use refinedPrompt instead of modeConfig.promptInjection
      timestamp: Date.now(),
    });
  }

  // Persist the active mode in the session for continuity
  await actionCtx.runMutation(api.chatSessions.updateActiveMode, {
    sessionId: validSessionId,
    activeMode: modeName
  });

  // Return indication that mode switch occurred
  // The actual mode execution happens in the continuing conversation
  // DO NOT update the session mode in the database to prevent UI refresh
  return {
    title: `Switched to ${modeName} mode`,
    metadata: {
      modeType: "primary-mode",
      modeName,
      contextPreserved: true,
      promptInjected: !!modeConfig.promptInjection
    },
    output: `Now in ${modeName} mode. ${modeConfig.description}. Context from this conversation is preserved. I'll now ask you some questions to help organize your tasks.`
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
    systemPrompt: SubagentRegistry.getSystemPrompt(subagentName),
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