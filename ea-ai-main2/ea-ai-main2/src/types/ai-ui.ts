// Minimal UI types to replace removed '@ai-sdk/ui-utils' in AI SDK v5
// Covers only the shapes used in this codebase

export interface TextUIPart {
  type: 'text';
  text: string;
}

export type ToolInvocationState = 'call' | 'partial-call' | 'result';

export interface ToolInvocationUIPart {
  type: 'tool-invocation';
  toolInvocation: {
    state: ToolInvocationState;
    toolCallId: string;
    toolName: string;
    args?: unknown;
    result?: unknown;
  };
}

export type UnknownUIPart = { type: string; [key: string]: any };

export type UiPart = TextUIPart | ToolInvocationUIPart | UnknownUIPart;

export interface UIMessage {
  id?: string;
  role: 'user' | 'assistant' | string;
  content?: string;
  parts?: UiPart[];
}
