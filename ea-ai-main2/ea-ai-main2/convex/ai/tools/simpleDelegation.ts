import { z } from "zod";
import { ToolDefinition, ToolContext } from "../toolRegistry";
import { ActionCtx } from "../../_generated/server";
import { api } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";

/**
 * Simple delegation system that replaces the complex hierarchical TaskTool
 * 
 * Instead of creating child sessions and complex agent hierarchies:
 * - Use simple Convex mutations to store delegation requests
 * - Process delegations directly within the same session
 * - No circular dependencies or complex session management
 * - Focus on task specialization rather than agent hierarchies
 */

/**
 * Simple research delegation tool
 * Performs research tasks without creating separate agent sessions
 */
export const researchTask: ToolDefinition = {
  id: "researchTask",
  description: "Perform research on a specific topic, technology, or question. Use this for information gathering that requires multiple searches and analysis.",
  inputSchema: z.object({
    topic: z.string().describe("The topic or question to research"),
    focus: z.string().optional().describe("Specific aspect to focus on (e.g., 'implementation', 'best practices', 'comparison')"),
    context: z.string().optional().describe("Additional context or background information"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { topic, focus, context } = args;
      
      // Metadata handled by tool registry bridge

      // Simple approach: Create an internal todo for the research
      // This keeps the research within the same session instead of creating child sessions
      const researchPrompt = [
        `Research topic: ${topic}`,
        focus ? `Focus area: ${focus}` : '',
        context ? `Context: ${context}` : '',
        '',
        'Please provide a comprehensive analysis covering:',
        '1. Key concepts and definitions',
        '2. Current best practices',
        '3. Common implementation approaches',
        '4. Potential challenges and solutions',
        '5. Relevant examples or case studies'
      ].filter(Boolean).join('\n');

      // Store as internal todo instead of creating child session
      await actionCtx.runMutation(api.aiInternalTodos.createInternalTodoList, {
        sessionId: ctx.sessionId as Id<"chatSessions"> | undefined,
        todos: [{
          id: `research_${Date.now()}`,
          content: `Research: ${topic}`,
          status: 'pending',
          priority: 'high'
        }]
      });

      return {
        title: "Research Task Queued",
        metadata: { 
          topic,
          focus,
          approach: "internal_todo"
        },
        output: JSON.stringify({
          status: "queued",
          topic: topic,
          focus: focus || "general",
          message: "Research task has been added to the internal workflow. I'll provide comprehensive findings shortly.",
          approach: "Direct research within current session - no delegation overhead"
        }, null, 2)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Research task creation failed";
      
      return {
        title: "Research Task Failed",
        metadata: { 
          topic: args.topic,
          error: true 
        },
        output: JSON.stringify({
          status: "failed",
          topic: args.topic,
          error: errorMessage,
          suggestion: "Try rephrasing your research request or breaking it into smaller, more specific questions."
        }, null, 2)
      };
    }
  }
};

/**
 * Simple code analysis delegation tool
 * Analyzes code without creating separate agent sessions
 */
export const analyzeCode: ToolDefinition = {
  id: "analyzeCode",
  description: "Analyze code, architecture, or technical implementation. Use this for code review, debugging, or technical investigation.",
  inputSchema: z.object({
    codeContext: z.string().describe("Description of the code or technical system to analyze"),
    analysisType: z.enum(["review", "debug", "architecture", "performance", "security"]).describe("Type of analysis to perform"),
    specificQuestions: z.string().optional().describe("Specific questions or concerns to address"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { codeContext, analysisType, specificQuestions } = args;
      
      // Metadata handled by tool registry bridge

      // Create analysis prompt based on type
      const analysisPrompts = {
        review: "Perform a thorough code review focusing on code quality, best practices, and potential improvements.",
        debug: "Analyze for potential bugs, error conditions, and debugging strategies.",
        architecture: "Review the architectural patterns, design decisions, and scalability considerations.",
        performance: "Analyze for performance bottlenecks, optimization opportunities, and efficiency improvements.",
        security: "Review for security vulnerabilities, authentication issues, and data protection concerns."
      };

      const analysisPrompt = [
        `Code Analysis Request: ${analysisType}`,
        `Context: ${codeContext}`,
        '',
        analysisPrompts[analysisType as keyof typeof analysisPrompts] || analysisPrompts.review,
        '',
        specificQuestions ? `Specific questions to address: ${specificQuestions}` : '',
        '',
        'Please provide:',
        '1. Summary of findings',
        '2. Specific issues identified',
        '3. Recommended solutions',
        '4. Best practices to implement',
        '5. Priority level for each recommendation'
      ].filter(Boolean).join('\n');

      // Store as internal todo
      await actionCtx.runMutation(api.aiInternalTodos.createInternalTodoList, {
        sessionId: ctx.sessionId as Id<"chatSessions"> | undefined,
        todos: [{
          id: `code_analysis_${Date.now()}`,
          content: `Code Analysis: ${analysisType}`,
          status: 'pending',
          priority: 'high'
        }]
      });

      return {
        title: "Code Analysis Queued",
        metadata: { 
          analysisType,
          codeContext: codeContext.substring(0, 100),
          approach: "internal_todo"
        },
        output: JSON.stringify({
          status: "queued",
          analysisType: analysisType,
          context: codeContext.substring(0, 200) + (codeContext.length > 200 ? "..." : ""),
          message: `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} analysis has been queued. I'll provide detailed findings shortly.`,
          approach: "Direct analysis within current session - no delegation overhead"
        }, null, 2)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Code analysis task creation failed";
      
      return {
        title: "Code Analysis Failed",
        metadata: { 
          analysisType: args.analysisType,
          error: true 
        },
        output: JSON.stringify({
          status: "failed",
          analysisType: args.analysisType,
          error: errorMessage,
          suggestion: "Try providing more specific context or breaking the analysis into smaller components."
        }, null, 2)
      };
    }
  }
};

/**
 * Simple planning and organization tool
 * Helps break down complex tasks without agent delegation
 */
export const planTask: ToolDefinition = {
  id: "planTask",
  description: "Break down complex tasks into manageable steps and create an execution plan. Use this for project planning and task organization.",
  inputSchema: z.object({
    taskDescription: z.string().describe("Description of the complex task to plan"),
    timeframe: z.string().optional().describe("Expected timeframe or deadline"),
    constraints: z.string().optional().describe("Any constraints or limitations to consider"),
    priority: z.enum(["high", "medium", "low"]).default("medium").describe("Priority level for this planning task"),
  }),
  async execute(args: any, ctx: ToolContext, actionCtx: ActionCtx) {
    try {
      const { taskDescription, timeframe, constraints, priority } = args;
      
      // Metadata handled by tool registry bridge

      const planningPrompt = [
        `Task Planning Request: ${taskDescription}`,
        timeframe ? `Timeframe: ${timeframe}` : '',
        constraints ? `Constraints: ${constraints}` : '',
        '',
        'Please create a detailed execution plan including:',
        '1. Break down into specific, actionable steps',
        '2. Identify dependencies between steps',
        '3. Estimate time/effort for each step',
        '4. Highlight potential risks or blockers',
        '5. Suggest prioritization order',
        '6. Recommend tools or resources needed'
      ].filter(Boolean).join('\n');

      // Store as internal todo
      await actionCtx.runMutation(api.aiInternalTodos.createInternalTodoList, {
        sessionId: ctx.sessionId as Id<"chatSessions"> | undefined,
        todos: [{
          id: `planning_${Date.now()}`,
          content: `Plan: ${taskDescription.substring(0, 50)}...`,
          status: 'pending',
          priority: priority
        }]
      });

      return {
        title: "Task Planning Queued",
        metadata: { 
          taskDescription: taskDescription.substring(0, 100),
          priority,
          approach: "internal_todo"
        },
        output: JSON.stringify({
          status: "queued",
          task: taskDescription,
          priority: priority,
          message: "Task planning has been added to the workflow. I'll provide a detailed execution plan shortly.",
          approach: "Direct planning within current session - no delegation overhead"
        }, null, 2)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Task planning failed";
      
      return {
        title: "Task Planning Failed",
        metadata: { 
          task: args.taskDescription,
          error: true 
        },
        output: JSON.stringify({
          status: "failed",
          task: args.taskDescription,
          error: errorMessage,
          suggestion: "Try breaking your request into smaller, more specific planning tasks."
        }, null, 2)
      };
    }
  }
};

// Export simplified delegation tools
export const SimpleDelegationTools = {
  researchTask,
  analyzeCode,
  planTask,
};