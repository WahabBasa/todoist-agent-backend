// =================================================================
// CLIENT-SIDE EVENT STREAM RECONSTRUCTION UTILITIES
// OpenCode-inspired progressive content reconstruction from events
// Handles text accumulation, tool state tracking, and real-time updates
// =================================================================

import { Id } from '../../convex/_generated/dataModel';

/**
 * Stream event types (must match backend definitions)
 */
export type StreamEventType = 
  | 'stream-start'
  | 'text-delta' 
  | 'tool-call'
  | 'tool-result'
  | 'stream-finish'
  | 'stream-error';

/**
 * Raw event from Convex backend
 */
export interface StreamEvent {
  _id: Id<"streamEvents">;
  streamId: string;
  eventType: StreamEventType;
  payload: any;
  order: number;
  createdAt: number;
}

/**
 * Tool execution state (similar to OpenCode's MessageV2.ToolPart state)
 */
export interface ToolState {
  toolCallId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: any;
  output?: any;
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  timing: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
}

/**
 * Reconstructed stream state from events
 */
export interface ReconstructedStream {
  streamId: string;
  content: string;
  isComplete: boolean;
  status: 'streaming' | 'complete' | 'error';
  userMessage: string;
  modelName?: string;
  toolStates: Map<string, ToolState>;
  metadata: {
    totalEvents: number;
    lastEventOrder: number;
    startTime: number;
    endTime?: number;
    duration?: number;
    textEventCount: number;
    toolEventCount: number;
  };
  error?: {
    message: string;
    type: string;
    recoverable: boolean;
  };
}

/**
 * Event reconstruction configuration
 */
export interface ReconstructionConfig {
  /**
   * Whether to validate event ordering (default: true)
   */
  validateOrdering?: boolean;
  
  /**
   * Maximum content length before truncation (default: 100000)
   */
  maxContentLength?: number;
  
  /**
   * Whether to include debug information (default: false)
   */
  includeDebugInfo?: boolean;
  
  /**
   * Custom text delta processor
   */
  processTextDelta?: (current: string, delta: string) => string;
}

/**
 * Progressive stream reconstructor
 * Implements OpenCode's pattern of incremental state building from discrete events
 */
export class StreamReconstructor {
  private config: Required<ReconstructionConfig>;
  private debugLog: Array<{ timestamp: number; event: string; order: number }> = [];

  constructor(config: ReconstructionConfig = {}) {
    this.config = {
      validateOrdering: config.validateOrdering ?? true,
      maxContentLength: config.maxContentLength ?? 100000,
      includeDebugInfo: config.includeDebugInfo ?? false,
      processTextDelta: config.processTextDelta ?? ((current, delta) => current + delta),
    };
  }

  /**
   * Reconstruct stream state from a batch of events
   * Similar to OpenCode's message part accumulation pattern
   */
  reconstruct(events: StreamEvent[]): ReconstructedStream | null {
    if (events.length === 0) return null;

    // Sort events by order (critical for correct reconstruction)
    const sortedEvents = this.config.validateOrdering 
      ? [...events].sort((a, b) => a.order - b.order)
      : events;

    // Find start event to initialize stream
    const startEvent = sortedEvents.find(e => e.eventType === 'stream-start');
    if (!startEvent) {
      throw new Error('Cannot reconstruct stream without start event');
    }

    // Initialize reconstructed stream
    const reconstructed: ReconstructedStream = {
      streamId: startEvent.streamId,
      content: '',
      isComplete: false,
      status: 'streaming',
      userMessage: startEvent.payload.userMessage || '',
      modelName: startEvent.payload.modelName,
      toolStates: new Map(),
      metadata: {
        totalEvents: events.length,
        lastEventOrder: Math.max(...events.map(e => e.order)),
        startTime: startEvent.createdAt,
        textEventCount: 0,
        toolEventCount: 0,
      },
    };

    // Process each event to build final state
    for (const event of sortedEvents) {
      this.processEvent(reconstructed, event);
    }

    // Finalize metadata
    this.finalizeMetadata(reconstructed);

    return reconstructed;
  }

