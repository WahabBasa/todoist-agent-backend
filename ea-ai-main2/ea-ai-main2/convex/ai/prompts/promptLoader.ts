/**
 * Universal Prompt Loading System
 * Eliminates all hardcoded prompts by providing a unified file-based loading system
 */

// Import all prompt files
import { prompt as zenNewPrompt } from "./zen_new";
import { prompt as planningPrompt } from "./planning_new";
import { prompt as executionPrompt } from "./execution_new";
import { prompt as internalTodoEnhancedPrompt } from "./internalTodoEnhanced";
import { prompt as generalPrompt } from "./general";

// Prompt registry mapping names to content
const PROMPT_REGISTRY: Record<string, string> = {
  "zen_new": zenNewPrompt,
  "zen": zenNewPrompt, // Alias for backward compatibility
  "planning_new": planningPrompt,
  "execution_new": executionPrompt,
  "internalTodoEnhanced": internalTodoEnhancedPrompt,
  "general": generalPrompt,
};

// Prompt metadata for validation and debugging
interface PromptMetadata {
  name: string;
  description: string;
  loaded: boolean;
  contentLength: number;
  lastModified?: string;
}

/**
 * Universal Prompt Loader Class
 * Single source of truth for all prompt content
 */
export class PromptLoader {
  /**
   * Load prompt content by name (synchronous)
   * @param promptName - Name of the prompt to load
   * @returns Prompt content string
   * @throws Error if prompt not found
   */
  static loadPrompt(promptName: string): string {
    const content = PROMPT_REGISTRY[promptName];
    
    if (!content) {
      const availablePrompts = Object.keys(PROMPT_REGISTRY).join(", ");
      throw new Error(`Prompt '${promptName}' not found. Available prompts: ${availablePrompts}`);
    }
    
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error(`Prompt '${promptName}' is empty or invalid`);
    }
    
    return content;
  }

  /**
   * Load prompt content by name (asynchronous for future compatibility)
   * @param promptName - Name of the prompt to load
   * @returns Promise resolving to prompt content string
   */
  static async loadPromptAsync(promptName: string): Promise<string> {
    return this.loadPrompt(promptName);
  }

  /**
   * Get all available prompt names
   * @returns Array of prompt names
   */
  static getAllPromptNames(): string[] {
    return Object.keys(PROMPT_REGISTRY);
  }

  /**
   * Validate that a prompt exists and is loadable
   * @param promptName - Name of the prompt to validate
   * @returns True if prompt exists and is valid
   */
  static validatePromptExists(promptName: string): boolean {
    try {
      const content = this.loadPrompt(promptName);
      return content.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata about all loaded prompts
   * @returns Array of prompt metadata
   */
  static getPromptMetadata(): PromptMetadata[] {
    return Object.entries(PROMPT_REGISTRY).map(([name, content]) => ({
      name,
      description: this.extractPromptDescription(content),
      loaded: true,
      contentLength: content.length,
      lastModified: new Date().toISOString(), // Could be enhanced with actual file timestamps
    }));
  }

  /**
   * Get metadata for a specific prompt
   * @param promptName - Name of the prompt
   * @returns Prompt metadata or null if not found
   */
  static getPromptInfo(promptName: string): PromptMetadata | null {
    if (!this.validatePromptExists(promptName)) {
      return null;
    }

    const content = PROMPT_REGISTRY[promptName];
    return {
      name: promptName,
      description: this.extractPromptDescription(content),
      loaded: true,
      contentLength: content.length,
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Extract description from prompt content (first line of task_context if available)
   * @param content - Prompt content
   * @returns Extracted description or default
   */
  private static extractPromptDescription(content: string): string {
    // Try to extract from <task_context> section
    const taskContextMatch = content.match(/<task_context>\s*([^\n<]+)/);
    if (taskContextMatch) {
      return taskContextMatch[1].trim();
    }

    // Try to extract from <critical_role_definition> section
    const roleDefMatch = content.match(/<critical_role_definition>\s*([^\n<]+)/);
    if (roleDefMatch) {
      return roleDefMatch[1].trim();
    }

    // Fallback to first meaningful line
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines.length > 0 ? lines[0].substring(0, 100) + '...' : 'No description available';
  }

  /**
   * Validate all prompts in registry
   * @returns Object with validation results
   */
  static validateAllPrompts(): { valid: string[], invalid: string[], errors: Record<string, string> } {
    const valid: string[] = [];
    const invalid: string[] = [];
    const errors: Record<string, string> = {};

    for (const promptName of this.getAllPromptNames()) {
      try {
        const content = this.loadPrompt(promptName);
        if (content.length > 10) { // Minimum content length check
          valid.push(promptName);
        } else {
          invalid.push(promptName);
          errors[promptName] = 'Prompt content too short';
        }
      } catch (error) {
        invalid.push(promptName);
        errors[promptName] = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return { valid, invalid, errors };
  }
}

/**
 * Legacy compatibility function - maintains existing API
 * @param promptName - Name of the prompt to load
 * @returns Prompt content string
 * @deprecated Use PromptLoader.loadPrompt() instead
 */
export function getPrompt(promptName: string): string {
  return PromptLoader.loadPrompt(promptName);
}

/**
 * Type-safe prompt name enum for better development experience
 */
export const PROMPT_NAMES = {
  ZEN_NEW: "zen_new" as const,
  ZEN: "zen" as const,
  PLANNING_NEW: "planning_new" as const,
  EXECUTION_NEW: "execution_new" as const,
  INTERNAL_TODO_ENHANCED: "internalTodoEnhanced" as const,
  GENERAL: "general" as const,
} as const;

export type PromptName = typeof PROMPT_NAMES[keyof typeof PROMPT_NAMES];

// Export the registry for debugging purposes (read-only)
export const getPromptRegistry = (): Readonly<Record<string, string>> => ({
  ...PROMPT_REGISTRY,
});