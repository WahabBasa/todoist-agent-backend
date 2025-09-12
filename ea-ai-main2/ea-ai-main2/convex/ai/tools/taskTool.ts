import { z } from "zod";
import { ToolDefinition, ToolContext, createSimpleToolRegistry } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { AgentRegistry } from "../agents/registry";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SystemPrompt } from "../system";

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
- general: General-purpose research, analysis, and multi-step problem solving
- research: Information gathering, documentation analysis, and topic exploration  
- codeAnalysis: Code review, architecture analysis, and technical investigation

When to use this tool:
- Complex tasks requiring specialized expertise
- Multi-step research or analysis
- Tasks that benefit from focused, specialized processing
- Read-only analysis and investigation tasks

When NOT to use this tool:
- Simple, single-step tasks
- Tasks requiring file modifications (primary agent handles these)
- Quick lookups that don't need deep analysis

The subagent will work autonomously with filtered tool access and return comprehensive results.`,
  
  inputSchema: z.object({
    subagentType: z.enum(["general", "research", "codeAnalysis"]).describe("Which specialized subagent to use for this task"),
    prompt: z.string().describe("Clear, detailed description of the task to delegate. Be specific about what analysis or research is needed."),
    description: z.string().optional().describe("Short 3-5 word description of the task for progress tracking"),
  }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
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

      // Prepare subagent system prompt
      const baseSystemPrompt = await SystemPrompt.getSystemPrompt(
        actionCtx, 
        "anthropic/claude-3-5-haiku", // Use efficient model for subagent
        "", 
        prompt, 
        ctx.userId
      );

      // Combine with agent-specific prompt
      const subagentSystemPrompt = [
        baseSystemPrompt,
        "",
        `You are a specialized ${subagentType} agent.`,
        `Your role: ${subagentConfig.description}`,
        "",
        "IMPORTANT: You are working as a subagent with read-only access. Focus on analysis and provide comprehensive insights.",
        ""
      ].join("\n");

      // Create OpenRouter client for subagent execution
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      const model = openrouter.chat("anthropic/claude-3-5-haiku");

      console.log(`[TaskTool] Executing ${subagentType} subagent with filtered tools`);

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
      
      console.log(`[TaskTool] ${subagentType} completed: text=${!!finalText}, tools=${finalToolCalls.length}`);

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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during task delegation";
      console.error(`[TaskTool] Delegation failed:`, error);

      return {
        title: `${args.subagentType} Task Failed`,
        metadata: { error: errorMessage },
        output: `Task delegation to ${args.subagentType} agent failed: ${errorMessage}\n\nPlease try again or handle this task directly.`
      };
    }
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