  /**
   * Process a single event (OpenCode's discrete event handling pattern)
   */
  private processEvent(stream: ReconstructedStream, event: StreamEvent): void {
    if (this.config.includeDebugInfo) {
      this.debugLog.push({
        timestamp: Date.now(),
        event: event.eventType,
        order: event.order,
      });
    }

    switch (event.eventType) {
      case 'stream-start':
        this.processStreamStart(stream, event);
        break;
        
      case 'text-delta':
        this.processTextDelta(stream, event);
        break;
        
      case 'tool-call':
        this.processToolCall(stream, event);
        break;
        
      case 'tool-result':
        this.processToolResult(stream, event);
        break;
        
      case 'stream-finish':
        this.processStreamFinish(stream, event);
        break;
        
      case 'stream-error':
        this.processStreamError(stream, event);
        break;
        
      default:
        console.warn(`[StreamReconstructor] Unknown event type: ${event.eventType}`);
    }
  }

  private processStreamStart(stream: ReconstructedStream, event: StreamEvent): void {
    // Stream start already handled in initialization
    stream.userMessage = event.payload.userMessage || stream.userMessage;
    stream.modelName = event.payload.modelName || stream.modelName;
    
    if (event.payload.sessionContext) {
      // Could add session context to metadata
      stream.metadata = { 
        ...stream.metadata, 
        sessionContext: event.payload.sessionContext 
      };
    }
  }

  private processTextDelta(stream: ReconstructedStream, event: StreamEvent): void {
    const deltaText = event.payload.text || '';
    
    // Apply text delta with length protection
    const newContent = this.config.processTextDelta(stream.content, deltaText);
    
    if (newContent.length > this.config.maxContentLength) {
      stream.content = newContent.slice(0, this.config.maxContentLength) + '\n\n[Content truncated due to length limit]';
    } else {
      stream.content = newContent;
    }
    
    stream.metadata.textEventCount++;
  }

  private processToolCall(stream: ReconstructedStream, event: StreamEvent): void {
    const { toolCallId, toolName, input } = event.payload;
    
    const toolState: ToolState = {
      toolCallId,
      toolName,
      status: 'running',
      input,
      timing: {
        startTime: event.createdAt,
      },
    };
    
    stream.toolStates.set(toolCallId, toolState);
    stream.metadata.toolEventCount++;
  }

  private processToolResult(stream: ReconstructedStream, event: StreamEvent): void {
    const { toolCallId, output, success, error } = event.payload;
    
    const existingTool = stream.toolStates.get(toolCallId);
    if (existingTool) {
      existingTool.status = success ? 'completed' : 'error';
      existingTool.output = output;
      existingTool.error = error;
      existingTool.timing.endTime = event.createdAt;
      existingTool.timing.duration = 
        (existingTool.timing.endTime - (existingTool.timing.startTime || 0));
      
      // Extract metadata from output if structured
      if (output && typeof output === 'object') {
        if (output.title || output.metadata) {
          existingTool.metadata = {
            title: output.title,
            description: output.description,
            ...output.metadata,
          };
        }
      }
      
      stream.toolStates.set(toolCallId, existingTool);
    } else {
      // Tool result without corresponding tool call (shouldn't happen but handle gracefully)
      console.warn(`[StreamReconstructor] Tool result for unknown tool call: ${toolCallId}`);
    }
  }

