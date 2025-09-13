/**
 * Parse assistant message to extract tool calls and text content
 * 
 * This function parses the assistant's response to identify:
 * 1. Tool calls in XML format
 * 2. Regular text content
 * 3. Mixed content with both text and tool calls
 */

export interface ToolCall {
  toolName: string;
  input: Record<string, any>;
  toolCallId: string;
}

export interface ParsedAssistantMessage {
  text: string;
  toolCalls: ToolCall[];
}

export function parseAssistantMessage(assistantMessage: string): ParsedAssistantMessage {
  const result: ParsedAssistantMessage = {
    text: "",
    toolCalls: []
  };

  // If the message is empty, return empty result
  if (!assistantMessage || assistantMessage.trim() === "") {
    return result;
  }

  // Simple regex-based parsing for XML-style tool calls
  // This looks for patterns like <tool_name><param>value</param></tool_name>
  const toolCallRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match;

  // Process the message to extract tool calls and text
  while ((match = toolCallRegex.exec(assistantMessage)) !== null) {
    const [fullMatch, toolName, content] = match;
    
    // Add any text before this tool call to the result
    const textBefore = assistantMessage.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      if (result.text) {
        result.text += " " + textBefore.trim();
      } else {
        result.text = textBefore.trim();
      }
    }
    
    // Parse the tool call content
    const input: Record<string, any> = {};
    
    // Simple parameter extraction - looks for <param_name>value</param_name> patterns
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let paramMatch;
    let remainingContent = content;
    
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      const [, paramName, paramValue] = paramMatch;
      input[paramName] = paramValue.trim();
      
      // Remove this parameter from remaining content
      remainingContent = remainingContent.replace(paramMatch[0], '').trim();
    }
    
    // If there's remaining content that's not in parameter format, treat it as a single "content" parameter
    if (remainingContent && !input.content) {
      input.content = remainingContent.trim();
    }
    
    // Create a simple tool call ID
    const toolCallId = `call_${Date.now()}_${result.toolCalls.length}`;
    
    result.toolCalls.push({
      toolName,
      input,
      toolCallId
    });
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add any remaining text after the last tool call
  const textAfter = assistantMessage.substring(lastIndex);
  if (textAfter.trim()) {
    if (result.text) {
      result.text += " " + textAfter.trim();
    } else {
      result.text = textAfter.trim();
    }
  }
  
  return result;
}

/**
 * Validate that a tool call has all required parameters
 */
export function validateToolCall(toolCall: ToolCall, requiredParams: string[]): boolean {
  for (const param of requiredParams) {
    if (!(param in toolCall.input)) {
      return false;
    }
  }
  return true;
}

/**
 * Format tool call result for response
 */
export function formatToolResult(toolCall: ToolCall, result: any): string {
  return `<${toolCall.toolName}_result>
${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
</${toolCall.toolName}_result>`;
}