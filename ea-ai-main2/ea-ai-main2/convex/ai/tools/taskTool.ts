import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { AgentRegistry } from "../agents/registry";
import { api } from "../../_generated/api";

/**
 * TaskTool - Agent Delegation System
 * 
 * This tool enables the primary agent to delegate complex, multi-step tasks
 * to specialized subagents. Following OpenCode's proven delegation pattern.
 */
export const taskTool: ToolDefinition = {
  id: "task",
  description: `Launch a specialized subagent to handle complex, multi-step tasks autonomously.

Available subagents and their specializations:
- research: Information gathering, web searches, documentation analysis, and topic exploration
- codeAnalysis: Code analysis, architecture review, debugging, and technical investigation

When to use this tool:
- Complex research tasks requiring multiple searches and analysis
- Deep code analysis across multiple files
- Multi-step investigations that benefit from specialized focus
- Tasks that require read-only analysis without system modifications

When NOT to use this tool:
- Simple, single-step tasks
- Tasks requiring file modifications (primary agent handles these)
- Quick information lookups that don't need deep analysis
- Tasks already in progress by the current agent

The subagent will work autonomously and return comprehensive results.`,
  
  inputSchema: z.object({
    subagent: z.enum(["research", "codeAnalysis"]).describe("Which specialized subagent to use for this task"),
    task: z.string().describe("Clear, detailed description of the task to delegate to the subagent. Be specific about what you want the subagent to analyze, research, or investigate."),
    context: z.string().optional().describe("Additional context or background information that would help the subagent understand the task better"),
    priority: z.enum(["high", "medium", "low"]).default("medium").describe("Priority level for this delegated task"),
  }),
  
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { subagent, task, context, priority = "medium" } = args;
      
      // Validate subagent exists and can be used
      if (!AgentRegistry.canUseAsSubagent(subagent)) {
        throw new Error(`Invalid or unavailable subagent: ${subagent}`);
      }
      
      const agentConfig = AgentRegistry.getAgent(subagent);
      if (!agentConfig) {
        throw new Error(`Subagent configuration not found: ${subagent}`);
      }

      // Update metadata to show task delegation started
      ctx.metadata({
        title: `Delegating to ${subagent} Agent`,
        metadata: {
          subagent,
          priority,
          taskLength: task.length,
          hasContext: !!context
        }
      });

      // Create child session for the subagent
      const parentSessionId = ctx.sessionID;
      const delegationContext = {
        delegatedTask: task,
        createdAt: Date.now(),
        status: "running" as const,
        agentName: subagent,
      };

      // Create subagent session via Convex action
      const childSession = await actionCtx.runMutation(api.chatSessions.createChildSession, {
        tokenIdentifier: ctx.userId,
        parentSessionId,
        title: `${agentConfig.description}: ${task.substring(0, 50)}...`,
        agentMode: "subagent" as const,
        agentName: subagent,
        delegationContext,
      });

      // Prepare subagent prompt with context
      const subagentPrompt = [
        `You are a specialized ${subagent} agent. Your role: ${agentConfig.description}`,
        "",
        "TASK TO COMPLETE:",
        task,
        context ? `\nADDITIONAL CONTEXT:\n${context}` : "",
        "",
        "Please analyze this thoroughly and provide comprehensive results. Focus on your area of expertise and provide detailed insights.",
      ].join("\n");

      // Execute the subagent task via conversation
      const subagentResult = await actionCtx.runAction(api.ai.session.chatWithAIV2, {
        message: subagentPrompt,
        sessionId: childSession.sessionId,
        // Force subagent mode and agent name
        agentMode: "subagent",
        agentName: subagent,
      });

      // Mark delegation as completed
      await actionCtx.runMutation(api.chatSessions.updateDelegationStatus, {
        sessionId: childSession.sessionId,
        status: "completed"
      });

      // Prepare result summary
      const resultSummary = {
        subagent,
        task,
        priority,
        sessionId: childSession.sessionId,
        parentSessionId,
        status: "completed",
        result: subagentResult.response,
        metadata: {
          agentSpecialization: agentConfig.description,
          taskCompleted: true,
          executionTime: Date.now() - delegationContext.createdAt,
        }
      };

      return {
        title: `${subagent} Agent Task Completed`,
        metadata: {
          subagent,
          status: "completed",
          sessionId: childSession.sessionId,
          taskLength: task.length
        },
        output: JSON.stringify({
          summary: `Task successfully delegated to ${subagent} agent and completed.`,
          subagentResponse: subagentResult.response,
          taskDetails: {
            originalTask: task,
            context: context || "No additional context provided",
            priority,
            completedAt: new Date().toISOString()
          },
          childSessionId: childSession.sessionId,
          // Include metadata from the subagent execution
          executionMetadata: subagentResult.metadata,
          // Include the full result for the primary agent to use
          fullResult: resultSummary
        }, null, 2)
      };

    } catch (error) {
      // Handle delegation failures
      const errorMessage = error instanceof Error ? error.message : "Unknown error during task delegation";
      
      // Try to update delegation status to failed if we have a session
      try {
        if (args.sessionId) {
          await actionCtx.runMutation(api.chatSessions.updateDelegationStatus, {
            sessionId: args.sessionId,
            status: "failed"
          });
        }
      } catch (updateError) {
        console.error("Failed to update delegation status:", updateError);
      }

      const errorResult = {
        subagent: args.subagent,
        task: args.task,
        error: errorMessage,
        status: "failed",
        timestamp: Date.now(),
      };

      return {
        title: "Task Delegation Failed",
        metadata: {
          subagent: args.subagent,
          status: "failed",
          error: true
        },
        output: JSON.stringify({
          summary: `Failed to delegate task to ${args.subagent} agent.`,
          error: errorMessage,
          troubleshooting: [
            "Check if the subagent name is correct (research, codeAnalysis)",
            "Ensure the task description is clear and specific",
            "Verify system has capacity for additional sessions",
          ],
          failedTask: args.task,
          errorDetails: errorResult
        }, null, 2)
      };
    }
  }
};

// Export the task tool for registration
export const TaskTool = {
  task: taskTool,
};