/**
 * Structured state management system for tracking conversation progress
 * 
 * This class manages the state of the conversation including:
 * - Current conversation phase
 * - Active tools and their execution status
 * - User interaction history
 * - Progress tracking for multi-step operations
 */

export interface ConversationPhase {
  name: string;
  description: string;
  entryCriteria: string[];
  exitCriteria: string[];
}

export interface ToolExecutionState {
  toolName: string;
  executionId: string;
  status: 'pending' | 'running' | 'executing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  error?: string;
  result?: any;
}

export interface UserInteraction {
  timestamp: number;
  type: 'message' | 'confirmation' | 'interruption';
  content: string;
  response?: string;
}

export interface ProgressTracker {
  operationId: string;
  totalSteps: number;
  currentStep: number;
  stepDescription: string;
  progressPercentage: number;
}

export class ConversationState {
  private currentPhase: string = 'initial';
  private currentMode: string = 'primary'; // New: Embedded mode tracking
  private toolExecutionStack: ToolExecutionState[] = [];
  private userInteractionHistory: UserInteraction[] = [];
  private progressTrackers: Map<string, ProgressTracker> = new Map();
  private conversationPhases: Map<string, ConversationPhase> = new Map();
  private lastActivityTimestamp: number = Date.now();
  
  // Define conversation phases
  constructor() {
    this.defineConversationPhases();
  }
  
  private defineConversationPhases(): void {
    this.conversationPhases.set('initial', {
      name: 'Initial',
      description: 'Starting phase of conversation',
      entryCriteria: ['New conversation started'],
      exitCriteria: ['User request understood']
    });
    
    this.conversationPhases.set('planning', {
      name: 'Planning',
      description: 'Analyzing user request and creating plan',
      entryCriteria: ['Complex request identified', 'Multiple steps needed'],
      exitCriteria: ['Plan created and confirmed']
    });
    
    this.conversationPhases.set('execution', {
      name: 'Execution',
      description: 'Executing planned operations',
      entryCriteria: ['Plan confirmed', 'Tools available'],
      exitCriteria: ['All operations completed']
    });
    
    this.conversationPhases.set('verification', {
      name: 'Verification',
      description: 'Verifying results and getting user feedback',
      entryCriteria: ['Operations completed'],
      exitCriteria: ['User satisfied', 'Results confirmed']
    });
    
    this.conversationPhases.set('completed', {
      name: 'Completed',
      description: 'Conversation completed successfully',
      entryCriteria: ['User satisfied', 'No further actions needed'],
      exitCriteria: ['Conversation ended']
    });
  }
  
  /**
   * Update the current conversation phase
   */
  public setCurrentPhase(phase: string): void {
    if (this.conversationPhases.has(phase)) {
      this.currentPhase = phase;
      this.lastActivityTimestamp = Date.now();
    } else {
      throw new Error(`Invalid conversation phase: ${phase}`);
    }
  }
  
  /**
   * Get the current conversation phase
   */
  public getCurrentPhase(): string {
    return this.currentPhase;
  }
  
  /**
   * Get details about a conversation phase
   */
  public getPhaseDetails(phase: string): ConversationPhase | undefined {
    return this.conversationPhases.get(phase);
  }
  
  /**
   * Start tracking a tool execution
   */
  public startToolExecution(toolName: string, executionId: string): void {
    const toolState: ToolExecutionState = {
      toolName,
      executionId,
      status: 'pending', // OpenCode: Start as pending
      startTime: Date.now()
    };
    
    this.toolExecutionStack.push(toolState);
    this.lastActivityTimestamp = Date.now();
  }
  
  // New: Update tool state (running/completed)
  public updateToolState(executionId: string, status: 'running' | 'completed' | 'failed', result?: any, error?: string): void {
    const toolState = this.toolExecutionStack.find(t => t.executionId === executionId);
    if (toolState) {
      toolState.status = status;
      if (status === 'completed' || status === 'failed') {
        toolState.endTime = Date.now();
      }
      if (result) toolState.result = result;
      if (error) toolState.error = error;
      this.lastActivityTimestamp = Date.now();
    }
  }
  
  // New: Get embedded tool states for messages
  public getEmbeddedToolStates(): Record<string, ToolExecutionState['status']> {
    return this.toolExecutionStack.reduce((acc, ts) => {
      acc[ts.toolName] = ts.status;
      return acc;
    }, {} as Record<string, ToolExecutionState['status']>);
  }
  
  // New: Set current mode from embedded metadata
  public setCurrentMode(mode: string): void {
    this.currentMode = mode;
    this.lastActivityTimestamp = Date.now();
  }
  
  public getCurrentMode(): string {
    return this.currentMode;
  }
  
  // New: Create snapshot for compaction
  public createSnapshot(): { mode: string; toolStates: Record<string, string>; phase: string } {
    return {
      mode: this.currentMode,
      toolStates: this.getEmbeddedToolStates(),
      phase: this.currentPhase
    };
  }
  
