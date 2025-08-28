# TaskAI - Production-Ready Intelligent Task Management System

An advanced AI-powered task management application with behavioral learning, comprehensive caching, and multi-platform integration capabilities.

## 🏗️ System Architecture

**Current Status**: ✅ **Production-Ready** (Branch: `feature/assistant-caching`)

```
React Frontend (Tailwind v4) → Convex Backend → Claude AI (Anthropic) → Advanced Systems
                                      ↓
                   Multi-Layer Caching System (60-80% Token Reduction)
                                      ↓
               Real-time Database + AI Mental Model Learning
```

## 🚀 Advanced Features

### **Core AI Capabilities**
- **Intelligent Task Management**: Natural language conversations with Claude 3.5 Sonnet/Haiku
- **Behavioral Learning System**: File-based mental model that learns user patterns passively
- **Smart Project Organization**: Eisenhower Matrix integration with personalized prioritization
- **Multi-Session Chat**: Morphic-style conversation management with tool call persistence

### **Performance & Efficiency**
- **Advanced Caching System**: 60-80% token usage reduction through multi-layer caching
- **Real-time Synchronization**: Instant updates across devices via Convex subscriptions
- **Session-Scoped AI Workflows**: Internal todo management for complex multi-step operations
- **Dynamic Prompt System**: OpenCode-inspired modular prompt architecture

### **Platform Integrations**
- **Google Calendar**: Full OAuth integration with event management and scheduling
- **Audio Features**: Voice recording and transcription capabilities
- **Todoist API**: Complete task synchronization and management
- **MCP Integration**: GitHub + Graphite workflow support for stacked PR development

### **Enterprise-Grade Design**
- **ChatGPT Grey Theme**: Professional UI with attention-zone typography system
- **Comprehensive Modal System**: Settings, quick actions, and project management
- **Security-First Architecture**: tokenIdentifier pattern with Convex Auth
- **Rate Limit Prevention**: Intelligent conversation deduplication and caching

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (database + server functions + real-time subscriptions)
- **AI**: Claude 3.5 Sonnet/Haiku via Anthropic SDK with advanced caching
- **UI**: TailwindCSS v4 with custom design system + shadcn/ui components
- **Authentication**: Convex Auth with tokenIdentifier pattern
- **Integrations**: Google Calendar OAuth, Todoist API, MCP servers

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

### Google Calendar MCP Reference

**📍 MCP Reference Location**: `C:\Users\AtheA\Desktop\Personal_Programs\google-cal-mcp\google-calendar-mcp - Copy`

