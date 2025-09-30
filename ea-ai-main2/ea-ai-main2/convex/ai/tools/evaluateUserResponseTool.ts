import { z } from "zod";
import { ToolDefinition } from "../toolRegistry";
import { validateToolContext, validateActionContext } from "./utils";

/**
 * Enhanced user response evaluation tool based on RooCode architecture principles
 * Allows LLM to make intelligent decisions about user responses while keeping
 * state transition execution in deterministic application code
 */
export const evaluateUserResponseTool: ToolDefinition = {
  id: "evaluateUserResponse",
  description: "Analyze user response to understand their intent and determine the appropriate next action. This tool separates decision-making (LLM) from execution (application), reducing cognitive load while preserving model autonomy.",
  inputSchema: z.object({
    userInput: z.string().describe("The exact user response text to analyze"),
    currentContext: z.string().describe("What the user is responding to (e.g., 'plan approval', 'task clarification', 'priority adjustment')"),
    responseType: z.enum(["plan_approval", "task_confirmation", "clarification_request", "general_feedback"]).describe("The type of response being evaluated"),
    analysis: z.string().describe("Your interpretation of what the user wants or means"),
    confidence: z.enum(["high", "medium", "low"]).describe("How confident you are in your interpretation"),
    decision: z.enum([
      "full_approval",
      "partial_approval_with_revisions",
      "rejection_needs_restart",
      "needs_clarification",
      "ready_for_execution",
      "requires_planning_adjustment",
      "user_wants_different_approach"
    ]).describe("Your decision about what should happen next"),
    nextAction: z.enum([
      "execute_plan",
      "revise_plan",
      "restart_planning",
      "switch_to_execution_mode",
      "switch_to_planning_mode",
      "provide_alternative_approach"
    ]).describe("The specific action that should be taken"),
    focusArea: z.string().optional().describe("If revisions are needed, what specific area to focus on"),
    reasoning: z.string().describe("Brief explanation of why you made this decision")
  }),

  async execute(args: any, ctx: any, actionCtx: any) {
    const {
      userInput,
      currentContext,
      responseType,
      analysis,
      confidence,
      decision,
      nextAction,
      focusArea,
      reasoning
    } = args;

    // SECURITY: Use centralized validation utilities
    validateToolContext(ctx, "evaluateUserResponseTool");
    validateActionContext(actionCtx, "evaluateUserResponseTool");

    // SECURITY: Sanitize user input to prevent injection
    if (!userInput || typeof userInput !== 'string') {
      throw new Error("User input must be a valid string");
    }

    const sanitizedInput = userInput.replace(/[<>]/g, '').trim();

    if (sanitizedInput.length === 0) {
      throw new Error("User input cannot be empty");
    }

    // Log the evaluation for debugging and monitoring
    console.log(`[evaluateUserResponse] Decision: ${decision}, Action: ${nextAction}, Confidence: ${confidence}`);

    // Return structured decision for application layer to execute
    return {
      title: `User Response Evaluated: ${decision}`,
      metadata: {
        userInput: sanitizedInput,
        originalInput: userInput !== sanitizedInput ? userInput : undefined,
        currentContext,
        responseType,
        analysis,
        confidence,
        decision,
        nextAction,
        focusArea,
        reasoning,
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId
      },
      output: `Analysis: ${analysis}\n\nDecision: ${decision}\nNext Action: ${nextAction}\n${focusArea ? `Focus Area: ${focusArea}\n` : ''}Reasoning: ${reasoning}\n\nConfidence: ${confidence}`
    };
  }
};