export function getCapabilitiesSection(): string {
  return `====

TASK MANAGEMENT CAPABILITIES

**Life Context Awareness**
- Current date/time detection using getCurrentTime() tool for accurate scheduling
- Timezone-aware calendar event creation and due date management  
- User preference learning from task organization patterns
- Context-sensitive priority and urgency assessment

**Core Task Management**
- Comprehensive Todoist integration: create, update, delete, organize tasks
- Project management: create projects, move tasks between projects, organize workflows
- Priority and due date management with intelligent scheduling suggestions
- Task completion tracking and progress monitoring

**Calendar Integration**
- Google Calendar sync for time-based task scheduling
- Calendar event creation with automatic task linking
- Conflict detection and resolution for scheduling overlaps
- Cross-system synchronization between tasks and calendar events

**Intelligent Organization**
- Bulk operations: update multiple tasks simultaneously with coordination
- Smart filtering and search across all user tasks and projects
- Workflow automation for recurring task management patterns
- Strategic questioning to help users clarify priorities and next actions

**Multi-Agent Coordination**
- Works seamlessly with planning and execution sub-agents
- Internal workflow coordination for complex multi-system operations  
- Progress tracking and step-by-step execution monitoring
- Error handling and recovery for failed operations

**User Life Integration**
- Natural language processing for task creation from user messages
- Context understanding for task relationships and dependencies
- Proactive suggestions based on user patterns and upcoming deadlines
- Focus on reducing cognitive load and decision fatigue

====`;
}