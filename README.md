# Todoist Agent Backend

A multi-user AI agent system for natural language Todoist task management, built with Convex backend and Vercel AI SDK.

## Project Overview

This system provides a mobile-agnostic backend that enables natural language interaction with Todoist through AI agents. Users can create, read, update, and delete tasks using conversational interfaces across any frontend platform.

## Directory Structure & Access Methods

### Working Directories

This project contains **two distinct working directories** with different access patterns:

#### 1. Main Project Directory (Current Working Directory)
- **Path**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend`
- **Access**: Standard `cd` commands work, this is the current working directory
- **Contents**: Convex backend, web frontend, mobile apps, Chrome extension
- **Usage**: All development commands, git operations, and file modifications

#### 2. External Android Project (Reference Only)
- **Path**: `C:\Users\AtheA\AndroidStudioProjects\todoaiapp2`
- **Access**: **ABSOLUTE PATHS ONLY** - cannot `cd` into this directory
- **Contents**: Separate Kotlin Android app for Todo AI integration
- **Usage**: Read-only reference, file viewing with full absolute paths

### Important Access Notes

```bash
# ✅ WORKS - Main project directory
cd convex/
cat schema.ts
npm install

# ❌ FAILS - Cannot cd to Android project
cd C:\Users\AtheA\AndroidStudioProjects\todoaiapp2

# ✅ WORKS - Android project file access
# Use absolute paths in tools:
# Read: C:\Users\AtheA\AndroidStudioProjects\todoaiapp2\app\build.gradle.kts
# LS: C:\Users\AtheA\AndroidStudioProjects\todoaiapp2\app\src\main\java
```

### Related Projects

- **React Native Frontend**: [WahabBasa/todoapp](https://github.com/WahabBasa/todoapp) - React Native Todoist clone that consumes this backend
- **OpenCode Fork**: [WahabBasa/opencode-copy2](https://github.com/WahabBasa/opencode-copy2) - AI coding agent for terminal (forked for study)
- **Android Todo App**: `C:\Users\AtheA\AndroidStudioProjects\todoaiapp2` - Kotlin Android app for Todo AI integration (separate project)

### Core Architecture

```
Mobile Apps (Any Framework) → HTTP/WebSocket → Convex Backend → Vercel AI SDK → Todoist API
                                              ↓
                                         Convex Database (Multi-User State)
```

## Technical Stack

- **Backend Framework**: Convex (Real-time database + serverless functions)
- **AI Processing**: Vercel AI SDK with OpenAI GPT-4
- **External API**: Todoist REST API v2
- **Authentication**: Clerk (integrated with Convex)
- **Language**: TypeScript
- **Testing**: Simple HTML interface + REST clients

## Key Features

### Multi-User Architecture
- **Isolated User Sessions**: Each user's Todoist integration is completely separate
- **Concurrent Processing**: Built-in support for multiple simultaneous users
- **Real-time Updates**: WebSocket-based live synchronization across client sessions
- **Secure Token Management**: Per-user Todoist API tokens stored securely

### AI Agent Capabilities
- **Natural Language Processing**: Convert conversational input to Todoist operations
- **Multi-step Reasoning**: Complex task breakdown using `maxSteps` parameter
- **CRUD Operations**: Create, read, update, delete tasks through natural language
- **Context Awareness**: Maintain conversation history and user preferences

## Project Structure

```
todoist-agent-backend/
├── convex/
│   ├── schema.ts           # Database schema definitions
│   ├── agents.ts           # AI agent logic with Vercel AI SDK
│   ├── todoist.ts          # Todoist API integration functions
│   ├── http.ts             # HTTP endpoints for mobile clients
│   └── auth.ts             # User authentication handlers
├── src/
│   ├── test-interface.html # Simple web testing interface
│   └── todoist-client.ts   # Todoist API wrapper
├── package.json
└── convex.json
```

## Development Setup

### Prerequisites
- Bun or Node.js 18+
- Convex CLI (`npm i -g convex`)
- Todoist API token
- OpenAI API key
- Clerk account (for auth)

### Installation

```bash
# Clone and setup
git clone <repository>
cd todoist-agent-backend

# Install dependencies
bun install
# or: npm install

