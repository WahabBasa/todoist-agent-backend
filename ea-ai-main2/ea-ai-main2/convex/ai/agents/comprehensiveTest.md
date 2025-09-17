# Comprehensive Test Scenario - Brain Dump Handling

## Test Case: Overwhelmed User Brain Dump

**User Input:**
"I'm completely drowning right now. I have work deadlines, my apartment is a mess, I haven't done my taxes, my car needs maintenance, and I'm supposed to plan my sister's birthday party. I keep making to-do lists but they just make me more anxious. I don't even know where to start anymore."

## Expected Correct Agent Responses:

### Primary Agent Response:
"I'll help you organize this. Let me understand what's on your mind."

### Planning Agent Actions:
1. INTERNAL_TODO_UPDATE: [{id:"work",content:"work deadlines",status:"pending",priority:"high"}, {id:"apt",content:"apartment mess",status:"pending",priority:"medium"}, {id:"taxes",content:"taxes",status:"pending",priority:"high"}, {id:"car",content:"car maintenance",status:"pending",priority:"medium"}, {id:"party",content:"sister's birthday party",status:"pending",priority:"low"}]

2. INTERNAL_TODO_UPDATE: [Inferred taxes as most pressing due to "haven't done" + legal/financial implications]

3. QUESTION_FOR_USER: "When are your taxes due?"

## What Makes This Response Correct:

1. **No User Prioritization**: The system automatically inferred taxes as high priority
2. **Direct Question**: Asked a factual question without explanation
3. **Inference Logic**: Used "haven't done" + legal/financial context to prioritize
4. **Brief Response**: No unnecessary explanations or reassurances
5. **Systematic Approach**: Created internal todo list and worked through tasks

## Incorrect Responses to Avoid:

❌ "Which task has the most serious potential consequences?"
❌ "Which of these feels most urgent right now?"
❌ "What specific work deadline is causing you the most pressure?"
❌ "Consider which are truly priority 1 vs 2?"
❌ "This sounds like the most time-sensitive and potentially stressful item..."

## Key Success Metrics:

✅ System automatically infers priorities from user language
✅ Asks direct factual questions without over-explaining
✅ Creates internal todo list from brain dump
✅ Works through tasks one by one based on system-inferred priority
✅ Never asks user to make prioritization decisions
✅ Maintains brief, actionable responses

This test scenario validates that the unified approach is working correctly across all agents.