  /**
   * Complete a tool execution successfully
   */
  public completeToolExecution(executionId: string, result: any): void {
    const toolState = this.toolExecutionStack.find(t => t.executionId === executionId);
    if (toolState) {
      toolState.status = 'completed';
      toolState.endTime = Date.now();
      toolState.result = result;
      this.lastActivityTimestamp = Date.now();
    }
  }
  
  /**
   * Fail a tool execution
   */
  public failToolExecution(executionId: string, error: string): void {
    const toolState = this.toolExecutionStack.find(t => t.executionId === executionId);
    if (toolState) {
      toolState.status = 'failed';
      toolState.endTime = Date.now();
      toolState.error = error;
      this.lastActivityTimestamp = Date.now();
    }
  }
  
  /**
   * Get the current tool execution state
   */
  public getCurrentToolExecution(): ToolExecutionState | undefined {
    return this.toolExecutionStack.length > 0 ? 
      this.toolExecutionStack[this.toolExecutionStack.length - 1] : 
      undefined;
  }
  
  /**
   * Get all tool executions
   */
  public getToolExecutions(): ToolExecutionState[] {
    return [...this.toolExecutionStack];
  }
  
  /**
   * Record a user interaction
   */
  public recordUserInteraction(interaction: Omit<UserInteraction, 'timestamp'>): void {
    const userInteraction: UserInteraction = {
      ...interaction,
      timestamp: Date.now()
    };
    
    this.userInteractionHistory.push(userInteraction);
    this.lastActivityTimestamp = Date.now();
  }
  
  /**
   * Get recent user interactions
   */
  public getRecentUserInteractions(count: number = 10): UserInteraction[] {
    return this.userInteractionHistory.slice(-count);
  }
  
  /**
   * Start tracking progress for an operation
   */
  public startProgressTracking(operationId: string, totalSteps: number, stepDescription: string): void {
    const progressTracker: ProgressTracker = {
      operationId,
      totalSteps,
      currentStep: 0,
      stepDescription,
      progressPercentage: 0
    };
    
    this.progressTrackers.set(operationId, progressTracker);
    this.lastActivityTimestamp = Date.now();
  }
  
  /**
   * Update progress for an operation
   */
  public updateProgress(operationId: string, currentStep: number, stepDescription?: string): void {
    const progressTracker = this.progressTrackers.get(operationId);
    if (progressTracker) {
      progressTracker.currentStep = currentStep;
      if (stepDescription) {
        progressTracker.stepDescription = stepDescription;
      }
      progressTracker.progressPercentage = Math.round((currentStep / progressTracker.totalSteps) * 100);
      this.lastActivityTimestamp = Date.now();
    }
  }
  
  /**
   * Complete progress tracking for an operation
   */
  public completeProgressTracking(operationId: string): void {
    const progressTracker = this.progressTrackers.get(operationId);
    if (progressTracker) {
      progressTracker.currentStep = progressTracker.totalSteps;
      progressTracker.progressPercentage = 100;
      progressTracker.stepDescription = 'Completed';
      this.lastActivityTimestamp = Date.now();
    }
  }
  
  /**
   * Get progress tracker for an operation
   */
  public getProgressTracker(operationId: string): ProgressTracker | undefined {
    return this.progressTrackers.get(operationId);
  }
  
  /**
   * Get all active progress trackers
   */
  public getActiveProgressTrackers(): ProgressTracker[] {
    return Array.from(this.progressTrackers.values());
  }
  
  /**
   * Get time since last activity
   */
  public getIdleTime(): number {
    return Date.now() - this.lastActivityTimestamp;
  }
  
  /**
   * Reset the conversation state
   */
  public reset(): void {
    this.currentPhase = 'initial';
    this.toolExecutionStack = [];
    this.userInteractionHistory = [];
    this.progressTrackers.clear();
    this.lastActivityTimestamp = Date.now();
  }
  
  /**
   * Serialize the conversation state for persistence
   */
  public serialize(): string {
    return JSON.stringify({
      currentPhase: this.currentPhase,
      toolExecutionStack: this.toolExecutionStack,
      userInteractionHistory: this.userInteractionHistory,
      progressTrackers: Array.from(this.progressTrackers.entries()),
      lastActivityTimestamp: this.lastActivityTimestamp
    });
  }
  
  /**
   * Deserialize the conversation state from persistence
   */
  public static deserialize(serializedState: string): ConversationState {
    const state = new ConversationState();
    const parsed = JSON.parse(serializedState);
    
    state.currentPhase = parsed.currentPhase || 'initial';
    state.toolExecutionStack = parsed.toolExecutionStack || [];
    state.userInteractionHistory = parsed.userInteractionHistory || [];
    state.progressTrackers = new Map(parsed.progressTrackers || []);
    state.lastActivityTimestamp = parsed.lastActivityTimestamp || Date.now();
    
    return state;
  }
}