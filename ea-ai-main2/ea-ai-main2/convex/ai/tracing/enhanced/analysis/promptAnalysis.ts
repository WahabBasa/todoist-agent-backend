import { estimateTokenUsage, calculatePromptComplexity } from '../spans/enhancedPromptSpans';
import { PromptEffectivenessMetrics } from '../attributes/promptAttributes';

/**
 * Interface for prompt analysis parameters
 */
export interface PromptAnalysisParams {
  prompt: {
    systemPrompt: string;
    history: any[];
    userMessage: string;
  };
  response: string;
  toolCalls: any[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Interface for prompt components
 */
export interface PromptComponent {
  type: 'system' | 'history' | 'user_message';
  content: string | any[];
}

/**
 * Analyze prompt effectiveness based on response and tool calls
 * @param params - Parameters for prompt analysis
 * @returns Effectiveness metrics
 */
export function analyzePromptEffectiveness(params: PromptAnalysisParams): PromptEffectivenessMetrics {
  const { prompt, response, toolCalls, tokenUsage } = params;
  
  // Calculate response quality
  const responseQuality = calculateResponseQuality(response, toolCalls);
  
  // Calculate tool efficiency
  const toolEfficiency = calculateToolEfficiency(toolCalls);
  
  // Calculate token efficiency
  const tokenEfficiency = calculateTokenEfficiency(response, toolCalls, tokenUsage);
  
  // Calculate completion rate
  const completionRate = calculateCompletionRate(response, toolCalls);
  
  // Calculate response relevance
  const responseRelevance = calculateResponseRelevance(prompt.userMessage, response, toolCalls);
  
  return {
    responseQuality,
    toolEfficiency,
    tokenEfficiency,
    completionRate,
    responseRelevance,
  };
}

/**
 * Calculate response quality based on various factors
 * @param response - The AI response
 * @param toolCalls - Array of tool calls made
 * @returns Response quality score (0-100)
 */
function calculateResponseQuality(response: string, toolCalls: any[]): number {
  let quality = 50; // Base quality
  
  // Factor 1: Response length (optimal range: 50-500 characters)
  if (response.length >= 50 && response.length <= 500) {
    quality += 15;
  } else if (response.length > 20 && response.length < 1000) {
    quality += 5;
  }
  
  // Factor 2: Response structure (has proper sentences)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 1 && sentences.length <= 5) {
    quality += 10;
  }
  
  // Factor 3: Tool call integration
  if (toolCalls.length > 0) {
    // Check if response explains tool actions
    const hasToolExplanation = /(?:I'll|I am|I will|Let me|Going to)\s+(?:use|call|check|get|find|search)/i.test(response);
    if (hasToolExplanation) {
      quality += 15;
    }
  }
  
  // Factor 4: Response completeness
  if (response.trim().endsWith('.') || response.trim().endsWith('!') || response.trim().endsWith('?')) {
    quality += 10;
  }
  
  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, quality));
}

/**
 * Calculate tool efficiency based on tool calls
 * @param toolCalls - Array of tool calls made
 * @returns Tool efficiency score (0-100)
 */
function calculateToolEfficiency(toolCalls: any[]): number {
  if (toolCalls.length === 0) {
    return 100; // No tools needed is efficient
  }
  
  let efficiency = 70; // Base efficiency
  
  // Factor 1: Number of tool calls (optimal: 1-3)
  if (toolCalls.length === 1) {
    efficiency += 20;
  } else if (toolCalls.length <= 3) {
    efficiency += 10;
  } else if (toolCalls.length > 5) {
    efficiency -= 20; // Too many tools is inefficient
  }
  
  // Factor 2: Tool call diversity
  const uniqueTools = new Set(toolCalls.map(call => call.toolName || call.name));
  if (uniqueTools.size === 1 && toolCalls.length === 1) {
    efficiency += 10; // Single tool use is efficient
  } else if (uniqueTools.size > toolCalls.length * 0.7) {
    efficiency += 5; // Good diversity
  }
  
  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, efficiency));
}

/**
 * Calculate token efficiency based on token usage
 * @param response - The AI response
 * @param toolCalls - Array of tool calls made
 * @param tokenUsage - Token usage information
 * @returns Token efficiency score (0-100)
 */
function calculateTokenEfficiency(
  response: string, 
  toolCalls: any[], 
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number }
): number {
  if (!tokenUsage) {
    // Estimate based on response and tool calls
    const estimatedTokens = estimateTokenUsage(response) + (toolCalls.length * 20);
    // Simple efficiency based on response length vs estimated tokens
    return Math.min(100, Math.max(0, 100 - (estimatedTokens / 10)));
  }
  
  const { inputTokens, outputTokens, totalTokens } = tokenUsage;
  
  // Calculate output-to-input ratio (optimal: 0.5-2.0)
  const ratio = outputTokens / Math.max(1, inputTokens);
  let efficiency = 50;
  
  if (ratio >= 0.5 && ratio <= 2.0) {
    efficiency += 30;
  } else if (ratio >= 0.3 && ratio <= 3.0) {
    efficiency += 15;
  }
  
  // Factor for total token usage (lower is better for same result)
  if (totalTokens < 500) {
    efficiency += 20;
  } else if (totalTokens < 1000) {
    efficiency += 10;
  } else if (totalTokens > 2000) {
    efficiency -= 20;
  }
  
  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, efficiency));
}

