# Enhanced Planning Agent - Improved Implementation

## Structured Workflow Approach

The planning agent now follows a structured workflow with specific internal todo items:

1. **TASK_LIST_CREATED**: Create comprehensive task list from user input
2. **INFO_COLLECTION**: Gather 3 essential details for each task (one at a time)
3. **CALENDAR_CONTEXT**: Collect calendar context for better planning
4. **PRIORITY_ANALYSIS**: Update Eisenhower Matrix categorization using ALL collected info
5. **PLAN_GENERATION**: Generate recommendations using all collected information
6. **USER_APPROVAL**: Get user approval before proceeding

## Critical Principle: Information Collection Only
During the information collection phase, the agent MUST ONLY:
✅ Collect factual information about each task
✅ Ask the 3 essential questions for each task
✅ Note information for later analysis
✅ Move systematically through all tasks

The agent MUST NEVER:
❌ Provide solutions or recommendations for individual tasks
❌ Give advice on how to handle specific items
❌ Dive deep into solving one item before collecting info for all items
❌ Suggest actions for individual tasks during info collection

## Better Example Flow

User: "I have taxes, work deadlines, car maintenance, apartment organization, and sister's birthday party planning"

Agent: "INTERNAL_TODO_UPDATE: [{id:'state-task-list',content:'STATE: Task list created',status:'in_progress',priority:'high'}, {id:'taxes-info',content:'COLLECT_INFO: taxes - Deadline, Worry, Effort',status:'pending',priority:'high'}, {id:'work-info',content:'COLLECT_INFO: work deadlines - Deadline, Worry, Effort',status:'pending',priority:'high'}, ...]"

Agent: "INTERNAL_TODO_UPDATE: [state-task-list completed, taxes-info in_progress]"

Agent: "QUESTION_FOR_USER: When do your taxes need to be completed?"

User: "April 15th"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Deadline: April 15th - noted for later analysis]"

User: "What should I do about my taxes?"

Agent: "INTERNAL_TODO_UPDATE: [taxes-info in_progress - collecting remaining info]"
Agent: "QUESTION_FOR_USER: What are you worried about with your taxes?"

User: "I could face penalties and interest charges"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Worry: Penalties and interest - noted for later analysis]"

Agent: "QUESTION_FOR_USER: Who depends on your taxes being completed?"

User: "Just me, but I might need to hire an accountant"

Agent: "INTERNAL_TODO_UPDATE: [taxes - External involvement: Potential accountant - noted for later analysis]"

Agent: "QUESTION_FOR_USER: How much time have you already spent on your taxes?"

User: "At least 8 hours of focused work"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Effort: 8+ hours needed - noted for later analysis]"

Agent: "QUESTION_FOR_USER: How does the taxes task make you feel on a scale from can't sleep to peaceful?"

User: "Can't sleep - I think about it every day"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Mental attention: Daily, sleep disruption - noted for later analysis]"

Agent: "INTERNAL_TODO_UPDATE: [taxes-info completed, work-info in_progress]"

Agent: "QUESTION_FOR_USER: When are your work deadlines due?"

## Key Improvements

1. **Structured Workflow**: Clear steps for information collection and plan creation
2. **One Task Focus**: Always focus on one specific task completely before moving to the next
3. **Specific Questions**: Ask concrete questions about deadlines, consequences, dependencies, effort, and emotional impact
4. **Progressive Discovery**: Build a complete picture by asking different types of questions about the same task
5. **Automatic Categorization**: Continuously update priority assessment based on responses
6. **No User Processing**: Never ask users to compare or choose between multiple tasks
7. **Plan Confirmation**: Always get user approval before implementation
8. **Information Only**: Only collect information during collection phase, solutions come later

## Question Types

1. **Deadline**: "When does [task] need to be completed?"
2. **Consequence**: "What happens if [task] doesn't get done?"
3. **Dependency**: "Does [task] depend on anyone else?" or "Who depends on [task] being completed?"
4. **Effort**: "How much time do you think [task] will take?"
5. **Stress**: "How does [task] make you feel on a scale from can't sleep to peaceful?"
6. **Importance**: "Who or what will be most affected if [task] doesn't get done?"

## Structured Todo List Benefits

The new structured internal todo list approach provides:

1. **Clear Workflow**: Specific steps for information collection and plan creation
2. **Progress Tracking**: Easy to see which task is being processed
3. **Priority Updates**: Continuous refinement of Eisenhower Matrix categorization
4. **User Approval**: Explicit confirmation step before implementation
5. **Systematic Processing**: Ensures all tasks are addressed completely
6. **Information Focus**: Only collects info during planning phase, solutions come later

## Final Plan Generation
Only after collecting information for ALL tasks does the agent generate a comprehensive plan using the Eisenhower Matrix:

RECOMMENDATIONS_READY: Yes
1. Prioritize taxes as your most urgent task with immediate action needed
2. Schedule 2-hour focused work sessions for taxes this week
3. Consider hiring an accountant if you haven't started by tomorrow
Context used: Taxes have legal deadline April 15th, user is behind schedule, avoiding task, and thinking about it several times daily

This approach ensures we surface all important details without requiring the user to do any comparative analysis or prioritization themselves, while maintaining a structured workflow that collects information one task at a time and only provides solutions in the final comprehensive plan.