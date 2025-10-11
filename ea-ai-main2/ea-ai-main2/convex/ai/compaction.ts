"use node";

import { streamText } from 'ai';
import { EmbeddedMetadataSchema } from './messageSchemas';

export async function autoCompactHistory(history: any[], maxLength: number = 50): Promise<any[]> {
  if (history.length <= maxLength) return history;

  // Extract snapshot from ConversationState (assume access)
  const snapshot = { /* mode, toolStates from last message */ };
  
  // Summarize via LLM (OpenCode snapshot)
  const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
  const model = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    extraBody: { provider: { sort: 'throughput' } },
  }).chat('anthropic/claude-3-5-sonnet-20240620');
  const summaryResult = await streamText({
    model,
    messages: [{
      role: 'system',
      content: 'Summarize conversation history concisely, preserving key decisions, modes, and unresolved tasks. Include embedded metadata.'
    }, {
      role: 'user',
      content: `History (${history.length} msgs): ${JSON.stringify(history.slice(-20))}` // Last 20 for context
    }]
  });
  
  const summary = await summaryResult.text;
  
  // Create compacted history: Keep recent + summary as system msg
  const compacted = history.slice(-10).filter(msg => msg.role !== 'system'); // Keep recent non-system
  compacted.unshift({
    role: 'system',
    content: `Compacted Summary: ${summary}. Snapshot: ${JSON.stringify(snapshot)}.`,
    timestamp: Date.now(),
    metadata: EmbeddedMetadataSchema.parse(snapshot)
  });
  
  return compacted;
}