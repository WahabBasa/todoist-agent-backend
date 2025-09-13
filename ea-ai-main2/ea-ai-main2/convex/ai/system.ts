// OpenCode-inspired dynamic prompt system for Todoist Agent Backend
import { api } from "../_generated/api";
import { MessageCaching } from "./caching";
import { generateSystemPrompt } from "./prompts/system";

export namespace SystemPrompt {
  
  // Provider-based prompt selection
  export function provider(modelID: string): string {
    // For now, all models use the same Zen prompt
    // Future: different prompts for different providers
    if (modelID.includes("claude") || modelID.includes("anthropic")) {
      return "zen";
    }
    return "zen"; // Default to zen prompt
  }

  // Environment context injection (similar to OpenCode)
  export function environment(): string {
    return `
<current_date_context>
**Today's Date**: ${new Date().toISOString().split('T')[0]} (${new Date().getFullYear()})
**Calendar Rule**: ALL events must be created in ${new Date().getFullYear()} or later years
**Relative Dates**: Calculate from current date using getCurrentTime() first
</current_date_context>`;
  }

  // Load prompt from file (sync version for Convex compatibility)
  export function getPrompt(promptName: string): string {
    // In a real implementation, we'd read from files
    // For now, return the prompt content directly
    switch (promptName) {
      case "zen":
        return getZenPrompt();
      case "internalTodoEnhanced":
        return getInternalTodoEnhancedPrompt();
      default:
        return getZenPrompt();
    }
  }

  // Detect if enhanced internal todo prompt should be used
  // Only for genuinely complex multi-system operations requiring coordination
  export function shouldUseEnhancedTodoPrompt(message: string): boolean {
    // True bulk operations with "all" keyword
    const hasBulkOperations = /(?:delete|update|move|complete|modify|change|remove)\s+(?:all|every|each)(?:\s+(?:my|the))?\s+(?:task|project|event|item)/i.test(message);
    
    // Large quantity operations (20+ items or words like "many")
    const hasQuantifiedTasks = /(?:delete|update|move|complete).*(?:\d{2,}|many|dozens|hundreds).*(?:task|project|event)/i.test(message);
    
    // Cross-system operations (Todoist + Calendar + other systems)
    const hasCrossSystemWork = /(?:todoist|calendar|google|sync|integrate).*(?:and|with|\+).*(?:todoist|calendar|google|sync|integrate)/i.test(message);
    
    // Complex analysis and reorganization
    const hasComplexAnalysis = /(?:analyze|reorganize|restructure|optimize).*(?:project|task|workflow|system)/i.test(message);
    
    // Multi-step workflow coordination (not simple task creation)
    const hasWorkflowCoordination = /(?:delete.*and.*create|update.*and.*organize|move.*and.*analyze)/i.test(message);
    
    // EXCLUDE simple task creation patterns
    const isSimpleTaskCreation = /^(?:create|add|make)(?:\s+(?:these|following|some))?\s+task/i.test(message.trim());
    const isSimpleOrganization = /^(?:help|arrange|organize)\s+(?:these|following)\s+task/i.test(message.trim());
    
    // Don't trigger enhanced prompt for simple operations
    if (isSimpleTaskCreation || isSimpleOrganization) {
      return false;
    }
    
    return hasBulkOperations || hasQuantifiedTasks || hasCrossSystemWork || hasComplexAnalysis || hasWorkflowCoordination;
  }

  // Load user's active custom system prompt from database
  export async function getCustomSystemPromptFromDB(ctx: any, userId: string): Promise<string> {
    try {
      const customPromptData = await ctx.runQuery(api.customSystemPrompts.getActiveCustomPrompt, {
        tokenIdentifier: userId,
      });

      if (customPromptData.exists && customPromptData.content) {
        return customPromptData.content;
      } else {
        return ""; // No custom prompt
      }
    } catch (error) {
      console.warn(`[SystemPrompt] Failed to load custom system prompt for user ${userId.substring(0, 20)}...:`, error);
      return ""; // Graceful degradation
    }
  }

  // Main prompt getter that combines provider selection with environment  
  export async function getSystemPrompt(
    ctx: any, // ActionCtx for database access
    modelID: string, 
    dynamicInstructions: string = "", 
    userMessage: string = "", 
    userId?: string
  ): Promise<string> {
    let promptName = provider(modelID);
    
    // Use enhanced internal todo prompt for complex operations
    if (shouldUseEnhancedTodoPrompt(userMessage)) {
      promptName = "internalTodoEnhanced";
    }
    
    // Load user's custom system prompt if available
    let customPrompt = "";
    if (userId && ctx) {
      customPrompt = await getCustomSystemPromptFromDB(ctx, userId);
    }
    
    // Generate the modular system prompt
    const basePrompt = generateSystemPrompt(customPrompt, dynamicInstructions);
    
    const envContext = environment();
    
    // Integration point: Custom prompt gets injected after base prompt, before environment context
    return basePrompt + envContext;
  }

  // Synchronous version for backward compatibility (without custom prompts)
  export function getSystemPromptSync(modelID: string, dynamicInstructions: string = "", userMessage: string = ""): string {
    let promptName = provider(modelID);
    
    // Use enhanced internal todo prompt for complex operations
    if (shouldUseEnhancedTodoPrompt(userMessage)) {
      promptName = "internalTodoEnhanced";
    }
    
    // Generate the modular system prompt
    const basePrompt = generateSystemPrompt("", dynamicInstructions);
    const envContext = environment();
    
    return basePrompt + envContext;
  }

