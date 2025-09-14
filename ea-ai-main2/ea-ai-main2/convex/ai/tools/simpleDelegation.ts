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

/**
 * Research delegation tool - delegates to general subagent for research
 * This replaces the broken "researchTask" that only created todos
 */
export const researchTask: ToolDefinition = {
  id: "researchTask",
  description: "Delegate to a research subagent for comprehensive information gathering and analysis. Use this for research that requires multiple searches and detailed analysis.",
  inputSchema: z.object({
    topic: z.string().describe("The topic or question to research"),
    focus: z.string().optional().describe("Specific aspect to focus on (e.g., 'implementation', 'best practices', 'comparison')"),
    context: z.string().optional().describe("Additional context or background information"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { topic, focus, context } = args;
      
      // Create detailed prompt for research subagent
      const researchPrompt = [
        `RESEARCH REQUEST: ${topic}`,
        focus ? `Focus Area: ${focus}` : '',
        context ? `Context: ${context}` : '',
        '',
        'Please conduct comprehensive research on this topic and provide:',
        '1. Key concepts and definitions',
        '2. Current best practices and approaches',
        '3. Common implementation patterns',
        '4. Potential challenges and solutions',
        '5. Relevant examples or case studies',
        '6. Actionable recommendations',
      ].filter(Boolean).join('\n');

      // Import the task tool for delegation
      const { taskTool } = await import("./taskTool");
      
      // Delegate to general subagent for research
      const result = await taskTool.execute({
        subagentType: "general",
        prompt: researchPrompt,
        description: `Research: ${topic.substring(0, 30)}...`
      }, ctx, actionCtx);

      return {
        title: "Research Completed",
        metadata: { 
          delegatedTo: "general",
          topic: topic.substring(0, 100),
          approach: "subagent_delegation"
        },
        output: result.output
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Research delegation failed";
      
      return {
        title: "Research Failed",
        metadata: { 
          topic: args.topic,
          error: true 
        },
        output: `Research delegation failed: ${errorMessage}\n\nThe research subagent could not process this request. Please try refining your research question or breaking it into smaller topics.`
      };
    }
  }
};

/**
 * Code analysis delegation tool - delegates to general subagent for code analysis
 * This replaces the broken "analyzeCode" that only created todos
 */
export const analyzeCode: ToolDefinition = {
  id: "analyzeCode",
  description: "Delegate to a code analysis subagent for technical review, debugging, or architectural analysis. Use this for code-related investigation and analysis.",
  inputSchema: z.object({
    codeContext: z.string().describe("Description of the code or technical system to analyze"),
    analysisType: z.enum(["review", "debug", "architecture", "performance", "security"]).describe("Type of analysis to perform"),
    specificQuestions: z.string().optional().describe("Specific questions or concerns to address"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { codeContext, analysisType, specificQuestions } = args;
      
      // Create detailed prompt for code analysis subagent
      const analysisPrompt = [
        `CODE ANALYSIS REQUEST: ${analysisType.toUpperCase()}`,
        `Context: ${codeContext}`,
        specificQuestions ? `Specific Questions: ${specificQuestions}` : '',
        '',
        `Please perform a thorough ${analysisType} analysis and provide:`,
        '1. Summary of findings and assessment',
        '2. Specific issues or areas of concern identified',
        '3. Detailed recommendations and solutions', 
        '4. Best practices to implement',
        '5. Priority level for each recommendation',
        '6. Implementation steps or next actions',
      ].filter(Boolean).join('\n');

      // Import the task tool for delegation
      const { taskTool } = await import("./taskTool");
      
      // Delegate to general subagent for code analysis
      const result = await taskTool.execute({
        subagentType: "general",
        prompt: analysisPrompt,
        description: `Code Analysis: ${analysisType}`
      }, ctx, actionCtx);

      return {
        title: "Code Analysis Completed",
        metadata: { 
          delegatedTo: "general",
          analysisType,
          codeContext: codeContext.substring(0, 100),
          approach: "subagent_delegation"
        },
        output: result.output
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Code analysis delegation failed";
      
      return {
        title: "Code Analysis Failed",
        metadata: { 
          analysisType: args.analysisType,
          error: true 
        },
        output: `Code analysis delegation failed: ${errorMessage}\n\nThe code analysis subagent could not process this request. Please try providing more specific context or breaking the analysis into smaller components.`
      };
    }
  }
};

// Export the real delegation tools
export const SimpleDelegationTools = {
  researchTask,
  analyzeCode, 
  planTask,
};