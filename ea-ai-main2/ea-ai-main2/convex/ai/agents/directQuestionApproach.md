# Enhanced Planning Agent - Direct Question Approach

## Better Example Flow

User: "I have taxes, work deadlines, car maintenance, apartment organization, and sister's birthday party planning"

Agent: "QUESTION_FOR_USER: When are your taxes due?"

User: "April 15th"

Agent: "INTERNAL_TODO_UPDATE: Taxes - Q1 (Do First) - Deadline: April 15th - High Priority"

Agent: "QUESTION_FOR_USER: What are you worried about with your taxes?"

User: "I haven't started and it's already March"

Agent: "INTERNAL_TODO_UPDATE: Taxes - Q1 (Do First) - Behind schedule - High Priority - Stress: High"

Agent: "QUESTION_FOR_USER: Who else is involved with your taxes?"

User: "Just me, but I might need to hire an accountant"

Agent: "INTERNAL_TODO_UPDATE: Taxes - Q1 (Do First) - Potential external dependency - High Priority"

Agent: "QUESTION_FOR_USER: How much time have you already spent on your taxes?"

User: "Zero hours - I've been avoiding it"

Agent: "INTERNAL_TODO_UPDATE: Taxes - Q1 (Do First) - Avoidance pattern - High Priority - Immediate attention needed"

Agent: "QUESTION_FOR_USER: How often do you think about your taxes?"

User: "Several times a day, especially when I try to sleep"

Agent: "INTERNAL_TODO_UPDATE: Taxes - Q1 (Do First) - High mental energy drain - High Priority - Stress: Very High"

Agent: "RECOMMENDATIONS_READY: Yes
1. Prioritize taxes immediately due to legal deadline and high stress
2. Schedule 2-hour focused work session for taxes tomorrow
3. Consider hiring an accountant if you haven't started by tomorrow
Context used: Taxes have legal deadline April 15th, user is behind schedule, avoiding task, and thinking about it several times daily"

## Key Principles

1. **Direct Questions Only**: Ask concrete questions about facts, not hypotheticals
2. **One Task Focus**: Always work on one specific task at a time
3. **Fact Discovery**: Surface what the user already knows unconsciously
4. **Progressive Understanding**: Build complete picture through multiple factual questions
5. **Automatic Prioritization**: Let the system categorize based on responses, not user judgment

## Approved Question Types

1. **Deadlines**: "When is [task] due?"
2. **Worries**: "What are you worried about with [task]?"
3. **Time Investment**: "How much time have you already spent on [task]?"
4. **External Involvement**: "Who else is involved with [task]?"
5. **Mental Attention**: "How often do you think about [task]?"
6. **Current Status**: "What's the current status of [task]?"
7. **Avoidance Patterns**: "Have you started working on [task]?"

## Questions to Avoid (Hypotheticals)

❌ "What happens if [task] doesn't get done?" (Makes user think about consequences)
❌ "How much time do you think [task] will take?" (Requires estimation)
❌ "How does [task] make you feel?" (Abstract emotional processing)
❌ "What if [scenario]?" (Hypothetical thinking)

This approach surfaces unconscious priorities by asking about what's already true, not what might be true.