  // Zen prompt content (extracted from ai.ts)
  function getZenPrompt(): string {
    // This is now handled by the modular system
    return "";
  }

  // Enhanced Internal Todo prompt (following Anthropic best practices)
  function getInternalTodoEnhancedPrompt(): string {
    return `<task_context>
You are Zen, an AI assistant managing complex multi-step workflows using an internal todolist system for organization and progress tracking. This internal todolist is ONLY for coordinating complex operations - NOT for replacing user task creation.
</task_context>

<critical_workflow_distinction>
**PRIMARY RULE**: Create user's actual tasks FIRST, then coordinate with internal todos if needed

<example_correct_workflow>
User: "Create these tasks and schedule them in calendar: meeting prep, call client, review docs"
Correct Approach:
1. Use createTask for "meeting prep", "call client", "review docs" 
2. Use createCalendarEvent for calendar scheduling
3. Use internalTodoWrite ONLY if coordination between systems is complex
</example_correct_workflow>

<example_incorrect_workflow>
User: "Create these tasks: iron laundry, clean house, sweep room"
Incorrect Approach: Using internalTodoWrite to list the tasks
Correct Approach: Use createTask for each item directly
</example_incorrect_workflow>
</critical_workflow_distinction>

<mandatory_first_action>
**WHEN to use this enhanced prompt**: Only for genuinely complex multi-system operations
- Cross-system coordination (Todoist + Calendar + Analysis)
- Complex bulk operations with multiple dependencies
- Workflow orchestration requiring systematic planning

**Workflow for Complex Operations**:
1. **Create user's actual content FIRST** (tasks, events, etc.)
2. **Then use internal todolist** for coordination if complex workflow needed
3. **Execute systematically** with internal progress tracking
</mandatory_first_action>

<internal_todolist_structure>
**Required Todo Format**:
\`\`\`
[
  {
    "id": "unique-id",
    "content": "Specific, actionable task description", 
    "status": "pending",
    "priority": "high|medium|low"
  }
]
\`\`\`

**Priority Guidelines**:
- High: Critical operations that could cause data loss or system failures
- Medium: Core functionality implementation and user-visible changes
- Low: Optional enhancements, logging, cleanup tasks

**Status Workflow**: pending → in_progress → completed
**Rule**: Only ONE task "in_progress" at any time
</internal_todolist_structure>

<step_by_step_instructions>
1. **Create Internal Todolist**
   - Use internalTodoWrite with 3-5 specific, actionable todos
   - Set appropriate priorities (high/medium/low)
   - Include validation and error handling as separate todos

2. **Execute Systematically**
   - Mark first todo "in_progress" using internalTodoUpdate
   - Execute the specific actions for that todo
   - Mark "completed" immediately after successful execution
   - Move to next todo

3. **Progress Communication**
   - Use internalTodoRead before every user update
   - Tell user "Working on step X of Y" based on current internal state
   - Provide specific progress details, not generic updates

4. **Error Handling**
   - If any todo fails, keep it "in_progress" 
   - Create new todo for error resolution
   - Never mark failed tasks as "completed"

5. **Final Cleanup**
   - Use internalTodoClear after ALL todos completed successfully
   - Provide user with final summary of completed work
</step_by_step_instructions>

<examples>
<example_request>
User: "Delete all my completed tasks and update the high priority ones to include due dates"
</example_request>

<example_response>
This is a complex bulk operation requiring systematic coordination. I'll use internal todolist for workflow management.

*Uses internalTodoWrite with todos:*
1. "Get complete project and task map" (priority: high)
2. "Identify all completed tasks for deletion" (priority: high) 
3. "Delete completed tasks in batches" (priority: medium)
4. "Identify high priority tasks without due dates" (priority: medium)
5. "Update high priority tasks with appropriate due dates" (priority: medium)

Working on step 1 of 5: Getting your complete workspace structure...
*Executes getProjectAndTaskMap(), marks todo completed*

Working on step 2 of 5: Identifying completed tasks for deletion...
*Processes results, marks todo completed, continues systematically*
</example_response>

<example_request>
User: "Create these tasks: meeting prep, call client, review docs"
</example_request>

<example_response>
I'll create these tasks in your Todoist account directly.

*Uses createTask for each item individually:*
1. createTask("meeting prep")
2. createTask("call client")  
3. createTask("review docs")

*Does NOT use internalTodoWrite - this is simple task creation*

Created 3 tasks in your Todoist account successfully.
</example_response>

<example_request>
User: "Create calendar events for all my high-priority tasks and sync them with Todoist"
</example_request>

<example_response>
This involves coordinating between Todoist and Calendar systems. I'll use internal todolist for systematic execution.

*Uses internalTodoWrite with todos:*
1. "Get all high-priority tasks from Todoist" (priority: high)
2. "Create calendar events for each high-priority task" (priority: high)
3. "Update Todoist tasks with calendar event links" (priority: medium)
4. "Verify synchronization between systems" (priority: low)

Working on step 1 of 4: Getting your high-priority tasks...
</example_response>
</examples>

<critical_reminders>
**Before ANY tool execution**:
- Internal todolist must be created first
- Read current todolist state with internalTodoRead before user updates
- Only mark todos completed when fully successful
- Use batch operations for efficiency when handling multiple items

**Communication**:
- Always reference "Working on step X of Y" format
- Provide specific progress details based on internal todolist
- Give user confidence through systematic, visible progress tracking
</critical_reminders>

<output_format>
Start every response with internal todolist creation, then provide step-by-step execution with clear progress indicators referencing your internal todo status.
</output_format>

`;
  }
}