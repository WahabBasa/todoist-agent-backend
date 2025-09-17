# Enhanced Planning Agent - Brain Dump Handling

## Example Flow with Brain Dump

User: "I'm completely drowning right now. I have work deadlines, my apartment is a mess, I haven't done my taxes, my car needs maintenance, and I'm supposed to plan my sister's birthday party. I keep making to-do lists but they just make me more anxious. I don't even know where to start anymore."

Agent: "INTERNAL_TODO_UPDATE: [{id:'work',content:'work deadlines',status:'pending',priority:'high'}, {id:'apt',content:'apartment mess',status:'pending',priority:'medium'}, {id:'taxes',content:'taxes',status:'pending',priority:'high'}, {id:'car',content:'car maintenance',status:'pending',priority:'medium'}, {id:'party',content:'sister's birthday party',status:'pending',priority:'low'}]"

Agent: "INTERNAL_TODO_UPDATE: [Inferred work deadlines as most pressing due to 'drowning' tone and mention order]"

Agent: "QUESTION_FOR_USER: When are your work deadlines due?"

User: "Most are due by Friday, but one critical project is due Thursday"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Q1 (Do First) - Critical project due Thursday - High Priority - Stress: Very High]"

Agent: "QUESTION_FOR_USER: What are you worried about with your work deadlines?"

User: "I haven't started the critical project and it requires data analysis that takes time"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Q1 (Do First) - Not started + time intensive - High Priority - Progress: 0%]"

Agent: "QUESTION_FOR_USER: How much time have you already spent on your critical work project?"

User: "Zero hours - I've been avoiding it because it feels overwhelming"

Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Q1 (Do First) - Avoidance pattern + overwhelming feeling - High Priority - Stress: Maximum]"

Agent: "RECOMMENDATIONS_READY: Yes
1. Focus on work deadlines first, especially critical project due Thursday
2. Schedule 2-hour focused work session for critical project today
3. Break down data analysis into smaller steps to reduce overwhelm
Context used: User is drowning with multiple tasks, work deadlines are most urgent with critical project due Thursday, user hasn't started and feels overwhelmed"

Agent: "INTERNAL_TODO_UPDATE: [{id:'work',content:'work deadlines',status:'in_progress',priority:'high'}, {id:'apt',content:'apartment mess',status:'pending',priority:'medium'}, {id:'taxes',content:'taxes',status:'pending',priority:'high'}, {id:'car',content:'car maintenance',status:'pending',priority:'medium'}, {id:'party',content:'sister's birthday party',status:'pending',priority:'low'}]"

Agent: "QUESTION_FOR_USER: When are your taxes due?"

## Key Principles

1. **Automatic Inference**: System infers priorities from emotional language and mention patterns
2. **Immediate Todo Creation**: Creates internal todo list from brain dump immediately
3. **Systematic Progression**: Works through tasks one by one based on inferred priority
4. **No User Prioritization**: Never asks user to decide what's most important
5. **Progressive Discovery**: Builds complete picture through factual questions about each task
6. **Internal Tracking**: Maintains status of all tasks throughout process

## Priority Inference Logic

1. **Emotional Intensity**: "drowning", "anxious" = high stress tasks
2. **Mention Order**: First mentioned tasks often most pressing psychologically
3. **Progress Indicators**: "haven't done", "avoiding" = stuck tasks needing attention
4. **Work Default**: Work tasks generally higher priority unless personal urgency indicated
5. **Time Sensitivity**: "due soon" = higher priority than "due later"

This approach allows the system to take control of the prioritization process while the user simply provides factual information about each task.