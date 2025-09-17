# Enhanced Planning Agent Documentation

## Overview
The enhanced planning agent is an improved version of the existing planning agent that uses leading questions and intelligent priority detection to help users organize their tasks without directly asking them to make decisions.

## Key Features

### Leading Question Techniques
Instead of asking users to choose between options, the agent uses strategic questions to understand what's important:

- **Stress Detection**: "What's taking up most of your mental energy right now?"
- **Deadline Discovery**: "When do you need this done?"
- **Impact Assessment**: "What's weighing on your mind most?"
- **Avoidance Recognition**: Identifying what users mention but don't act on

### Intelligent Priority Detection
The agent automatically categorizes tasks using the Eisenhower Matrix based on:
- Stress indicators ("stressed", "worried", "behind")
- Deadline words ("due", "tomorrow", "urgent")
- Authority pressure ("boss", "client")
- Growth opportunities ("learn", "improve", "organize")

### Communication Style
- Asks ONE simple question at a time
- Keeps responses brief (1-2 lines maximum)
- Never asks users to prioritize directly
- Makes intelligent assumptions based on responses
- Confirms understanding with action, not more questions

## Usage Examples

### Example 1: Overwhelmed User
```
User: "I'm feeling overwhelmed with everything I need to do"
Agent: "QUESTION_FOR_USER: What's taking up most of your mental energy right now?"
```

### Example 2: Multiple Deadlines
```
User: "I have taxes due next week, a project deadline in two weeks, and some home maintenance I've been putting off"
Agent: "INTERNAL_TODO_UPDATE: Taxes=Q1 (urgent+important), Project=Q1 (deadline), Home maintenance=Q2 (important, not urgent)"
Agent: "RECOMMENDATIONS_READY: Yes. Focus on taxes first since they're due soonest, then the project, and schedule home maintenance for next week."
```

## Integration with Existing System
The enhanced planning agent works with the existing internal todo system and follows the same patterns as other agents in the system. It uses the `internalTodoWrite` and `internalTodoRead` tools to track progress and maintain state.

## Response Formats
The agent uses specific response formats to communicate its process:

1. **When asking questions**: `QUESTION_FOR_USER: [Simple, specific question]`
2. **When updating understanding**: `INTERNAL_TODO_UPDATE: [What you're learning + priority assumptions]`
3. **When ready with recommendations**: `RECOMMENDATIONS_READY: Yes` followed by brief actions