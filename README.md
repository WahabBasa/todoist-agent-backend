# TaskAI

An intelligent task management application powered by Claude AI, built with Convex and React.

## 🚀 Frontend Migration Notice
**We are transitioning from the legacy React+Vite frontend (`ea-ai-main2/ea-ai-main2/`) to the new Next.js 15 + shadcn/ui frontend (`ea-ai-main2/nextjs-ea-ai/`).** 
The Next.js frontend features modern components with Twitter theme styling and Tailwind v4.  
Both frontends currently coexist, but **the Next.js version is now the primary development focus.**

## Features

- **AI-Powered Task Management**: Create, update, and organize tasks through natural language conversations with Claude AI
- **Project Organization**: Group related tasks into projects with color coding and progress tracking
- **Real-time Updates**: Instant synchronization across all your devices using Convex
- **Smart Conversations**: Contextual AI assistant that remembers your workflow and preferences
- **Secure Authentication**: Email/password authentication with Convex Auth

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (database + server functions)
- **AI**: Claude 3.5 Sonnet/Haiku via Anthropic SDK
- **UI**: TailwindCSS + DaisyUI
- **Authentication**: Convex Auth with password provider

## Quick Start

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file with:
   ```
   VITE_CONVEX_URL=your-convex-deployment-url
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

3. **Deploy Convex backend** (only when explicitly requested):
   ```bash
   npx convex dev
   ```

4. **Start the development server** (only when explicitly requested):
   ```bash
   npm run dev
   ```

   **⚠️ IMPORTANT**: Do not automatically run the backend or frontend servers. Only start these processes when explicitly requested by the user.

## Usage Examples

Once running, you can interact with TaskAI through natural language:

- *"Create a task to review the quarterly report"*
- *"Show me all my active tasks"*
- *"Move all marketing tasks to the Website Redesign project"*
- *"Mark all high priority tasks as completed"*
- *"Create a project for Q1 planning with blue color"*

## Project Structure

**📍 Main Active Project Location**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2\` 
This is the primary working directory containing both frontend and backend code.

### Design Reference - TodoVex

**📍 Reference Project Location**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\references\todoist-clone-todovex\`

This is the TodoVex project - a high-quality Todoist clone that serves as our primary design and architecture reference. We use this project to guide our UI/UX decisions, component structure, and overall application design patterns.

#### TodoVex Directory Structure
```
├── app/                       # Next.js 13+ App Router structure
│   ├── api/auth/              # NextAuth.js authentication endpoints
│   ├── loggedin/              # Protected routes (main app pages)
│   │   ├── projects/          # Project-specific pages
│   │   ├── today/             # Today view page
│   │   ├── upcoming/          # Upcoming tasks page
│   │   └── search/            # Search functionality
│   └── globals.css            # Global styles
├── components/                # React components organized by feature
│   ├── add-tasks/             # Task creation components
│   ├── containers/            # Page container components
│   ├── nav/                   # Navigation components
│   ├── projects/              # Project management components
│   ├── todos/                 # Task/todo components
│   └── ui/                    # shadcn/ui components
├── convex/                    # Convex backend (similar to our structure)
│   ├── auth.ts               # Authentication functions
│   ├── projects.ts           # Project management
│   ├── todos.ts              # Task operations
│   ├── labels.ts             # Label/tag system
│   └── schema.ts             # Database schema
├── actions/                   # Server actions
├── lib/                       # Utility functions
└── public/                    # Static assets
```

### Main Project Structure
```
├── convex/                    # Backend functions and database schema
│   ├── _generated/           # Auto-generated Convex files
│   ├── ai.ts                # Claude AI integration with tool definitions
│   ├── auth.ts              # Authentication configuration
│   ├── conversations.ts     # Chat message storage and retrieval
│   ├── tasks.ts            # Task CRUD operations and queries
│   ├── projects.ts         # Project management functions
│   ├── myFunctions.ts      # Dashboard stats and user utilities
│   ├── schema.ts           # Database schema definitions
│   └── http.ts             # HTTP routes for auth
├── src/
│   ├── components/         # Reusable UI components
│   │   └── Sidebar.tsx    # Navigation sidebar with stats
│   ├── views/             # Main application views
│   │   ├── ChatView.tsx   # AI chat interface
│   │   ├── TasksView.tsx  # Task management interface
│   │   ├── ProjectsView.tsx # Project overview
│   │   └── SettingsView.tsx # User preferences
│   ├── App.tsx            # Main app with auth and routing
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles and theme
├── .cursor/rules/         # Development guidelines
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # TailwindCSS + DaisyUI configuration
└── vite.config.ts         # Vite build configuration
```

### Key Components

**Backend (Convex Functions)**
- `ai.ts` - Core AI integration with 8 tool functions for task/project management
- `tasks.ts` - Complete task lifecycle management with filtering and project association  
- `projects.ts` - Project CRUD with task counting and progress tracking
- `conversations.ts` - Persistent chat history with tool call logging
- `schema.ts` - Type-safe database schema with proper indexes

**Frontend (React Components)**
- `ChatView.tsx` - Real-time AI chat with tool execution feedback and model switching
- `TasksView.tsx` - Interactive task management with manual creation and status updates
- `ProjectsView.tsx` - Visual project overview with progress bars and statistics
- `Sidebar.tsx` - Dynamic navigation with live stats and responsive design

## Environment Setup

### Convex Setup
1. Create a Convex account at [convex.dev](https://convex.dev)
2. Run `npx convex dev` to create a new deployment
3. Copy the deployment URL to your `.env.local`

### Anthropic API Setup
1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Add it to your `.env.local` as `ANTHROPIC_API_KEY`

### Convex MCP Server Setup
For Claude Code integration with Convex database and functions:
1. Configure MCP server: `claude mcp add convex npx -- -y convex@latest mcp start`
2. Documentation: [Convex MCP Server Guide](https://stack.convex.dev/convex-mcp-server)

## Development

**⚠️ Server Startup Policy**: Only start development servers when explicitly requested by the user.

- `npm run dev` - Start both frontend and backend in development mode (user request required)
- `npx convex dev` - Start Convex backend only (user request required)
- `npm run build` - Build for production
- `npm run lint` - Run TypeScript and ESLint checks

### Updated Convex CLI Commands

**Note**: Legacy `convex auth` commands were removed. Use these current commands:

**Deployment & Environment**:
- `npx convex env list` - View environment variables for current deployment
- `npx convex env set KEY=value` - Set environment variable
- `npx convex data` - List tables and view database contents
- `npx convex dashboard` - Open deployment dashboard in browser
- `npx convex logs` - Watch deployment logs
- `npx convex logout` - Remove Convex credentials from device

**Function Execution**:
- `npx convex run functionName` - Execute a function on your deployment
- `npx convex function-spec` - List function metadata from deployment

**Data Management**:
- `npx convex import <path>` - Import data from file
- `npx convex export` - Export deployment data to ZIP file

**MCP Server**:
- `npx convex mcp start` - Start Model Context Protocol server
- `npx convex mcp start --project-dir <path>` - Start MCP for specific project
- `npx convex mcp start --deployment-name <name>` - Target specific deployment

### Documentation References

- [Convex CLI Reference](https://docs.convex.dev/cli) - Complete CLI command documentation
- [Convex MCP Server Guide](https://stack.convex.dev/convex-mcp-server) - MCP server configuration and deployment targeting
- [Convex Authentication](https://docs.convex.dev/auth) - Current authentication methods (referenced for auth command removal)

<development_log_guidelines_v4> <task_description> You are a senior software engineer documenting your development session for team knowledge sharing and project continuity. Your role is to create technical documentation that captures not just what was implemented, but your engineering decision-making process, trade-off analysis, and problem-solving approach with honest assessment of current status and results. 

**CRITICAL: ALL ENTRIES MUST BE WRITTEN TO A SINGLE FILE** - Each development session gets added as a new entry to the same daily devlog file (e.g., `updates/2025-08-09_devlog.md`). Do NOT create separate files for each session. </task_description>

<documentation_context> Development logs serve as technical knowledge artifacts that:

- Document the engineering thought process and decision-making methodology
- Capture why specific approaches were chosen over alternatives
- Explain trade-offs considered and architectural reasoning
- Show problem-solving patterns and debugging methodologies
- Enable other engineers to understand both changes and engineering rationale
- Track actual progress with realistic status assessment </documentation_context>

<engineering_narrative_focus> <decision_documentation>

- Explain WHY you chose specific approaches: "Made the call to use X because Y"
- Document alternatives considered: "Analyzed three approaches: A, B, C - chose A because..."
- Include trade-off reasoning: "Sacrificed X for Y because the performance gain was worth it"
- Show problem-solving methodology: "Debugged by first checking X, then Y, finally found Z"
- Capture engineering intuition: "Something felt off about the error pattern, so I..." </decision_documentation>

<technical_reasoning>

- Document the analysis process behind technical decisions
- Explain when you chose simple vs complex solutions and why
- Show how you evaluated different implementation patterns
- Include lessons learned from failed approaches before finding the solution
- Capture moments of insight: "Realized the real issue was..." or "The breakthrough came when..." </technical_reasoning>

<problem_solving_narrative>

- Walk through your debugging methodology step-by-step
- Explain how you narrowed down root causes
- Document dead ends and why you abandoned certain approaches
- Show pattern recognition: "This looked similar to a previous issue where..."
- Include your thought process during investigation </problem_solving_narrative> </engineering_narrative_focus>

<mandatory_requirements> <entry_constraints>

- **APPEND TO SINGLE DAILY FILE**: Always add new entries to the existing daily devlog file (e.g., `updates/2025-08-09_devlog.md`). Never create separate files per session.
- Maximum 35 lines per entry to allow for reasoning explanation
- Include exact timestamp: **Date**: [Month Day, Year] - [HH:MM AM/PM] - [Session Type]
- Document current status honestly: tested/untested, working/failing/unknown
- Reference specific files with line numbers: `file_path:line_number`
- Use conversational senior engineer tone with decision-making narrative </entry_constraints>

<status_tracking> Must include realistic status assessment:

- ✅ "Tested and working" - confirmed functionality through testing
- ⚠️ "Implemented but untested" - code written but validation pending
- ❌ "Attempted but failing" - implementation issues encountered
- 🔄 "In progress" - partial implementation, work continuing
- ❓ "Status unknown" - no feedback provided on results </status_tracking> </mandatory_requirements>

<structure_requirements> <session_header_format>

## [Feature/Component Name] - [Technical Focus]

**Date**: [Month Day, Year] - [HH:MM AM/PM] - [Session Type] **Status**: [Status Icon] [Brief honest assessment of current state] </session_header_format>

<content_structure> Each entry must include:

1. Problem identification with your analysis approach (3-4 lines)
2. Decision-making process with alternatives considered (4-6 lines)
3. Implementation approach with reasoning and file references (8-12 lines)
4. Current status with honest functionality assessment (2-3 lines)
5. Engineering insights and lessons learned (3-5 lines)
6. References to documentation consulted (1-2 lines) </content_structure> </structure_requirements>

<engineering_voice_examples> Good engineering narrative examples:

- "Made the call to scrap migrations entirely - the complexity wasn't worth it for a development app"
- "Analyzed three different approaches before settling on the Long timestamp pattern"
- "Something felt wrong about the error pattern, so I dug deeper into the parsing logic"
- "Initially tried the complex route with custom serializers, but stepped back and chose simplicity"
- "The breakthrough came when I realized the issue wasn't in our code but in the API format expectations"
- "Sometimes the nuclear option is the right option - complete database reset was cleaner" </engineering_voice_examples>

<quality_standards> <engineering_thought_process>

- Document your reasoning methodology and decision criteria
- Explain why you rejected certain approaches before finding the solution
- Show trade-off evaluation: performance vs complexity, time vs quality
- Include moments of realization and breakthrough insights
- Capture your engineering intuition and experience-based decisions </engineering_thought_process>

<technical_accuracy>

- Document actual implementation state with specific file references
- Include exact error messages and your diagnostic approach
- Specify concrete technical patterns and architectural decisions
- Report real test results and observed system behavior
- Explain your validation methodology </technical_accuracy> </quality_standards>

<task_reminder> Create a development log entry that captures not just the technical changes made, but your engineering decision-making process, problem-solving approach, and the reasoning behind your choices. Write as a senior engineer explaining both what you did and why you did it that way, including alternatives considered and trade-offs evaluated. Maximum 35 lines with honest status assessment.

**FILE LOCATION REQUIREMENT**: Always append your entry to the current daily devlog file in the `updates/` directory (e.g., `updates/2025-08-09_devlog.md`). If the file doesn't exist, create it. Multiple sessions per day should all be added to the same file with proper separation. </task_reminder> </development_log_guidelines_v4>
