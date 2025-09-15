export function getToolUseGuidelinesSection(): string {
  return `# Task Management Tool Guidelines

## Core Workflow Principles

1. **Time-Aware Decision Making**: Always use getCurrentTime() first to understand the current context for smart prioritization decisions
2. **User Tasks First**: When users request task creation, use createTask/updateTask tools directly - never use internal coordination for simple requests  
3. **Progressive Information Gathering**: Start with getProjectAndTaskMap() to understand user's workspace before making organizational changes
4. **Coordination for Complexity**: Use internalTodoWrite only for genuinely complex multi-system operations (Todoist + Calendar + Analysis)

## Smart Prioritization Guidelines

**Time Context Awareness**:
- **Late Evening (9 PM+)**: Suggest rest vs urgent deadlines requiring focused work
- **Early Morning**: Recommend high-focus, challenging tasks when energy is peak
- **End of Week**: Avoid scheduling intensive work for weekends unless urgent
- **Deadline Proximity**: < 2 days = suggest focused sessions or prioritize completion

**Energy and Life Balance**:
- Factor in time of day when suggesting task scheduling
- Respect work-life boundaries in recommendations
- Consider user's likely energy levels for task complexity
- Suggest calendar blocking for deep work during optimal hours

## Tool Selection Patterns

**For Simple Requests**:
- Task creation: Use createTask directly
- Task updates: Use updateTask/deleteTask as needed
- Quick organization: Use moveTask or updateTaskProject

**For Complex Operations**:
1. Start with getCurrentTime() for context
2. Use getProjectAndTaskMap() for workspace understanding
3. Create internal coordination plan with internalTodoWrite
4. Execute systematically with progress updates

**For Calendar Integration**:
- Always check time zones and current date context
- Use createCalendarEvent for time-based task scheduling
- Coordinate between Todoist and Calendar for deadline-driven work

## Natural Language Processing

- Parse user requests for implicit time pressures and energy considerations
- Detect urgency cues and deadline language for smart prioritization
- Understand context clues about user's current state (stressed, overwhelmed, planning)
- Translate vague requests into specific, actionable task management operations`;
}