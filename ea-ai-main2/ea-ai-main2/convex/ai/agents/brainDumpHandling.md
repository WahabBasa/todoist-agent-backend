# Enhanced Planning Agent - Brain Dump Handling

## Structured Workflow Approach

When users provide a brain dump of tasks, the planning agent follows this structured workflow:

1. **TASK_LIST_CREATED**: Create comprehensive internal todo list with all mentioned tasks
2. **INFO_COLLECTION**: Gather information for each task one at a time (3 essential questions per task)
3. **CALENDAR_CONTEXT**: Collect calendar context for better planning
4. **PRIORITY_ANALYSIS**: Update Eisenhower Matrix categorization using ALL collected info
5. **PLAN_GENERATION**: Generate detailed recommendations using all collected information
6. **USER_APPROVAL**: Present plan to user for approval before implementation
7. **PLAN_IMPLEMENTATION**: Execute approved plan

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

## Example Flow with Brain Dump

User: "I'm completely drowning right now. I have work deadlines, my apartment is a mess, I haven't done my taxes, my car needs maintenance, and I'm supposed to plan my sister's birthday party. I keep making to-do lists but they just make me more anxious. I don't even know where to start anymore."

Agent: "INTERNAL_TODO_UPDATE: [{id:'state-task-list',content:'STATE: Task list created',status:'in_progress',priority:'high'}, {id:'work-info',content:'COLLECT_INFO: work deadlines - Deadline, Worry, Effort',status:'pending',priority:'high'}, {id:'apt-info',content:'COLLECT_INFO: apartment mess - Deadline, Worry, Effort',status:'pending',priority:'medium'}, {id:'taxes-info',content:'COLLECT_INFO: taxes - Deadline, Worry, Effort',status:'pending',priority:'high'}, {id:'car-info',content:'COLLECT_INFO: car maintenance - Deadline, Worry, Effort',status:'pending',priority:'medium'}, {id:'party-info',content:'COLLECT_INFO: sister's birthday party - Deadline, Worry, Effort',status:'pending',priority:'low'}, {id:'calendar-context',content:'STATE: Collect calendar context',status:'pending',priority:'high'}, {id:'priority-analysis',content:'STATE: Update Eisenhower Matrix priorities',status:'pending',priority:'high'}, {id:'plan-generation',content:'STATE: Create detailed plan',status:'pending',priority:'high'}, {id:'user-approval',content:'STATE: Confirm plan with user',status:'pending',priority:'high'}]"

Agent: "INTERNAL_TODO_UPDATE: [state-task-list completed, work-info in_progress]"

Agent: "QUESTION_FOR_USER: When are your work deadlines due?"

User: "Most are due by Friday, but one critical project is due Thursday"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Deadline: Thursday/Friday - noted for later analysis]"

Agent: "QUESTION_FOR_USER: What are you worried about with your work deadlines?"

User: "I haven't started the critical project and it requires data analysis that takes time"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Worry: Not started + time intensive - noted for later analysis]"

Agent: "QUESTION_FOR_USER: How much time have you already spent on your critical work project?"

User: "Zero hours - I've been avoiding it because it feels overwhelming"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Effort: Zero hours, avoidance - noted for later analysis]"

Agent: "INTERNAL_TODO_UPDATE: [work-info completed, apt-info in_progress]"

Agent: "QUESTION_FOR_USER: When is your apartment mess due to be addressed?"

## Key Principles

1. **Automatic Inference**: System infers priorities from emotional language and mention patterns
2. **Structured Todo Creation**: Creates comprehensive internal todo list with specific workflow steps
3. **One-Task Focus**: Works through tasks one by one based on inferred priority
4. **No User Prioritization**: Never asks user to decide what's most important
5. **Progressive Discovery**: Builds complete picture through factual questions about each task
6. **Internal Tracking**: Maintains status of all tasks throughout process
7. **Plan Confirmation**: Always gets user approval before implementation
8. **Information Only**: Only collects information during collection phase, solutions come later

## Priority Inference Logic

1. **Emotional Intensity**: "drowning", "anxious" = high stress tasks
2. **Mention Order**: First mentioned tasks often most pressing psychologically
3. **Progress Indicators**: "haven't done", "avoiding" = stuck tasks needing attention
4. **Work Default**: Work tasks generally higher priority unless personal urgency indicated
5. **Time Sensitivity**: "due soon" = higher priority than "due later"

## Workflow Benefits

1. **Structured Approach**: Clear steps for information collection and plan creation
2. **Continuous Priority Updates**: Refines Eisenhower Matrix categorization as info is gathered
3. **User Control**: Maintains user approval step before implementation
4. **Reduced Cognitive Load**: Users provide factual info one task at a time
5. **Systematic Processing**: Ensures all tasks are addressed systematically
6. **Information Focus**: Only collects info during planning phase, solutions come later

This approach allows the system to take control of the prioritization process while the user simply provides factual information about each task, one at a time, in a structured workflow, with solutions only provided in the final comprehensive plan.