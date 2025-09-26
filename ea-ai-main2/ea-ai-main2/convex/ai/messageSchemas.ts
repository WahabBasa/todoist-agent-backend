import { z } from 'zod';

// Zod schema for embedded metadata (OpenCode-inspired)
export const EmbeddedMetadataSchema = z.object({
  mode: z.string().optional(),
  toolStates: z.record(z.enum(['pending', 'running', 'completed'])).optional(),
  delegation: z.object({
    target: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    reason: z.string().optional()
  }).optional()
});

// Full message schema
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().optional(),
  toolCalls: z.array(z.object({
    name: z.string(),
    args: z.any(),
    toolCallId: z.string()
  })).optional(),
  toolResults: z.array(z.object({
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.any()
  })).optional(),
  timestamp: z.number(),
  mode: z.string().optional(),
  metadata: EmbeddedMetadataSchema.optional()
});

// Parse embedded metadata from message
export function parseEmbeddedMetadata(message: any): z.infer<typeof EmbeddedMetadataSchema> | null {
  try {
    return EmbeddedMetadataSchema.parse(message.metadata || {});
  } catch {
    return null;
  }
}

// Create embedded message
export function createEmbeddedMessage(base: any, metadata: z.infer<typeof EmbeddedMetadataSchema>): any {
  return {
    ...base,
    metadata: EmbeddedMetadataSchema.parse(metadata)
  };
}