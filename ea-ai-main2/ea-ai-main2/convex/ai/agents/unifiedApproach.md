# Unified Prompt Approach - Brain Dump Handling

## Corrected Example Flow

User: "I'm completely drowning right now. I have work deadlines, my apartment is a mess, I haven't done my taxes, my car needs maintenance, and I'm supposed to plan my sister's birthday party. I keep making to-do lists but they just make me more anxious. I don't even know where to start anymore."

Primary Agent: "INTERNAL_TODO_UPDATE: [Acknowledging user's overwhelmed state]"
Primary Agent: "I'll help you organize this. Let me understand what's on your mind."

Planning Agent: "INTERNAL_TODO_UPDATE: [{id:'work',content:'work deadlines',status:'pending',priority:'high'}, {id:'apt',content:'apartment mess',status:'pending',priority:'medium'}, {id:'taxes',content:'taxes',status:'pending',priority:'high'}, {id:'car',content:'car maintenance',status:'pending',priority:'medium'}, {id:'party',content:'sister's birthday party',status:'pending',priority:'low'}]"

Planning Agent: "INTERNAL_TODO_UPDATE: [Inferred work deadlines as most pressing due to 'drowning' tone and mention as first task]"

Planning Agent: "QUESTION_FOR_USER: When are your work deadlines due?"

User: "Most are due by Friday, but one critical project is due Thursday"

Planning Agent: "INTERNAL_TODO_UPDATE: [work deadlines - Q1 (Do First) - Critical project due Thursday - High Priority - Stress: Very High]"

Planning Agent: "QUESTION_FOR_USER: What are you worried about with your work deadlines?"

## Key Corrections Made

1. **No User Prioritization**: The system never asks "What specific work deadline is coming up that's causing you the most immediate pressure?" 
2. **Automatic Inference**: The system infers that work deadlines are most pressing based on mention order and emotional language
3. **Direct Fact Gathering**: The system asks direct questions about deadlines and worries rather than asking users to analyze their situation
4. **Unified Approach**: Both primary and planning agents follow the same principle of not requiring user prioritization

## Unified Principles Across All Prompts

1. **System Prioritization**: Agents infer priorities from user language, not ask users to decide
2. **Direct Questioning**: Ask factual questions about deadlines, worries, time spent, not hypotheticals
3. **One Task Focus**: Work on one task at a time based on system-inferred priority
4. **Progressive Discovery**: Build complete picture through multiple factual questions about same task
5. **Internal Tracking**: Maintain todo list status throughout process
6. **No Cognitive Load**: Never make users think about priorities or comparisons

This unified approach ensures that when users brain dump multiple tasks, the system takes control of prioritization while the user simply provides factual information.