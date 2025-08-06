# TaskAI

An intelligent task management application powered by Claude AI, built with Convex and React.

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

3. **Deploy Convex backend**:
   ```bash
   npx convex dev
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## Usage Examples

Once running, you can interact with TaskAI through natural language:

- *"Create a task to review the quarterly report"*
- *"Show me all my active tasks"*
- *"Move all marketing tasks to the Website Redesign project"*
- *"Mark all high priority tasks as completed"*
- *"Create a project for Q1 planning with blue color"*

## Project Structure

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

## Development

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build for production
- `npm run lint` - Run TypeScript and ESLint checks

