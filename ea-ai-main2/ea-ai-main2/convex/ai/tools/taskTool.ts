import { z } from "zod";
import { ToolDefinition, ToolContext, createSimpleToolRegistry } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { ModeRegistry } from "../modes/registry";
import { streamText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "../system";
import { logSubagentCall, logSubagentResponse } from "../langfuse/logger";

// Static imports following OpenCode pattern - guaranteed assignment at compile time
import { prompt as executionPrompt } from "../prompts/execution_new";
import { prompt as planningPrompt } from "../prompts/planning_new";
// Note: information-collector prompt is in system.ts

/**
 * TaskTool - OpenCode-Style Stateless Mode Delegation
 * 
 * Following OpenCode's delegation pattern:
 * - No child session creation in database
 * - Stateless mode execution within same action
 * - Filtered tool access based on mode permissions
 * - Direct result return to primary mode
 * 
 * Key difference from OpenCode: Adapted for Convex's multi-user environment
 */
export const taskTool: ToolDefinition = {
  id: "task",
  description: `Launch a specialized mode to handle complex, multi-step tasks autonomously.

Available modes and their specializations:
- information-collector: Systematic information gathering and user questioning
- planning: Strategic planning and task organization with Eisenhower Matrix prioritization  
- execution: Direct task and calendar operations with data validation

When to use this tool:
- Complex tasks requiring specialized expertise
- Multi-step task management operations
- Tasks that benefit from focused, specialized processing
- Read-only analysis and investigation tasks

When NOT to use this tool:
- Simple, single-step tasks
- Tasks requiring file modifications (primary mode handles these)
- Quick lookups that don't need deep analysis

The mode will work autonomously as your specialized tool and return concise results for integration into your response.`,
  
  inputSchema: z.object({
    modeType: z.enum(["information-collector", "planning", "execution"]).describe("Which specialized mode to use for this task"),
    prompt: z.string().describe("Clear, detailed description of the task to delegate. Be specific about what analysis or research is needed."),
    description: z.string().optional().describe("Short 3-5 word description of the task for progress tracking"),
  }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    const { modeType, prompt, description } = args;
    const taskDescription = description || `${modeType} task`;
    
    // Log mode delegation
    console.log(`[MODE_DELEGATION] Starting ${modeType} mode delegation for task: ${taskDescription}`);

    // Validate mode exists (following OpenCode pattern)
    if (!ModeRegistry.canUseAsInformationCollector(modeType) && 
        !ModeRegistry.canUseAsPlanning(modeType) && 
        !ModeRegistry.canUseAsExecution(modeType)) {
      throw new Error(`Invalid or unavailable mode: ${modeType}`);
    }
    
    const modeConfig = ModeRegistry.getMode(modeType);
    if (!modeConfig) {
      throw new Error(`Mode configuration not found: ${modeType}`);
    }

    // Update metadata to show delegation started (following OpenCode pattern)
    // Metadata handled by tool registry bridge - ctx.metadata({
    //   title: `Delegating to ${modeType} mode`,
    //   metadata: {
    //     mode: modeType,
    //     taskDescription,
    //     promptLength: prompt.length
    //   }
    // });

    // Get filtered tools for mode (following OpenCode's tool filtering)
    const modeTools = await getToolsForMode(modeConfig, actionCtx, ctx);
    console.log(`[MODE_TOOLS] Created ${Object.keys(modeTools).length} filtered tools for ${modeType}`);

    // Get the appropriate system prompt for the mode
    let modeSystemPrompt = "";
    if (modeType === "execution") {
      modeSystemPrompt = executionPrompt;
    } else if (modeType === "planning") {
      modeSystemPrompt = planningPrompt;
    } else {
      // For information-collector and other modes, get from SystemPrompt
      modeSystemPrompt = await SystemPrompt.getSystemPrompt(
        actionCtx,
        "anthropic/claude-3.5-haiku-20241022",
        "",
        prompt,
        ctx.userId,
        modeType
      );
    }
    
    console.log(`[MODE_PROMPT] Loaded specialized prompt for ${modeType}`);

    // Create OpenRouter client for mode execution
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const model = openrouter.chat("anthropic/claude-3.5-haiku-20241022");

    console.log(`[MODE_EXECUTION] Executing ${modeType} mode with filtered tools`);

    // Log mode call with full context
    logSubagentCall({
      subagentType: modeType,
      systemPrompt: modeSystemPrompt,
      userMessage: prompt,
      conversationHistory: [], // TODO: Add conversation history if available
      timestamp: new Date().toLocaleTimeString()
    });

    const executionStartTime = Date.now();

    // Enhanced continuation prompt that reinforces the mode's role as a tool
    const continuationPrompt = `${prompt}

IMPORTANT: You are a specialized tool for Zen, the primary executive assistant. You work behind the scenes to support Zen's conversational approach with the user. Execute the requested analysis and return concise insights to support Zen's next conversation step. Remember to make intelligent assumptions rather than providing exhaustive analysis. Keep all responses extremely brief.`;

    // Execute mode within same action (following OpenCode pattern)
    const result = await streamText({
      model: model,
      messages: [
        { role: "system", content: modeSystemPrompt },
        { role: "user", content: continuationPrompt }
      ],
      tools: modeTools,
      maxRetries: 3,
      temperature: modeConfig.temperature || 0.2, // Lower temperature for execution modes
      // Enhanced multi-step execution for complex operations
      stopWhen: stepCountIs(12), // Increased from 8 to 12 for complex multi-tool operations
    });

    // Get final results from mode execution
    const finalText = await result.text;
    const finalToolCalls = await result.toolCalls;
    const finalToolResults = await result.toolResults;
    
    const executionTime = Date.now() - executionStartTime;
    console.log(`[MODE_COMPLETED] ${modeType} completed in ${executionTime}ms`);

    // Validate execution mode actually performed execution operations (not just planning)
    if (modeType === "execution") {
      const executionTools = ["createTask", "updateTask", "deleteTask", "createProject", "updateProject", "deleteProject", 
                              "createBatchTasks", "deleteBatchTasks", "completeBatchTasks", "updateBatchTasks", 
                              "createProjectWithTasks", "reorganizeTasksBatch", "createCalendarEvent", 
                              "updateCalendarEvent", "deleteCalendarEvent"];
      
      const executionToolCalls = finalToolCalls.filter(tc => executionTools.includes(tc.toolName));
      const infoGatheringCalls = finalToolCalls.filter(tc => tc.toolName === "getProjectAndTaskMap" || tc.toolName === "getTasks");
      
      // Warning if execution mode only gathered information without executing
      if (executionToolCalls.length === 0 && infoGatheringCalls.length > 0) {
        console.warn(`[MODE_WARNING] Execution mode performed information gathering but no actual execution operations`);
      }
    }

    // Log mode response
    logSubagentResponse({
      subagentType: modeType,
      response: finalText || "(No text response)",
      executionTime
    });

    // Log internal todo content if present
    if (finalText && finalText.includes('"todos":')) {
      try {
        const todoMatch = finalText.match(/"todos":\s*(\[[^\]]*\])/);
        if (todoMatch) {
          const todos = JSON.parse(todoMatch[1]);
          console.log(`[INTERNAL_TODOS] Mode ${modeType} created ${todos.length} todos:`, todos);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Prepare concise result for primary mode
    // Extract only the essential information from mode responses
    let formattedOutput = finalText || "Task completed successfully.";
    
    // Remove any XML tags from the output to prevent them from being returned to the user
    formattedOutput = formattedOutput.replace(/<[^>]*>/g, '');
    
    // Extract specific communication formats from modes
    if (modeType === "information-collector") {
      // Look for QUESTION_FOR_USER, INFORMATION_READY, or PROGRESS_UPDATE formats
      const questionMatch = formattedOutput.match(/QUESTION_FOR_USER:\s*["']?([^"'\n]+)/i);
      const readyMatch = formattedOutput.match(/INFORMATION_READY:\s*["']?([^"'\n]+)/i);
      const progressMatch = formattedOutput.match(/PROGRESS_UPDATE:\s*["']?([^"'\n]+)/i);
      
      if (questionMatch) {
        formattedOutput = questionMatch[1].trim();
      } else if (readyMatch) {
        formattedOutput = readyMatch[1].trim();
      } else if (progressMatch) {
        formattedOutput = progressMatch[1].trim();
      }
      
      // For information collector, if we still have a long response, just take the first sentence
      if (formattedOutput.length > 100) {
        const firstSentence = formattedOutput.split(/[.!?]+/)[0];
        if (firstSentence && firstSentence.length <= 100) {
          formattedOutput = firstSentence + (firstSentence.endsWith('?') ? '' : '.');
        } else {
          formattedOutput = formattedOutput.substring(0, 97) + "...";
        }
      }
    } else if (modeType === "planning") {
      // Look for ANALYSIS_COMPLETE format
      const analysisMatch = formattedOutput.match(/ANALYSIS_COMPLETE:\s*["']?([^"'\n]+)/i);
      if (analysisMatch) {
        formattedOutput = analysisMatch[1].trim();
      }
      
      // For planning, limit to 150 characters
      if (formattedOutput.length > 150) {
        formattedOutput = formattedOutput.substring(0, 147) + "...";
      }
    } else if (modeType === "execution") {
      // Look for EXECUTION_COMPLETE format
      const executionMatch = formattedOutput.match(/EXECUTION_COMPLETE:\s*["']?([^"'\n]+)/i);
      if (executionMatch) {
        formattedOutput = executionMatch[1].trim();
      }
      
      // For execution, limit to 100 characters
      if (formattedOutput.length > 100) {
        formattedOutput = formattedOutput.substring(0, 97) + "...";
      }
    } else {
      // For any other mode, limit to 100 characters
      if (formattedOutput.length > 100) {
        formattedOutput = formattedOutput.substring(0, 97) + "...";
      }
    }
    
    // Final cleanup to ensure no XML tags remain
    formattedOutput = formattedOutput.replace(/<[^>]*>/g, '').trim();

    // Return results to primary mode (following OpenCode pattern)
    return {
      title: `${modeType} Task Completed`,
      metadata: { modeType, taskDescription },
      output: formattedOutput
    };
  }
};

/**
 * Get filtered tools for mode (following OpenCode's mode-aware tool filtering)
 * Only provides tools that the mode has permission to use
 */
async function getToolsForMode(modeConfig: any, actionCtx: ActionCtx, ctx: ToolContext): Promise<Record<string, any>> {
  try {
    // Create the full tool registry for this mode
    const allTools = await createSimpleToolRegistry(actionCtx, ctx.userId, ctx.currentTimeContext, ctx.sessionId);
    
    // Filter tools based on mode permissions
    const filteredTools: Record<string, any> = {};
    
    // Get mode's tool permissions
    const modeTools = ModeRegistry.getModeTools(modeConfig.name);
    
    // Filter tools based on mode permissions
    for (const [toolName, tool] of Object.entries(allTools)) {
      // Special case: submodes should not have access to task tool to prevent recursion
      if (toolName === "task" && modeConfig.type !== "primary") {
        continue; // Skip task tool for submodes
      }
      
      // Check if mode has permission for this tool
      if (modeTools[toolName] === true) {
        filteredTools[toolName] = tool;
      }
    }
    
    return filteredTools;
  } catch (error) {
    console.error(`[TaskTool] Failed to create filtered tool registry:`, error);
    // Return empty tools to prevent complete failure
    return {};
  }
}

// Export the TaskTool for registration
export const TaskTool = {
  task: taskTool,
};