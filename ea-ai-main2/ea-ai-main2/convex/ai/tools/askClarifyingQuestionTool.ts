import { z } from "zod";
import { ToolDefinition } from "../toolRegistry";
import { validateToolContext, validateActionContext } from "./utils";

// Type definitions for suggested answers
interface SuggestedAnswer {
  questionIndex: number;
  suggestion: string;
  description?: string;
}

interface FormattedSuggestion {
  text: string;
  description?: string;
}

/**
 * Smart user interaction tool inspired by RooCode's ask_followup_question
 * Supports intelligent question grouping and context explanation
 * Removes conversational complexity from prompts by handling user interaction as explicit tool calls
 */
export const askClarifyingQuestionTool: ToolDefinition = {
  id: "askClarifyingQuestion",
  description: "Ask users clarifying questions in a smart, efficient way. Supports multiple related questions when logically grouped, provides context for why information is needed, and includes suggested answers to reduce user typing.",
  inputSchema: z.object({
    questions: z.array(z.object({
      question: z.string().describe("The specific question to ask"),
      context: z.string().describe("Why this information is needed (helps user understand relevance)"),
      required: z.boolean().describe("Whether this question must be answered to proceed")
    })).min(1).max(4).describe("1-4 related questions grouped logically (max 4 to avoid overwhelming)"),
    groupContext: z.string().describe("Overall context explaining why this group of questions is needed"),
    category: z.enum([
      "timing_and_deadlines",
      "scope_and_requirements",
      "preferences_and_constraints",
      "clarification_and_details",
      "prioritization_factors"
    ]).describe("Category of information being gathered"),
    urgency: z.enum(["high", "medium", "low"]).describe("How urgently these answers are needed"),
    suggestedAnswers: z.array(z.object({
      questionIndex: z.number().describe("Which question this suggestion relates to (0-based index)"),
      suggestion: z.string().describe("A possible answer the user could choose"),
      description: z.string().optional().describe("Brief explanation of what this option means")
    })).optional().describe("Suggested answers to make it easier for users to respond"),
    fallbackAction: z.string().optional().describe("What you'll do if user doesn't provide these details")
  }),

  async execute(args: any, ctx: any, actionCtx: any) {
    const {
      questions,
      groupContext,
      category,
      urgency,
      suggestedAnswers,
      fallbackAction
    } = args;

    // SECURITY: Use centralized validation utilities
    validateToolContext(ctx, "askClarifyingQuestionTool");
    validateActionContext(actionCtx, "askClarifyingQuestionTool");

    // SECURITY: Validate questions array
    if (!Array.isArray(questions) || questions.length === 0 || questions.length > 4) {
      throw new Error("Questions must be an array of 1-4 items");
    }

    // SECURITY: Sanitize question content
    const sanitizedQuestions = questions.map((q, index) => {
      if (!q.question || typeof q.question !== 'string') {
        throw new Error(`Question ${index} must have valid question text`);
      }

      if (!q.context || typeof q.context !== 'string') {
        throw new Error(`Question ${index} must have valid context`);
      }

      return {
        question: q.question.replace(/[<>]/g, '').trim(),
        context: q.context.replace(/[<>]/g, '').trim(),
        required: Boolean(q.required)
      };
    });

    // Validate that we have meaningful content after sanitization
    if (sanitizedQuestions.some(q => q.question.length === 0 || q.context.length === 0)) {
      throw new Error("All questions must have meaningful content");
    }

    // Structure the response for the frontend to display nicely
    const formattedQuestions = sanitizedQuestions.map((q, index) => {
      const relatedSuggestions = suggestedAnswers?.filter((s: SuggestedAnswer) => s.questionIndex === index) || [];

      return {
        id: `q${index}`,
        question: q.question,
        context: q.context,
        required: q.required,
        suggestions: relatedSuggestions.map((s: SuggestedAnswer) => ({
          text: s.suggestion,
          description: s.description
        }))
      };
    });

    // Log the interaction for monitoring
    console.log(`[askClarifyingQuestion] Category: ${category}, Questions: ${questions.length}, Urgency: ${urgency}`);

    return {
      title: `Clarifying Questions - ${category.replace(/_/g, ' ')}`,
      metadata: {
        type: "clarifying_questions",
        category,
        urgency,
        questionCount: sanitizedQuestions.length,
        groupContext,
        fallbackAction,
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        questions: formattedQuestions
      },
      output: `**${groupContext}**\n\n${formattedQuestions.map((q, index) => {
        let output = `**${index + 1}. ${q.question}**\n*${q.context}*${q.required ? ' (Required)' : ' (Optional)'}`;

        if (q.suggestions.length > 0) {
          output += `\n\nSuggested answers:\n${q.suggestions.map((s: FormattedSuggestion) =>
            `• ${s.text}${s.description ? ` - ${s.description}` : ''}`
          ).join('\n')}`;
        }

        return output;
      }).join('\n\n---\n\n')}${fallbackAction ? `\n\n*If you prefer not to provide these details, I'll ${fallbackAction}*` : ''}`
    };
  }
};