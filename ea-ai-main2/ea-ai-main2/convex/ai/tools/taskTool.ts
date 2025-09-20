import { z } from "zod";
import { ToolDefinition, ToolContext, createSimpleToolRegistry } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { AgentRegistry } from "../agents/registry";
import { streamText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "../system";
import { logSubagentCall, logSubagentResponse } from "../langfuse/logger";

// Static imports following OpenCode pattern - guaranteed assignment at compile time
import { prompt as executionPrompt } from "../prompts/execution_new";
import { prompt as planningPrompt } from "../prompts/planning_new";
// Note: information-collector prompt is in system.ts

/**
 * TaskTool - OpenCode-Style Stateless Agent Delegation
 * 
 * Following OpenCode's delegation pattern:
 * - No child session creation in database
 * - Stateless subagent execution within same action
 * - Filtered tool access based on agent permissions
 * - Direct result return to primary agent
 * 
 * Key difference from OpenCode: Adapted for Convex's multi-user environment
 */
export const taskTool: ToolDefinition = {
  id: "task",
  description: `Launch a specialized subagent to handle complex, multi-step tasks autonomously.

Available subagents and their specializations:
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
- Tasks requiring file modifications (primary agent handles these)
- Quick lookups that don't need deep analysis

The subagent will work autonomously as your specialized tool and return concise results for integration into your response.`,
  
  inputSchema: z.object({
    subagentType: z.enum(["information-collector", "planning", "execution"]).describe("Which specialized subagent to use for this task"),
    prompt: z.string().describe("Clear, detailed description of the task to delegate. Be specific about what analysis or research is needed."),
    description: z.string().optional().describe("Short 3-5 word description of the task for progress tracking"),
  }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    const { subagentType, prompt, description } = args;
    const taskDescription = description || `${subagentType} task`;
    
    console.log(`[TaskTool] Starting ${subagentType} subagent delegation`);
    
    // Validate subagent exists (following OpenCode pattern)
    if (!AgentRegistry.canUseAsSubagent(subagentType)) {
      throw new Error(`Invalid or unavailable subagent: ${subagentType}`);
    }
    
    const subagentConfig = AgentRegistry.getAgent(subagentType);
    if (!subagentConfig) {
      throw new Error(`Subagent configuration not found: ${subagentType}`);
    }

    // Update metadata to show delegation started (following OpenCode pattern)
    // Metadata handled by tool registry bridge - ctx.metadata({
    //   title: `Delegating to ${subagentType} agent`,
    //   metadata: {
    //     subagent: subagentType,
    //     taskDescription,
    //     promptLength: prompt.length
    //   }
    // });

    // Get filtered tools for subagent (following OpenCode's tool filtering)
    const subagentTools = await getToolsForAgent(subagentConfig, actionCtx, ctx);
    console.log(`[TaskTool] Created ${Object.keys(subagentTools).length} filtered tools for ${subagentType}`);

    // Get the appropriate system prompt for the subagent
    let subagentSystemPrompt = "";
    if (subagentType === "execution") {
      subagentSystemPrompt = executionPrompt;
    } else if (subagentType === "planning") {
      subagentSystemPrompt = planningPrompt;
    } else {
      // For information-collector and other agents, get from SystemPrompt
      subagentSystemPrompt = await SystemPrompt.getSystemPrompt(
        actionCtx,
        "anthropic/claude-3.5-haiku-20241022",
        "",
        prompt,
        ctx.userId,
        subagentType
      );
    }
    
    console.log(`[TaskTool] Loaded specialized prompt for ${subagentType}`);

    // Create OpenRouter client for subagent execution
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const model = openrouter.chat("anthropic/claude-3.5-haiku-20241022");

    console.log(`[TaskTool] Executing ${subagentType} subagent with filtered tools`);

    // Log subagent call with full context
    logSubagentCall({
      subagentType,
      systemPrompt: subagentSystemPrompt,
      userMessage: prompt,
      conversationHistory: [], // TODO: Add conversation history if available
      timestamp: new Date().toLocaleTimeString()
    });

    const executionStartTime = Date.now();

    // Enhanced continuation prompt that reinforces the subagent's role as a tool
    const continuationPrompt = `${prompt}

IMPORTANT: You are a specialized tool for Zen, the primary executive assistant. You work behind the scenes to support Zen's conversational approach with the user. Execute the requested analysis and return concise insights to support Zen's next conversation step. Remember to make intelligent assumptions rather than providing exhaustive analysis. Keep all responses extremely brief.`;

    // Execute subagent within same action (following OpenCode pattern)
    const result = await streamText({
      model: model,
      messages: [
        { role: "system", content: subagentSystemPrompt },
        { role: "user", content: continuationPrompt }
      ],
      tools: subagentTools,
      maxRetries: 3,
      temperature: subagentConfig.temperature || 0.2, // Lower temperature for execution agents
      // Enhanced multi-step execution for complex operations
      stopWhen: stepCountIs(12), // Increased from 8 to 12 for complex multi-tool operations
    });

    // Get final results from subagent execution
    const finalText = await result.text;
    const finalToolCalls = await result.toolCalls;
    const finalToolResults = await result.toolResults;
    
    const executionTime = Date.now() - executionStartTime;
    console.log(`[TaskTool] ${subagentType} completed: text=${!!finalText}, tools=${finalToolCalls.length}`);

    // Validate execution agent actually performed execution operations (not just planning)
    if (subagentType === "execution") {
      const executionTools = ["createTask", "updateTask", "deleteTask", "createProject", "updateProject", "deleteProject", 
                              "createBatchTasks", "deleteBatchTasks", "completeBatchTasks", "updateBatchTasks", 
                              "createProjectWithTasks", "reorganizeTasksBatch", "createCalendarEvent", 
                              "updateCalendarEvent", "deleteCalendarEvent"];
      
      const executionToolCalls = finalToolCalls.filter(tc => executionTools.includes(tc.toolName));
      const infoGatheringCalls = finalToolCalls.filter(tc => tc.toolName === "getProjectAndTaskMap" || tc.toolName === "getTasks");
      
      console.log(`[TaskTool] Execution validation: ${executionToolCalls.length} execution calls, ${infoGatheringCalls.length} info calls`);
      
      // Warning if execution agent only gathered information without executing
      if (executionToolCalls.length === 0 && infoGatheringCalls.length > 0) {
        console.warn(`[TaskTool] WARNING: Execution agent performed information gathering but no actual execution operations`);
      }
    }

    // Log subagent response
    logSubagentResponse({
      subagentType,
      response: finalText || "(No text response)",
      executionTime
    });

    // Prepare concise result for primary agent
    // Extract only the essential information from subagent responses
    let formattedOutput = finalText || "Task completed successfully.";
    
    // Extract specific communication formats from subagents
    if (subagentType === "information-collector") {
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
    } else if (subagentType === "planning") {
      // Look for ANALYSIS_COMPLETE format
      const analysisMatch = formattedOutput.match(/ANALYSIS_COMPLETE:\s*["']?([^"'\n]+)/i);
      if (analysisMatch) {
        formattedOutput = analysisMatch[1].trim();
      }
      
      // For planning, limit to 150 characters
      if (formattedOutput.length > 150) {
        formattedOutput = formattedOutput.substring(0, 147) + "...";
      }
    } else if (subagentType === "execution") {
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
      // For any other subagent, limit to 100 characters
      if (formattedOutput.length > 100) {
        formattedOutput = formattedOutput.substring(0, 97) + "...";
      }
    }

    // Return results to primary agent (following OpenCode pattern)
    return {
      title: `${subagentType} Task Completed`,
      metadata: { subagentType, taskDescription },
      output: formattedOutput
    };
  }
};

/**
 * Get filtered tools for subagent (following OpenCode's agent-aware tool filtering)
 * Only provides tools that the subagent has permission to use
 */
async function getToolsForAgent(agentConfig: any, actionCtx: ActionCtx, ctx: ToolContext): Promise<Record<string, any>> {
  try {
    // Create the full tool registry for this agent
    const allTools = await createSimpleToolRegistry(actionCtx, ctx.userId, ctx.currentTimeContext, ctx.sessionId);
    
    // Filter tools based on agent permissions
    const filteredTools: Record<string, any> = {};
    
    // Get agent's tool permissions
    const agentTools = AgentRegistry.getAgentTools(agentConfig.name);
    
    // Filter tools based on agent permissions
    for (const [toolName, tool] of Object.entries(allTools)) {
      // Special case: subagents should not have access to task tool to prevent recursion
      if (toolName === "task" && agentConfig.mode === "subagent") {
        continue; // Skip task tool for subagents
      }
      
      // Check if agent has permission for this tool
      if (agentTools[toolName] === true) {
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