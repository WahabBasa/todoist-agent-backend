# Enhanced Planning Agent - Direct Question Approach

## Structured Information Collection

The planning agent now follows a structured workflow for information collection:

1. **TASK_LIST_CREATED**: Create comprehensive internal todo list with all mentioned tasks
2. **INFO_COLLECTION**: Gather information for each task one at a time (3 essential questions per task)
3. **CALENDAR_CONTEXT**: Collect calendar context for better planning
4. **PRIORITY_ANALYSIS**: Update Eisenhower Matrix categorization using ALL collected info
5. **PLAN_GENERATION**: Generate detailed recommendations using all collected information
6. **USER_APPROVAL**: Present plan to user for approval before implementation

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

Agent: "QUESTION_FOR_USER: When are your taxes due?"

User: "April 15th"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Deadline: April 15th - noted for later analysis]"

User: "What should I do about my taxes?"

Agent: "INTERNAL_TODO_UPDATE: [taxes-info in_progress - collecting remaining info]"
Agent: "QUESTION_FOR_USER: What are you worried about with your taxes?"

User: "I haven't started and it's already March"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Worry: Not started - noted for later analysis]"

Agent: "QUESTION_FOR_USER: Who else is involved with your taxes?"

User: "Just me, but I might need to hire an accountant"

Agent: "INTERNAL_TODO_UPDATE: [taxes - External involvement: Potential accountant - noted for later analysis]"

Agent: "QUESTION_FOR_USER: How much time have you already spent on your taxes?"

User: "Zero hours - I've been avoiding it"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Effort: Zero hours, avoidance - noted for later analysis]"

Agent: "QUESTION_FOR_USER: How often do you think about your taxes?"

User: "Several times a day, especially when I try to sleep"

Agent: "INTERNAL_TODO_UPDATE: [taxes - Mental attention: Several times daily - noted for later analysis]"

Agent: "INTERNAL_TODO_UPDATE: [taxes-info completed, work-info in_progress]"

Agent: "QUESTION_FOR_USER: When are your work deadlines due?"

## Key Principles

1. **Direct Questions Only**: Ask concrete questions about facts, not hypotheticals
2. **One Task Focus**: Always work on one specific task at a time completely
3. **Fact Discovery**: Surface what the user already knows unconsciously
4. **Progressive Understanding**: Build complete picture through multiple factual questions
5. **Automatic Prioritization**: Let the system categorize based on responses, not user judgment
6. **Structured Workflow**: Follow clear steps for information collection and plan creation
7. **Information Only**: Only collect information during collection phase, solutions come later

## Approved Question Types

1. **Deadlines**: "When is [task] due?"
2. **Worries**: "What are you worried about with [task]?"
3. **Time Investment**: "How much time have you already spent on [task]?"
4. **External Involvement**: "Who else is involved with [task]?"
5. **Mental Attention**: "How often do you think about [task]?"
6. **Current Status**: "What's the current status of [task]?"
7. **Avoidance Patterns**: "Have you started working on [task]?"

## Questions to Avoid (Hypotheticals)

❌ "What should you do about [task]?"
❌ "How can I help you solve [task]?"
❌ "What's the best approach for [task]?"
❌ "What happens if [task] doesn't get done?" (Makes user think about consequences)
❌ "How much time do you think [task] will take?" (Requires estimation)
❌ "How does [task] make you feel?" (Abstract emotional processing)
❌ "What if [scenario]?" (Hypothetical thinking)

## Structured Todo List Benefits

The new structured internal todo list approach provides:

1. **Clear Workflow**: Specific steps for information collection and plan creation
2. **Progress Tracking**: Easy to see which task is being processed
3. **Priority Updates**: Continuous refinement of Eisenhower Matrix categorization
4. **User Approval**: Explicit confirmation step before implementation
5. **Systematic Processing**: Ensures all tasks are addressed completely
6. **Information Focus**: Only collects info during planning phase, solutions come later

This approach surfaces unconscious priorities by asking about what's already true, not what might be true, while maintaining a structured workflow that collects information one task at a time and only provides solutions in the final comprehensive plan.