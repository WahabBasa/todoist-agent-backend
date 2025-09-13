/**
 * Class for detecting consecutive identical tool calls
 * to prevent the AI from getting stuck in a loop.
 */
export class ToolRepetitionDetector {
  private previousToolCallJson: string | null = null;
  private consecutiveIdenticalToolCallCount: number = 0;
  private readonly consecutiveIdenticalToolCallLimit: number;

  /**
   * Creates a new ToolRepetitionDetector
   * @param limit The maximum number of identical consecutive tool calls allowed
   */
  constructor(limit: number = 3) {
    this.consecutiveIdenticalToolCallLimit = limit;
  }

  /**
   * Checks if the current tool call is identical to the previous one
   * and determines if execution should be allowed
   *
   * @param currentToolCallBlock Tool call object representing the current tool call
   * @returns Object indicating if execution is allowed and a message to show if not
   */
  public check(currentToolCallBlock: any): {
    allowExecution: boolean;
    message?: string;
  } {
    // Serialize the block to a canonical JSON string for comparison
    const currentToolCallJson = this.serializeToolCall(currentToolCallBlock);

    // Compare with previous tool call
    if (this.previousToolCallJson === currentToolCallJson) {
      this.consecutiveIdenticalToolCallCount++;
    } else {
      this.consecutiveIdenticalToolCallCount = 0; // Reset to 0 for a new tool
      this.previousToolCallJson = currentToolCallJson;
    }

    // Check if limit is reached (0 means unlimited)
    if (
      this.consecutiveIdenticalToolCallLimit > 0 &&
      this.consecutiveIdenticalToolCallCount >= this.consecutiveIdenticalToolCallLimit
    ) {
      // Reset counters to allow recovery if user guides the AI past this point
      this.consecutiveIdenticalToolCallCount = 0;
      this.previousToolCallJson = null;

      // Return result indicating execution should not be allowed
      return {
        allowExecution: false,
        message: `Detected ${this.consecutiveIdenticalToolCallLimit} consecutive identical tool calls. This may indicate the AI is stuck in a loop. Please try a different approach or provide more specific guidance.`
      };
    }

    // Execution is allowed
    return { allowExecution: true };
  }

  /**
   * Serializes a tool call object into a canonical JSON string for comparison
   *
   * @param toolCall The tool call object to serialize
   * @returns JSON string representation of the tool call with sorted parameter keys
   */
  private serializeToolCall(toolCall: any): string {
    // Create a new parameters object with alphabetically sorted keys
    const sortedParams: Record<string, unknown> = {};

    // Get parameter keys and sort them alphabetically
    if (toolCall.input) {
      const sortedKeys = Object.keys(toolCall.input).sort();

      // Populate the sorted parameters object in a type-safe way
      for (const key of sortedKeys) {
        if (Object.prototype.hasOwnProperty.call(toolCall.input, key)) {
          sortedParams[key] = (toolCall.input as Record<string, unknown>)[key];
        }
      }
    }

    // Create the object with the tool name and sorted parameters
    const toolObject = {
      name: toolCall.toolName || toolCall.name,
      parameters: sortedParams,
    };

    // Convert to a canonical JSON string
    return JSON.stringify(toolObject);
  }
}