This is the Google Calendar MCP server implementation that serves as our reference for Google Calendar API integration patterns, authentication flows, and calendar operation implementations.

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
│   ├── ai.ts                # 🧠 Core AI integration with 8 tools (Node.js runtime)
│   ├── ai/                  # 🚀 Advanced AI Systems
│   │   ├── system.ts        # Dynamic prompt system (OpenCode-inspired)
│   │   ├── caching.ts       # Multi-layer caching (60-80% token reduction)
│   │   ├── user-mental-model.txt # File-based behavioral learning
│   │   └── prompts/zen.txt  # Extracted system prompt content
│   ├── auth.ts              # Authentication configuration
│   ├── conversations.ts     # Chat message storage and retrieval
│   ├── tasks.ts            # Task CRUD operations and queries
│   ├── projects.ts         # Project management functions
│   ├── myFunctions.ts      # Dashboard stats and user utilities
│   ├── aiInternalTodos.ts  # Session-scoped AI task management
│   ├── googleCalendar/     # Google Calendar OAuth integration
│   │   └── auth.ts         # Calendar event management functions
│   ├── schema.ts           # Database schema definitions (tokenIdentifier pattern)
│   └── http.ts             # HTTP routes for auth
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── chat/          # Chat interface components (Morphic-style architecture)
│   │   │   ├── Chat.tsx           # Main chat controller with Convex integration
│   │   │   ├── ChatMessages.tsx   # Message container with scroll management
│   │   │   ├── ChatPanel.tsx      # Input panel with sticky positioning
│   │   │   └── RenderMessage.tsx  # User/assistant message rendering
│   │   ├── ai-elements/   # AI SDK Elements components
│   │   ├── labels/        # Label/tag management system
│   │   │   └── LabelManager.tsx   # Complete label CRUD with color coding
│   │   ├── nav/           # Navigation components
│   │   │   └── UserProfile.tsx    # User profile dropdown with settings access
│   │   ├── projects/      # Project management components
│   │   │   ├── AddProjectDialog.tsx # Project creation modal
│   │   │   ├── DeleteProject.tsx    # Project deletion confirmation
│   │   │   └── ProjectView.tsx      # Individual project display
│   │   ├── ui/            # shadcn/ui components and custom UI elements
│   │   │   ├── alert-dialog.tsx, alert.tsx, avatar.tsx, badge.tsx
│   │   │   ├── button.tsx, card.tsx, carousel.tsx, checkbox.tsx
│   │   │   ├── collapsible.tsx, copy-button.tsx, dialog.tsx
│   │   │   ├── dropdown-menu.tsx, form.tsx, hover-card.tsx
│   │   │   ├── input.tsx, label.tsx, markdown-renderer.tsx
│   │   │   ├── progress.tsx, prompt-suggestions.tsx, scroll-area.tsx
│   │   │   ├── select.tsx, separator.tsx, sheet.tsx, sidebar.tsx
│   │   │   ├── skeleton.tsx, sonner.tsx, switch.tsx, tabs.tsx
│   │   │   └── textarea.tsx, tooltip.tsx
│   │   ├── SettingsModal.tsx      # ChatGPT-style settings modal (7 sections)
│   │   ├── QuickTaskModal.tsx     # Quick task creation dialog
│   │   └── Sidebar.tsx    # Navigation sidebar with stats
│   ├── views/             # Main application views
│   │   ├── ChatView.tsx   # AI chat interface (imports Chat component)
│   │   ├── TasksView.tsx  # Task management interface
│   │   ├── ProjectsView.tsx # Project overview
│   │   └── SettingsView.tsx # User preferences
│   ├── hooks/             # Custom React hooks
│   │   ├── use-audio-recording.ts    # Audio recording functionality
│   │   ├── use-auto-scroll.ts        # Automatic scrolling behavior
│   │   ├── use-autosize-textarea.ts  # Auto-resizing textarea
│   │   ├── use-copy-to-clipboard.ts  # Clipboard operations
│   │   └── use-mobile.ts             # Mobile device detection
│   ├── lib/               # Utility functions and helpers
│   │   ├── audio-utils.ts # Audio recording utilities
│   │   └── utils.ts       # General utility functions
│   ├── App.tsx            # Main app with auth and routing
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles and theme
├── .cursor/rules/         # Development guidelines
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # TailwindCSS + DaisyUI configuration
└── vite.config.ts         # Vite build configuration
```

### Key Components

**Backend (Advanced AI Systems)**
- `ai.ts` - 🧠 Core AI integration with 8 tool functions + mental model integration (Node.js runtime)
- `ai/system.ts` - 🚀 Dynamic prompt system with OpenCode-inspired architecture (edge runtime)
- `ai/caching.ts` - ⚡ Multi-layer caching system (60-80% token reduction, conversation deduplication)
- `ai/user-mental-model.txt` - 🎯 File-based behavioral learning with Eisenhower Matrix personalization
- `aiInternalTodos.ts` - 🗂️ Session-scoped AI task management for complex workflows
- `googleCalendar/auth.ts` - 📅 Google Calendar OAuth integration with full event management
- `tasks.ts` - Complete task lifecycle management with filtering and project association  
- `projects.ts` - Project CRUD with task counting and progress tracking
- `conversations.ts` - Persistent chat history with tool call logging
- `schema.ts` - Type-safe database schema with tokenIdentifier pattern and proper indexes

**Frontend (React Components)**
- **Chat Architecture (Morphic-style)** - Modular chat interface with clean separation of concerns
  - `Chat.tsx` - Main controller with Convex integration and state management
  - `ChatMessages.tsx` - Scroll container with section-based message rendering  
  - `ChatPanel.tsx` - Sticky input panel with scroll controls and form handling
  - `RenderMessage.tsx` - Clean user/assistant message display with integrated styling
- **Modal System** - Comprehensive dialog-based interfaces
  - `SettingsModal.tsx` - ChatGPT-style settings with 7 sections (General, Notifications, etc.)
  - `QuickTaskModal.tsx` - Quick task creation dialog with form validation
- **Navigation & Layout**
  - `Sidebar.tsx` - Dynamic navigation with live stats and responsive design
  - `UserProfile.tsx` - User profile dropdown with settings access
- **Project & Label Management**
  - `LabelManager.tsx` - Complete label/tag system with CRUD operations
  - `AddProjectDialog.tsx`, `DeleteProject.tsx`, `ProjectView.tsx` - Project lifecycle
- **Audio Features** - Voice recording and transcription capabilities
  - `use-audio-recording.ts` - Custom hook for audio capture
  - `audio-utils.ts` - Audio processing utilities
- `ChatView.tsx` - Main chat interface wrapper (imports Chat component)
- `ProjectsView.tsx` - Visual project overview with progress bars and statistics

## Environment Setup

### Convex Setup
1. Create a Convex account at [convex.dev](https://convex.dev)
2. Run `npx convex dev` to create a new deployment
3. Copy the deployment URL to your `.env.local`

### Anthropic API Setup
1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Add it to your `.env.local` as `ANTHROPIC_API_KEY`
3. **Advanced Features Enabled**: Multi-layer caching, mental model learning, and behavioral analysis

### Convex MCP Server Setup
For Claude Code integration with Convex database and functions:
1. Configure MCP server: `claude mcp add convex npx -- -y convex@latest mcp start`
2. Documentation: [Convex MCP Server Guide](https://stack.convex.dev/convex-mcp-server)

## Development

**⚠️ Server Startup Policy**: Only start development servers when explicitly requested by the user.

**🕘 Timeout Commands**: For development and debugging purposes, always use timeout commands to get full context from long-running processes:

- `timeout 60 npm run dev` - Start both frontend and backend with 60-second timeout for diagnostics
- `timeout 90 npm run dev` - Start development servers with 90-second timeout for comprehensive debugging
- `timeout 60 npx convex dev` - Start Convex backend only with 60-second timeout
- `npm run build` - Build for production
- `npm run lint` - Run TypeScript and ESLint checks

**Why Timeouts**: Long-running development servers provide essential debugging information during startup (dependency resolution, compilation errors, server ready status). Using 60-90 second timeouts captures this diagnostic output without leaving processes running indefinitely.

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

## 🔬 Advanced System Details

### **Mental Model Learning System**
The AI passively learns user behavioral patterns through conversation analysis:
- **Work Patterns**: Energy/focus cycles, productivity windows
- **Priority Signals**: Urgency detection, strategic vs tactical tasks  
- **Eisenhower Matrix Personalization**: User-specific importance/urgency triggers
- **Confidence Scoring**: Pattern reliability metrics with continuous refinement

### **Multi-Layer Caching Architecture** 
Comprehensive performance optimization system:
- **L1 - Conversation Deduplication**: Prevents duplicate requests (5-minute TTL)
- **L2 - Mental Model Cache**: File I/O elimination (10-minute TTL)  
- **L3 - Message Optimization**: Anthropic ephemeral caching (system + final 2 messages)
- **L4 - Tool Result Cache**: Session-based operation results (2-minute TTL)
- **Expected Impact**: 60-80% token reduction, 10x faster mental model loading

### **Database Schema (tokenIdentifier Pattern)**
Modern Convex schema design:
- **`chatSessions`**: Multi-conversation support with default session management
- **`conversations`**: Message arrays with tool call persistence and legacy migration support
- **`aiInternalTodos`**: Session-scoped AI workflow management with priority/status tracking
- **`todoistTokens`**: Secure API token storage with automatic refresh

### **Design System (ChatGPT Grey Theme)**
Professional UI with attention-zone typography:
- **Color Palette**: Grey-scale with HSL white intensity system (100%/90%/75%/60%)
- **Typography Zones**: Primary (14px), Secondary (13px), Tertiary (12px), Utility (11px)  
- **Border Radius**: Professional curvature system (6px/8px/12px/16px)
- **Spacing System**: UX-driven padding based on attention priority

### Documentation References

- [Convex CLI Reference](https://docs.convex.dev/cli) - Complete CLI command documentation
- [Convex MCP Server Guide](https://stack.convex.dev/convex-mcp-server) - MCP server configuration and deployment targeting
- [Anthropic API Documentation](https://docs.anthropic.com) - Claude integration and advanced features
- [OpenCode Architecture Patterns](https://github.com/stackblitz/opencode) - Prompt system and caching inspiration

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
