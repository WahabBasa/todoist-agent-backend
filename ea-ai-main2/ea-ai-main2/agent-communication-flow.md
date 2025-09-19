# Agent Communication Flow

## Overview
The 4-mode AI system uses a unified communication approach where all agents work together to provide a seamless experience to the user. The system communicates as a single entity (Zen) regardless of which specialized agent is handling the current task.

## Communication Architecture

### Primary Agent (Zen)
- **Role**: Main interface between user and the AI system
- **Communication**: Direct interaction with user through natural conversation
- **Responsibilities**:
  - Handle all user requests and responses
  - Orchestrate specialized agents when needed
  - Maintain consistent voice and personality
  - Coordinate complex workflows between multiple agents
  - Present results from specialized agents to the user

### Specialized Agents
Specialized agents work behind the scenes and typically do not communicate directly with the user.

#### Information Collector Agent
- **Role**: Systematically gather information through strategic questioning
- **Communication**: Coordinates with primary agent to ask user questions
- **Workflow**: Uses QUESTION_FOR_USER format to request information through the primary agent

#### Planning Agent
- **Role**: Create strategic plans and recommendations from complete information
- **Communication**: Works behind the scenes; returns results to primary agent
- **Exceptions**: May need to ask specific questions through the primary agent using QUESTION_FOR_USER format

#### Execution Agent
- **Role**: Perform direct task and calendar operations
- **Communication**: Works entirely in the background
- **Reporting**: Provides status updates to primary agent only

## Unified Identity
All agents maintain the same identity (Zen) and communication style:
- Consistent voice and personality across all interactions
- Natural, conversational responses
- Concise but thorough communication
- No revelation of internal agent switching
- Single point of contact for the user (the primary agent)

## Workflow Examples

### Simple Request
1. User: "Create a task to call the dentist"
2. Primary Agent: Processes request directly
3. Primary Agent: Uses Execution Agent to create task
4. Execution Agent: Creates task and reports back
5. Primary Agent: Responds to user with confirmation

### Complex Request
1. User: "I'm overwhelmed with work deadlines, taxes, and car maintenance"
2. Primary Agent: Recognizes need for planning assistance
3. Primary Agent: Delegates to Planning Agent with user's exact words
4. Planning Agent: Creates internal todo list and begins information gathering
5. Planning Agent: Requests information through Primary Agent (QUESTION_FOR_USER)
6. User: Responds to question
7. Planning Agent: Continues information gathering process
8. Planning Agent: Completes analysis and returns recommendations to Primary Agent
9. Primary Agent: Presents organized plan to user

This architecture ensures that users interact with a single, consistent AI assistant (Zen) while benefiting from specialized capabilities working behind the scenes.