# Initialize Convex
npx convex dev --once
```

### Environment Configuration

Create `.env.local`:
```bash
OPENAI_API_KEY=sk-...
TODOIST_API_URL=https://api.todoist.com/rest/v2
CLERK_SECRET_KEY=sk_test_...
```

### Database Schema

```typescript
// convex/schema.ts
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    todoistToken: v.string(),
    preferences: v.object({
      timezone: v.string(),
      defaultProject: v.optional(v.string())
    })
  }).index("by_clerk_id", ["clerkId"]),

  conversations: defineTable({
    userId: v.id("users"),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.any()))
  }).index("by_user", ["userId"])
});
```

## Core Implementation

### AI Agent Definition

```typescript
// convex/agents.ts
export const processMessage = action({
  args: { message: v.string(), userId: v.string() },
  handler: async (ctx, { message, userId }) => {
    const result = await generateText({
      model: openai("gpt-4"),
      maxSteps: 5,
      tools: {
        createTask: createTaskTool,
        updateTask: updateTaskTool,
        deleteTask: deleteTaskTool,
        queryTasks: queryTasksTool
      },
      system: "You are a Todoist assistant. Handle task management through natural language.",
      messages: [{ role: "user", content: message }]
    });

    await ctx.db.insert("conversations", {
      userId: ctx.db.normalizeId("users", userId),
      message,
      response: result.text,
      timestamp: Date.now()
    });

    return { response: result.text, toolCalls: result.toolCalls };
  }
});
```

### Mobile API Endpoints

```typescript
// convex/http.ts
const http = httpRouter();

http.route({
  path: "/chat",
  method: "POST", 
  handler: httpAction(async (ctx, request) => {
    const { message, userId } = await request.json();
    
    const result = await ctx.runAction(api.agents.processMessage, {
      message, userId
    });
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  })
});
```

## Todoist Integration

### API Wrapper

```typescript
// src/todoist-client.ts
class TodoistClient {
  constructor(private token: string) {}

  async createTask(content: string, dueDate?: string, priority?: number) {
    return fetch('https://api.todoist.com/rest/v2/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, due_date: dueDate, priority })
    });
  }
}
```

### Tool Definitions

```typescript
const createTaskTool = tool({
  description: "Create a new task in Todoist",
  parameters: z.object({
    content: z.string(),
    dueDate: z.string().optional(),
    priority: z.number().min(1).max(4).optional()
  }),
  execute: async ({ content, dueDate, priority }) => {
    const client = new TodoistClient(userToken);
    return await client.createTask(content, dueDate, priority);
  }
});
```

## Testing & Development

### Local Development
```bash
# Start Convex dev server
npx convex dev

# Test with curl
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a task to call dentist tomorrow","userId":"user_123"}'
```

### Testing Interface
Open `src/test-interface.html` in browser for simple web-based testing.

## Deployment

### Production Setup
```bash
# Deploy to Convex
npx convex deploy

