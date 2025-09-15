import { z } from "zod";
import { ToolDefinition, ToolContext, createSimpleToolRegistry } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { AgentRegistry } from "../agents/registry";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "../system";
import { logSubagentCall, logSubagentResponse } from "../langfuse/logger";

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
- general: General-purpose task management, analysis, and coordination
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

The subagent will work autonomously with filtered tool access and return comprehensive results.`,
  
  inputSchema: z.object({
    subagentType: z.enum(["general", "planning", "execution"]).describe("Which specialized subagent to use for this task"),
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

    // Load agent-specific system prompt from registry using ES module imports
    const { MODES } = await import("../agents/registry");
    const modeConfig = MODES[subagentType as keyof typeof MODES];
    
    // Initialize with fallback prompt to ensure variable is always assigned
    let subagentSystemPrompt: string = [
      `You are a specialized ${subagentType} agent.`,
      `Your role: ${subagentConfig.description}`,
      "",
      "IMPORTANT: You are working as a subagent. Focus on your specific expertise and provide comprehensive results."
    ].join("\n");
    
    if (modeConfig?.systemPromptFile) {
      // Load specialized prompt using dynamic ES module import (Convex-compatible)
      try {
        const promptModuleName = modeConfig.systemPromptFile.replace('.txt', '');
        
        // Dynamic import based on agent type
        let promptModule;
        switch (subagentType) {
          case 'execution':
            promptModule = await import("../prompts/execution-prompt");
            break;
          case 'planning':
            promptModule = await import("../prompts/planning-prompt");
            break;
          case 'general':
            promptModule = await import("../prompts/general-prompt");
            break;
          default:
            throw new Error(`Unknown subagent type: ${subagentType}`);
        }
        
        if (promptModule?.prompt) {
          subagentSystemPrompt = promptModule.prompt;
          console.log(`[TaskTool] Loaded specialized prompt for ${subagentType} via ES module import`);
        } else {
          throw new Error(`Prompt module does not export 'prompt' property`);
        }
      } catch (error) {
        console.warn(`[TaskTool] Failed to load prompt module for ${subagentType}, using fallback:`, error);
        
        // Enhanced fallback for execution subagent with immediate execution directives
        if (subagentType === 'execution') {
          subagentSystemPrompt = [
            `You are a specialized ${subagentType} agent.`,
            `Your role: ${subagentConfig.description}`,
            "",
            "IMPORTANT: You are working as a subagent. Focus on your specific expertise and provide comprehensive results.",
            "",
            "MANDATORY DIRECTIVES:",
            "- Execute ALL direct user commands immediately without asking for approval",
            "- When users say 'do not question me and do what I asked for', execute their request immediately",
            "- Treat user confirmations as final authorization to proceed",
            "- Do NOT ask 'Are you sure?' or request additional confirmation for direct commands",
            "- Execute technically valid operations without hesitation"
          ].join("\n");
        }
        // For other agent types, the default fallback is already assigned above
      }
    }

    // Create OpenRouter client for subagent execution
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const model = openrouter.chat("anthropic/claude-3-5-haiku");

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

    // Execute subagent within same action (following OpenCode pattern)
    const result = await streamText({
      model: model,
      messages: [
        { role: "system", content: subagentSystemPrompt },
        { role: "user", content: prompt }
      ],
      tools: subagentTools,
      maxRetries: 3,
      temperature: subagentConfig.temperature || 0.3,
    });

    // Get final results from subagent execution
    const finalText = await result.text;
    const finalToolCalls = await result.toolCalls;
    const finalToolResults = await result.toolResults;
    
    const executionTime = Date.now() - executionStartTime;
    console.log(`[TaskTool] ${subagentType} completed: text=${!!finalText}, tools=${finalToolCalls.length}`);

    // Log subagent response
    logSubagentResponse({
      subagentType,
      response: finalText || "(No text response)",
      executionTime
    });

    // Prepare comprehensive result for primary agent (following OpenCode pattern)
    const subagentOutput = [
      `=== ${subagentType.toUpperCase()} AGENT RESULTS ===`,
      "",
      finalText || "Analysis completed successfully.",
      "",
      finalToolResults.length > 0 ? "=== TOOL EXECUTION RESULTS ===" : "",
      ...finalToolResults.map(tr => `Tool: ${tr.toolName}\nResult: ${tr.output}\n`),
    ].filter(Boolean).join("\n");

    // Return results to primary agent (following OpenCode pattern)
    return {
      title: `${subagentType} Task Completed`,
      metadata: { subagentType, taskDescription },
      output: subagentOutput
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