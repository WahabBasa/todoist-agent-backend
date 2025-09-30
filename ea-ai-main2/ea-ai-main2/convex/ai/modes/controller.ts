// Mode controller - manages mode switching and transitions
import { ModeRegistry } from "./registry";
import { logModeSwitch, logDebug } from "../logger";
import { api } from "../../_generated/api";

export namespace ModeController {
  // Current session mode state
  interface SessionModeState {
    currentMode: string;
    previousMode: string | null;
    modeHistory: string[];
    context: Record<string, any>;
  }

  // Session mode states storage
  const sessionStates = new Map<string, SessionModeState>();

  /**
   * Initialize mode state for a session
   */
  export function initializeSession(sessionId: string): void {
    sessionStates.set(sessionId, {
      currentMode: "primary",
      previousMode: null,
      modeHistory: ["primary"],
      context: {}
    });
  }

  /**
   * Get current mode for a session
   */
  export function getCurrentMode(sessionId: string): string {
    const state = sessionStates.get(sessionId);
    return state ? state.currentMode : "primary";
  }
  
  export function setCurrentMode(sessionId: string, mode: string): void {
    let state = sessionStates.get(sessionId);
    if (!state) {
      initializeSession(sessionId);
      state = sessionStates.get(sessionId)!;
    }
    state.currentMode = mode;
  }

  /**
   * Get previous mode for a session
   */
  export function getPreviousMode(sessionId: string): string | null {
    const state = sessionStates.get(sessionId);
    return state ? state.previousMode : null;
  }

  /**
   * Switch to a specific mode
   */
  export function switchToMode(sessionId: string, modeName: string): boolean {
    // Validate mode exists
    if (!ModeRegistry.isValidMode(modeName)) {
      console.warn(`[ModeController] Invalid mode: ${modeName}`);
      return false;
    }

    // Get or initialize session state
    let state = sessionStates.get(sessionId);
    if (!state) {
      initializeSession(sessionId);
      state = sessionStates.get(sessionId)!;
    }

    // Update mode state
    state.previousMode = state.currentMode;
    state.currentMode = modeName;
    state.modeHistory.push(modeName);

    // Keep history to a reasonable size
    if (state.modeHistory.length > 10) {
      state.modeHistory = state.modeHistory.slice(-10);
    }

    // Only log mode switches
    // Get tool count for the new mode
    const modeTools = ModeRegistry.getModeTools(modeName);
    const toolCount = Object.keys(modeTools).filter(toolName => modeTools[toolName] === true).length;
    
    // Log mode switch with structured logging
    logModeSwitch(state.previousMode || "unknown", modeName, "Mode controller switch", sessionId);
    
    return true;
  }

  /**
   * Switch to the next logical mode in the sequence
   */
  export function switchToNextMode(sessionId: string): boolean {
    const currentMode = getCurrentMode(sessionId);
    const nextMode = ModeRegistry.getNextMode(currentMode);
    return switchToMode(sessionId, nextMode);
  }

  /**
   * Switch to the previous mode
   */
  export function switchToPreviousMode(sessionId: string): boolean {
    const state = sessionStates.get(sessionId);
    if (!state || !state.previousMode) {
      return false;
    }
    return switchToMode(sessionId, state.previousMode);
  }

  /**
   * Execute LLM decisions from evaluateUserResponse tool
   * Handles the application layer execution of model decisions
   */
  export async function executeUserResponseDecision(sessionId: string, decision: any, ctx: any): Promise<boolean> {
    try {
      // SECURITY: Validate inputs
      if (!sessionId || typeof sessionId !== 'string') {
        console.error(`[ModeController] Invalid sessionId provided`);
        return false;
      }

      if (!decision || typeof decision !== 'object') {
        console.error(`[ModeController] Invalid decision object provided`);
        return false;
      }

      // SECURITY: Validate required decision fields
      const { nextAction, decision: decisionType, focusArea } = decision;

      if (!nextAction || !decisionType) {
        console.error(`[ModeController] Decision missing required fields`);
        return false;
      }

      logDebug(`[ModeController] Executing decision: ${decisionType} -> ${nextAction}`);

      // Execute the decision based on the LLM's analysis
      switch (nextAction) {
        case 'execute_plan':
          return await switchToMode(sessionId, 'execution') && await persistModeChange(sessionId, 'execution', ctx);

        case 'revise_plan':
        case 'restart_planning':
          return await switchToMode(sessionId, 'planning') && await persistModeChange(sessionId, 'planning', ctx);

        case 'switch_to_execution_mode':
          return await switchToMode(sessionId, 'execution') && await persistModeChange(sessionId, 'execution', ctx);

        case 'switch_to_planning_mode':
          return await switchToMode(sessionId, 'planning') && await persistModeChange(sessionId, 'planning', ctx);

        case 'provide_alternative_approach':
          // Likely stay in planning mode to offer alternatives
          return await switchToMode(sessionId, 'planning') && await persistModeChange(sessionId, 'planning', ctx);

        default:
          console.warn(`[ModeController] Unknown nextAction: ${nextAction}`);
          return false;
      }
    } catch (error) {
      console.error(`[ModeController] Error executing user response decision:`, error);
      return false;
    }
  }