# Set production environment variables
npx convex env set OPENAI_API_KEY sk-...
npx convex env set CLERK_SECRET_KEY sk_live_...
```

## Documentation References

- **Convex Docs**: https://docs.convex.dev/
- **Vercel AI SDK**: https://ai-sdk.dev/docs
- **Todoist API**: https://developer.todoist.com/rest/v2/
- **Clerk Auth**: https://clerk.com/docs
- **Multi-step Agents**: https://ai-sdk.dev/docs/foundations/agents

## Architecture Decisions

### Why Convex?
- Built-in multi-user support with real-time subscriptions
- TypeScript-first with automatic type safety  
- Seamless WebSocket handling for mobile apps
- Integrated authentication and database

### Why Vercel AI SDK?
- Multi-step reasoning with `maxSteps` parameter
- Structured tool calling with type safety
- Framework-agnostic (works in Convex actions)
- Excellent OpenAI integration

### Mobile-First Design
- HTTP endpoints for universal compatibility
- Stateless API design for mobile reliability
- Real-time updates via WebSocket subscriptions
- No frontend framework dependencies

## Development Workflow

1. **Backend Development**: Focus on Convex functions and AI agent logic
2. **API Testing**: Use test interface and curl commands
3. **Mobile Integration**: Consume HTTP endpoints from any mobile framework
4. **Production Deployment**: Single command deployment with Convex

This architecture provides a robust, scalable foundation for multi-user AI-powered task management that can support any mobile frontend while maintaining sophisticated natural language processing capabilities.

---

## OpenCode Copy2 - AI Coding Agent Reference

**AI coding agent, built for the terminal.** A sophisticated monorepo containing multiple interfaces and deployment targets for an intelligent coding assistant.

### 🎯 Core Technology Stack
- **Runtime**: Bun (JavaScript/TypeScript)
- **TUI**: Go (Terminal User Interface)  
- **Web**: Astro (Static Site Generator)
- **Infrastructure**: SST (Serverless Stack)
- **API Generation**: Stainless

### 🔧 Main Components
1. **CLI Tool** (`packages/opencode/`) - Core AI coding agent
2. **Terminal UI** (`packages/tui/`) - Go-based interactive interface  
3. **Web Interface** (`packages/web/`) - Astro-based web app
4. **Cloud Functions** (`packages/function/`) - Serverless backend
5. **Platform Integrations** (`sdks/`) - GitHub Actions & VS Code extensions

### 🧠 Core Agent Architecture
**Core Logic:**
- `provider/` - AI model integrations (OpenAI, Claude, etc.)
- `session/` - Conversation context and agent state management
- `tool/` - Executable functions (file editing, commands, etc.)
- `mcp/` - Model Context Protocol implementation

**Critical Support:**
- `lsp/` - Language Server Protocol for code understanding
- `app/` - Main orchestration and agent workflow
- `file/` - Core file operations

**Infrastructure:**
- `cli/`, `server/` - User interfaces and API layer
- `auth/`, `permission/` - Security and access control
- `storage/`, `snapshot/` - Data persistence and versioning
- `config/`, `global/` - Configuration management
- `installation/`, `trace/`, `util/` - System utilities
- `ide/` - Editor integrations
- `format/` - Code formatting
- `bus/` - Event system coordination

### ⚡ Key Features
- AI-powered terminal coding agent
- Multi-language support (TypeScript, Go)
- IDE integrations (VS Code)
- GitHub Actions integration
- Web interface for management
- Serverless deployment ready

### 📁 Complete OpenCode Project Structure

```
opencode-copy2/
├── 📁 Root Configuration
│   ├── .editorconfig
│   ├── .gitignore
│   ├── bunfig.toml
│   ├── tsconfig.json
│   ├── opencode.json
│   ├── package.json
│   ├── bun.lock
│   ├── sst.config.ts
│   ├── sst-env.d.ts
│   ├── stainless.yml
│   └── stainless-workspace.json
│
├── 📁 Documentation
│   ├── README.md
│   ├── AGENTS.md
│   ├── STATS.md
│   └── LICENSE
│
├── 📁 Scripts & Installation
│   ├── install (installation script)
│   └── scripts/
│       ├── hooks (bash)
│       ├── hooks.bat (windows)
│       ├── release
│       ├── stainless
│       └── stats.ts
│
├── 📁 GitHub Workflows (.github/)
│   └── workflows/
│       ├── deploy.yml
│       ├── notify-discord.yml
│       ├── opencode.yml
│       ├── publish-github-action.yml
│       ├── publish-vscode.yml
│       ├── publish.yml
│       └── stats.yml
│
├── 📁 Infrastructure (infra/)
│   └── app.ts (SST deployment config)
│
├── 📁 Core Packages (packages/)
│   ├── 📦 opencode/ (Main CLI package - TypeScript/Bun)
│   │   ├── package.json
│   │   ├── bin/ (CLI executables)
│   │   ├── script/ (build scripts)
│   │   ├── test/ (test files)
│   │   └── src/ (Core source code)
│   │       ├── index.ts (main entry)
│   │       ├── app/ (application logic)
│   │       ├── auth/ (authentication)
│   │       ├── bun/ (Bun runtime integration)
│   │       ├── bus/ (event bus)
│   │       ├── cli/ (CLI interface)
│   │       ├── config/ (configuration)
│   │       ├── file/ (file operations)
│   │       ├── flag/ (feature flags)
│   │       ├── format/ (code formatting)
│   │       ├── global/ (global state)
│   │       ├── id/ (ID generation)
│   │       ├── ide/ (IDE integration)
│   │       ├── installation/ (install logic)
│   │       ├── lsp/ (Language Server Protocol)
│   │       ├── mcp/ (Model Context Protocol)
│   │       ├── permission/ (permissions)
│   │       ├── provider/ (AI providers)
│   │       ├── server/ (server logic)
│   │       ├── session/ (session management)
│   │       ├── share/ (sharing functionality)
│   │       ├── snapshot/ (code snapshots)
│   │       ├── storage/ (data storage)
│   │       ├── tool/ (tools integration)
│   │       ├── trace/ (tracing/logging)
│   │       └── util/ (utilities)
│   │
│   ├── 📦 tui/ (Terminal UI - Go)
│   │   ├── go.mod, go.sum
│   │   ├── .goreleaser.yml
│   │   ├── cmd/ (command definitions)
│   │   ├── input/ (input handling)
│   │   ├── internal/ (internal packages)
│   │   └── sdk/ (SDK integration)
│   │
│   ├── 📦 web/ (Web interface - Astro)
│   │   ├── package.json
│   │   ├── astro.config.mjs
│   │   ├── config.mjs
│   │   ├── public/ (static assets)
│   │   └── src/ (web source code)
│   │
│   ├── 📦 function/ (Serverless functions)
│   │   ├── package.json
│   │   └── src/ (function source)
│   │
│   └── 📦 sdk/ (Software Development Kit)
│       └── (SDK code)
│
└── 📁 Platform SDKs (sdks/)
    ├── 📦 github/ (GitHub Action/Integration)
    │   ├── action.yml
    │   ├── package.json
    │   ├── script/ (build scripts)
    │   └── src/ (GitHub integration code)
    │
    └── 📦 vscode/ (VS Code Extension)
        └── (extension code)
```

*This is a reference fork of the OpenCode AI terminal coding agent project.*