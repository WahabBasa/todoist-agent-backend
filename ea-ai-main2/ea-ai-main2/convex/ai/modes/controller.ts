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
   * Handle mode switching with state management and persistence (similar to Roo-Code's ClineProvider.handleModeSwitch)
   */
  export async function handleModeSwitch(sessionId: string, newMode: string, ctx: any): Promise<boolean> {
    try {
      // Verify the new mode is valid
      if (!ModeRegistry.isValidMode(newMode)) {
        console.warn(`[ModeController] Invalid mode requested: ${newMode}`);
        return false;
      }
  
      // Check if we're already in the requested mode
      const currentMode = getCurrentMode(sessionId);
      if (currentMode === newMode) {
        console.log(`[ModeController] Already in ${newMode} mode`);
        return false;
      }
  
      // Update the session's mode state with the new mode
      const success = switchToMode(sessionId, newMode);
      
      if (success) {
        // Persist to DB
        await ctx.runMutation(api.chatSessions.updateActiveMode, { sessionId, activeMode: newMode });
        logDebug(`[MODE_SWITCH] Persisted ${newMode} to DB for ${sessionId}`);
        
        console.log(`[ModeController] Successfully switched from ${currentMode} to ${newMode} mode`);
        return true;
      } else {
        console.warn(`[ModeController] Failed to switch to ${newMode} mode`);
        return false;
      }
    } catch (error) {
      console.error(`[ModeController] Error in handleModeSwitch:`, error);
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