  /**
   * Handle mode switching with state management and persistence (similar to Roo-Code's ClineProvider.handleModeSwitch)
   * SECURITY: Validates context object to prevent user input injection
   */
  export async function handleModeSwitch(sessionId: string, newMode: string, ctx: any): Promise<boolean> {
    try {
      // SECURITY: Validate and sanitize inputs
      if (!sessionId || typeof sessionId !== 'string') {
        console.error(`[ModeController] Invalid sessionId provided`);
        return false;
      }

      if (!newMode || typeof newMode !== 'string') {
        console.error(`[ModeController] Invalid newMode provided`);
        return false;
      }

      // SECURITY: Validate context object has required methods and properties
      if (!ctx || typeof ctx !== 'object') {
        console.error(`[ModeController] Invalid context object provided`);
        return false;
      }

      if (typeof ctx.runMutation !== 'function') {
        console.error(`[ModeController] Context missing runMutation function - potential input injection detected`);
        return false;
      }

      // Sanitize mode name to prevent injection
      const sanitizedMode = newMode.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedMode !== newMode) {
        console.warn(`[ModeController] Mode name contained invalid characters, sanitized: ${newMode} -> ${sanitizedMode}`);
      }

      // Verify the new mode is valid
      if (!ModeRegistry.isValidMode(sanitizedMode)) {
        console.warn(`[ModeController] Invalid mode requested: ${sanitizedMode}`);
        return false;
      }

      // Check if we're already in the requested mode
      const currentMode = getCurrentMode(sessionId);
      if (currentMode === sanitizedMode) {
        console.log(`[ModeController] Already in ${sanitizedMode} mode`);
        return false;
      }

      // Update the session's mode state with the new mode
      const success = switchToMode(sessionId, sanitizedMode);

      if (success) {
        // SECURITY: Use validated context with error boundary
        try {
          await ctx.runMutation(api.chatSessions.updateActiveMode, {
            sessionId: sessionId,
            activeMode: sanitizedMode
          });
          logDebug(`[MODE_SWITCH] Persisted ${sanitizedMode} to DB for ${sessionId}`);
        } catch (dbError) {
          console.error(`[ModeController] Database persistence failed:`, dbError);
          // Mode switch in memory succeeded, but DB persistence failed
          // This is non-critical, so we still return true
        }

        console.log(`[ModeController] Successfully switched from ${currentMode} to ${sanitizedMode} mode`);
        return true;
      } else {
        console.warn(`[ModeController] Failed to switch to ${sanitizedMode} mode`);
        return false;
      }
    } catch (error) {
      console.error(`[ModeController] Error in handleModeSwitch:`, error);
      return false;
    }
  }

  /**
   * Helper function to persist mode changes to database
   * SECURITY: Validates context and sanitizes mode name
   */
  async function persistModeChange(sessionId: string, mode: string, ctx: any): Promise<boolean> {
    try {
      // SECURITY: Validate context object
      if (!ctx || typeof ctx !== 'object' || typeof ctx.runMutation !== 'function') {
        console.error(`[ModeController] Invalid context for persistence`);
        return false;
      }

      // Sanitize mode name
      const sanitizedMode = mode.replace(/[^a-zA-Z0-9_-]/g, '');

      await ctx.runMutation(api.chatSessions.updateActiveMode, {
        sessionId: sessionId,
        activeMode: sanitizedMode
      });

      logDebug(`[MODE_SWITCH] Persisted ${sanitizedMode} to DB for ${sessionId}`);
      return true;
    } catch (dbError) {
      console.error(`[ModeController] Database persistence failed:`, dbError);
      // Mode switch in memory succeeded, but DB persistence failed
      // This is non-critical for the core functionality
      return false;
    }
  }

  /**
   * Get mode configuration for current session mode
   */
  export function getCurrentModeConfig(sessionId: string): any | null {
    const modeName = getCurrentMode(sessionId);
    return ModeRegistry.getMode(modeName);
  }

  /**
   * Check if current mode has permission for a specific tool
   */
  export function hasToolPermission(sessionId: string, toolName: string): boolean {
    const modeName = getCurrentMode(sessionId);
    return ModeRegistry.hasToolPermission(modeName, toolName);
  }

  /**
   * Get tool permissions for current mode
   */
  export function getCurrentModeTools(sessionId: string): Record<string, boolean> {
    const modeName = getCurrentMode(sessionId);
    return ModeRegistry.getModeTools(modeName);
  }

  /**
   * Set context data for the current mode
   */
  export function setModeContext(sessionId: string, key: string, value: any): void {
    let state = sessionStates.get(sessionId);
    if (!state) {
      initializeSession(sessionId);
      state = sessionStates.get(sessionId)!;
    }
    state.context[key] = value;
  }

  /**
   * Get context data for the current mode
   */
  export function getModeContext(sessionId: string, key: string): any {
    const state = sessionStates.get(sessionId);
    return state ? state.context[key] : undefined;
  }

  /**
   * Clear session state (when session ends)
   */
  export function clearSession(sessionId: string): void {
    sessionStates.delete(sessionId);
  }

  /**
   * Get mode history for a session
   */
  export function getModeHistory(sessionId: string): string[] {
    const state = sessionStates.get(sessionId);
    return state ? [...state.modeHistory] : [];
  }

  /**
   * Reset mode to primary
   */
  export function resetToPrimary(sessionId: string): boolean {
    return switchToMode(sessionId, "primary");
  }

  /**
   * Automatically determine and switch to the appropriate mode based on task type
   */
  export function switchToModeForTask(sessionId: string, taskType: string): boolean {
    const modeName = ModeRegistry.getModeForTask(taskType);
    return switchToMode(sessionId, modeName);
  }

  /**
   * Get workflow sequence for a task type and switch to the first mode in the sequence
   */
  export function startWorkflowForTask(sessionId: string, taskType: string): string[] {
    const sequence = ModeRegistry.getWorkflowSequence(taskType);
    if (sequence.length > 0) {
      switchToMode(sessionId, sequence[0]);
    }
    return sequence;
  }
}