/**
 * Calculate completion rate based on response and tool calls
 * @param response - The AI response
 * @param toolCalls - Array of tool calls made
 * @returns Completion rate score (0-100)
 */
function calculateCompletionRate(response: string, toolCalls: any[]): number {
  let completion = 50; // Base completion
  
  // Factor 1: Response completeness
  if (response.length > 20) {
    completion += 20;
  }
  
  // Factor 2: Tool call completion
  if (toolCalls.length > 0) {
    // Assume tool calls were completed (would need actual results in real implementation)
    completion += 20;
  }
  
  // Factor 3: Response finality
  const finalPhrases = [
    /I've (completed|finished|done)/i,
    /Here (is|are)/i,
    /The (result|answer|solution)/i,
    /All (done|set|completed)/i
  ];
  
  const hasFinality = finalPhrases.some(phrase => phrase.test(response));
  if (hasFinality) {
    completion += 10;
  }
  
  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, completion));
}

/**
 * Calculate response relevance to user message
 * @param userMessage - The original user message
 * @param response - The AI response
 * @param toolCalls - Array of tool calls made
 * @returns Response relevance score (0-100)
 */
function calculateResponseRelevance(userMessage: string, response: string, toolCalls: any[]): number {
  let relevance = 50; // Base relevance
  
  // Extract keywords from user message
  const userWords = userMessage.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Extract keywords from response
  const responseWords = response.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Calculate keyword overlap
  const overlap = userWords.filter(word => responseWords.includes(word));
  const overlapRatio = overlap.length / Math.max(1, userWords.length);
  
  if (overlapRatio > 0.5) {
    relevance += 30;
  } else if (overlapRatio > 0.3) {
    relevance += 20;
  } else if (overlapRatio > 0.1) {
    relevance += 10;
  }
  
  // Check for question answering
  if (userMessage.includes('?')) {
    // Response should answer the question
    const answerPhrases = [
      /^(yes|no)/i,
      /(?:answer|solution|result) is/i,
      /(?:I think|believe|would say)/i
    ];
    
    const hasAnswer = answerPhrases.some(phrase => phrase.test(response));
    if (hasAnswer) {
      relevance += 20;
    }
  }
  
  // Check for tool relevance
  if (toolCalls.length > 0) {
    // Tools should be relevant to user request
    const toolRelevance = checkToolRelevance(userMessage, toolCalls);
    relevance += toolRelevance;
  }
  
  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, relevance));
}

/**
 * Check if tool calls are relevant to user message
 * @param userMessage - The original user message
 * @param toolCalls - Array of tool calls made
 * @returns Tool relevance score (0-30)
 */
function checkToolRelevance(userMessage: string, toolCalls: any[]): number {
  let relevance = 0;
  
  // Simple keyword matching for common tools
  const toolKeywords: Record<string, string[]> = {
    'todoist': ['todo', 'task', 'list', 'add', 'create'],
    'calendar': ['calendar', 'event', 'schedule', 'meeting', 'appointment'],
    'google': ['search', 'find', 'look up', 'google'],
    'internal': ['note', 'remember', 'save', 'store']
  };
  
  const lowerUserMessage = userMessage.toLowerCase();
  
  for (const toolCall of toolCalls) {
    const toolName = (toolCall.toolName || toolCall.name || '').toLowerCase();
    
    for (const [tool, keywords] of Object.entries(toolKeywords)) {
      if (toolName.includes(tool)) {
        const hasKeyword = keywords.some(keyword => lowerUserMessage.includes(keyword));
        if (hasKeyword) {
          relevance += 15;
        }
      }
    }
  }
  
  return Math.min(30, relevance); // Cap at 30 points
}

/**
 * Calculate prompt complexity based on components
 * @param components - Array of prompt components
 * @returns Complexity score (0-100)
 */
export function calculatePromptComplexityScore(components: PromptComponent[]): number {
  return calculatePromptComplexity(components);
}

/**
 * Estimate token usage for content
 * @param content - The content to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenUsageForContent(content: string | any[]): number {
  return estimateTokenUsage(content);
}

/**
 * Generate a prompt analysis report
 * @param params - Parameters for prompt analysis
 * @returns Formatted analysis report
 */
export function generatePromptAnalysisReport(params: PromptAnalysisParams): string {
  const metrics = analyzePromptEffectiveness(params);
  const complexity = calculatePromptComplexityScore([
    { type: 'system', content: params.prompt.systemPrompt },
    { type: 'history', content: params.prompt.history },
    { type: 'user_message', content: params.prompt.userMessage }
  ]);
  
  return `
Prompt Analysis Report:
=======================
Response Quality: ${metrics.responseQuality}/100
Tool Efficiency: ${metrics.toolEfficiency}/100
Token Efficiency: ${metrics.tokenEfficiency}/100
Completion Rate: ${metrics.completionRate}/100
Response Relevance: ${metrics.responseRelevance}/100
Prompt Complexity: ${complexity}/100

Overall Effectiveness: ${Math.round((metrics.responseQuality + metrics.toolEfficiency + metrics.tokenEfficiency + metrics.completionRate + metrics.responseRelevance) / 5)}/100
  `.trim();
}