  private processStreamFinish(stream: ReconstructedStream, event: StreamEvent): void {
    stream.isComplete = true;
    stream.status = 'complete';
    stream.metadata.endTime = event.createdAt;
    
    const { finalContent, totalEvents, toolCalls, toolResults } = event.payload;
    
    // Validate final content matches reconstructed content (OpenCode-style validation)
    if (finalContent && finalContent !== stream.content) {
      if (this.config.includeDebugInfo) {
        console.warn('[StreamReconstructor] Final content mismatch detected');
      }
      // Use reconstructed content as it's built from events
    }
    
    // Ensure all tools are properly closed
    for (const [toolCallId, toolState] of stream.toolStates) {
      if (toolState.status === 'running' || toolState.status === 'pending') {
        toolState.status = 'completed';
        toolState.timing.endTime = event.createdAt;
      }
    }
  }

  private processStreamError(stream: ReconstructedStream, event: StreamEvent): void {
    stream.isComplete = true;
    stream.status = 'error';
    stream.metadata.endTime = event.createdAt;
    
    const { error, errorType, recoverable } = event.payload;
    stream.error = {
      message: error || 'Unknown stream error',
      type: errorType || 'system',
      recoverable: recoverable ?? false,
    };
    
    // Mark all running tools as errored
    for (const [toolCallId, toolState] of stream.toolStates) {
      if (toolState.status === 'running' || toolState.status === 'pending') {
        toolState.status = 'error';
        toolState.error = 'Stream ended with error';
        toolState.timing.endTime = event.createdAt;
      }
    }
  }

  private finalizeMetadata(stream: ReconstructedStream): void {
    if (stream.metadata.endTime) {
      stream.metadata.duration = stream.metadata.endTime - stream.metadata.startTime;
    }
    
    if (this.config.includeDebugInfo) {
      (stream.metadata as any).debugLog = this.debugLog;
    }
  }

  /**
   * Get summary statistics for debugging
   */
  getStats(): {
    eventsProcessed: number;
    debugLogEntries: number;
    averageProcessingTime: number;
  } {
    return {
      eventsProcessed: this.debugLog.length,
      debugLogEntries: this.debugLog.length,
      averageProcessingTime: this.debugLog.length > 0 
        ? this.debugLog.reduce((sum, entry, idx, arr) => {
            if (idx === 0) return 0;
            return sum + (entry.timestamp - arr[idx - 1].timestamp);
          }, 0) / (this.debugLog.length - 1)
        : 0,
    };
  }

  /**
   * Reset internal state
   */
  reset(): void {
    this.debugLog = [];
  }
}

/**
 * Utility functions for common event stream operations
 */
export const EventStreamUtils = {
  /**
   * Extract all tool executions from a reconstructed stream
   */
  getToolExecutions(stream: ReconstructedStream): ToolState[] {
    return Array.from(stream.toolStates.values())
      .sort((a, b) => (a.timing.startTime || 0) - (b.timing.startTime || 0));
  },

  /**
   * Check if stream has any running tools
   */
  hasRunningTools(stream: ReconstructedStream): boolean {
    return Array.from(stream.toolStates.values())
      .some(tool => tool.status === 'running' || tool.status === 'pending');
  },

  /**
   * Get stream progress as a percentage
   */
  getProgress(stream: ReconstructedStream): number {
    if (stream.isComplete) return 100;
    
    // Simple heuristic: if tools are running, we're making progress
    const hasTools = stream.toolStates.size > 0;
    const hasContent = stream.content.length > 0;
    
    if (hasContent && hasTools) return 75;
    if (hasContent) return 50;
    if (hasTools) return 25;
    return 10; // Stream started
  },

  /**
   * Format stream duration for display
   */
  formatDuration(stream: ReconstructedStream): string {
    const duration = stream.metadata.duration || 
      (stream.metadata.endTime ? stream.metadata.endTime - stream.metadata.startTime : 
       Date.now() - stream.metadata.startTime);
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  },

  /**
   * Create a default reconstructor instance
   */
  createDefaultReconstructor(): StreamReconstructor {
    return new StreamReconstructor({
      validateOrdering: true,
      maxContentLength: 50000,
      includeDebugInfo: process.env.NODE_ENV === 'development',
    });
  },
};