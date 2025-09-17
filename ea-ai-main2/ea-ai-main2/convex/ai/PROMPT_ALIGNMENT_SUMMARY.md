# Prompt Alignment Summary

## Core Principle Across All Prompts
**Information Collection Only During Planning Phase**
- ONLY collect factual information about each task
- NEVER provide solutions or recommendations for individual tasks during collection
- NEVER dive deep into solving one item before collecting info for all items
- Solutions and recommendations come ONLY in the final comprehensive plan

## Unified Workflow States
All prompts now reference the same 7-state workflow:
1. **TASK_LIST_CREATED**: Initial task list created from user input
2. **INFO_COLLECTION**: Gathering information for each task (one at a time)
3. **CALENDAR_CONTEXT**: Collecting calendar context for better planning
4. **PRIORITY_ANALYSIS**: Updating Eisenhower Matrix categorization using ALL collected info
5. **PLAN_GENERATION**: Creating detailed recommendations using all collected info
6. **USER_APPROVAL**: Getting explicit confirmation before implementation
7. **PLAN_IMPLEMENTATION**: Executing the approved plan

## Consistent Information Collection Process
For each task, collect ONLY these 3 essential details:
1. **Deadline**: "When is [task] due?"
2. **Urgency/Worry**: "What are you worried about with [task]?"
3. **Effort**: "How much time have you already spent on [task]?"

## Prohibited Behaviors (Consistent Across All Prompts)
❌ Provide solutions or recommendations for individual tasks during info collection
❌ Give advice on how to handle specific items during info collection
❌ Dive deep into solving one item before collecting info for all items
❌ Suggest actions for individual tasks during info collection
❌ Ask "What should you do about [task]?"
❌ Ask "How can I help you solve [task]?"

## Approved Behaviors (Consistent Across All Prompts)
✅ Collect factual information about each task
✅ Ask the 3 essential questions for each task
✅ Note information for later analysis
✅ Move systematically through all tasks
✅ Use internalTodoWrite to track state machine progress
✅ Generate comprehensive plan only after collecting ALL information

## Files Updated for Alignment
1. **planning_new.ts** - Main planning prompt with state machine workflow
2. **unifiedAgentApproach.md** - Documentation of unified approach
3. **brainDumpHandling.md** - Structured workflow for brain dumps
4. **directQuestionApproach.md** - Direct question methodology
5. **enhancedPlanningExample.md** - Example implementation
6. **internal.ts** - Internal todo tools with state machine support

## Key Benefits Achieved Through Alignment
1. **Consistent User Experience**: Same principles across all agent interactions
2. **Reduced Cognitive Load**: Users provide factual info one task at a time
3. **Automatic Prioritization**: System infers priorities using Eisenhower Matrix
4. **Structured Workflow**: Clear state transitions and progress tracking
5. **User Control**: Explicit approval step before implementation
6. **Systematic Processing**: Ensures all tasks are addressed completely
7. **Information Focus**: Only collects info during planning phase, solutions come later

## Example Consistent Flow
1. User provides brain dump of tasks
2. System creates state machine todo list
3. Collect information for each task one at a time (3 questions per task)
4. Collect calendar context for better planning
5. Update Eisenhower Matrix priorities using ALL collected information
6. Generate detailed plan using all collected information
7. Present plan to user for approval
8. Execute approved plan

This alignment ensures all components of the system work together consistently with the same principles and workflow.