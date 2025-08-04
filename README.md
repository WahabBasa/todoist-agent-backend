# Todoist Agent Backend

A multi-user AI agent system for natural language Todoist task management, built with Convex backend and Vercel AI SDK.

## Project Overview

This system provides a mobile-agnostic backend that enables natural language interaction with Todoist through AI agents. Users can create, read, update, and delete tasks using conversational interfaces across any frontend platform.

**✅ Current Status**: Fully functional multi-user EA AI system with MCP integrations working (GitHub + Graphite). The EA-AI-main2 web application provides:
- Clean, minimal React + Vite frontend with modern authentication
- Convex Auth integration with JWT security
- Professional UI design matching modern standards
- Real-time backend communication via Convex
- Proven development workflow with strategic stacked PRs
- Complete debugging methodologies documented for future development

## Directory Structure & Access Methods

### Working Directories

This project contains **two main working directories**:

#### 1. EA-AI-main2 (Primary Frontend)
- **Path**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2`
- **Access**: Navigate to the main project directory for development
- **Contents**: React + Vite frontend with Convex backend and Convex Auth
- **Usage**: **PRIMARY** EA AI development directory with modern authentication
- **Deployment**: Convex deployment "peaceful-boar-923"
- **Status**: ✅ Active - Clean minimal UI with working authentication

#### 2. Legacy Backend Directory
- **Path**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\convex\`
- **Access**: Legacy backend functions (if needed for reference)
- **Contents**: Original Convex functions and schema
- **Usage**: Reference implementation, superseded by EA-AI-main2
- **Status**: 📚 Reference Only

### Important Access Notes

```bash
# ✅ PRIMARY - EA-AI-main2 development
cd ea-ai-main2/ea-ai-main2/
npm install
npm run dev        # Frontend (localhost:5173)
npx convex dev     # Backend (peaceful-boar-923)

# 📚 REFERENCE - Legacy backend (if needed)
cd convex/
npx convex dev
```

### Related Projects

- **EA AI Frontend2**: [WahabBasa/ea-ai-frontend2](https://github.com/WahabBasa/ea-ai-frontend2) - React Native Expo mobile app (reference implementation)
- **React Native Frontend**: [WahabBasa/todoapp](https://github.com/WahabBasa/todoapp) - React Native Todoist clone
- **OpenCode Fork**: [WahabBasa/opencode-copy2](https://github.com/WahabBasa/opencode-copy2) - AI coding agent for terminal (study reference)

## EA-AI-main2 Frontend Architecture

### React + Vite Web Application

The primary frontend is a modern React web application with Convex integration:

**Key Features:**
- **Clean Minimal UI**: Professional design matching modern authentication standards
- **Convex Auth**: JWT-based authentication with proper security
- **Real-time Backend**: WebSocket integration with Convex deployment
- **TypeScript**: Full type safety and developer experience
- **Modern Tooling**: Vite for fast development and builds
- **Strategic Development**: Stacked PR workflow with Graphite integration

**Location**: `ea-ai-main2/ea-ai-main2/`

**Development Workflow:**
```bash
# Navigate to EA-AI-main2
cd ea-ai-main2/ea-ai-main2/

# Install dependencies
npm install

# Start development servers
npm run dev     # Frontend (localhost:5173)
npx convex dev  # Backend (peaceful-boar-923)
```

**Architecture Pattern:**
- **Frontend**: React + Vite with clean component architecture
- **Backend**: Convex functions with real-time subscriptions
- **Authentication**: Convex Auth with JWT tokens
- **State Management**: React hooks and Convex queries
- **Deployment**: Convex Cloud with automated deployments

### Core Architecture

```
EA-AI-main2 Web App → HTTP/WebSocket → Convex Backend → Vercel AI SDK → Task Management
                                       ↓
                                  Convex Database (Users + Conversations + Activity)
```

## Technical Stack

- **Backend Framework**: Convex (Real-time database + serverless functions)
- **AI Processing**: Vercel AI SDK with OpenAI GPT-4
- **Task Storage**: Mobile app SQLite database (on-device)
- **Authentication**: Clerk (integrated with Convex)
- **Language**: TypeScript
- **Testing**: Simple HTML interface + REST clients

## Key Features

### Multi-User Architecture
- **Isolated User Sessions**: Each user's task data stored locally on their device
- **Concurrent Processing**: Built-in support for multiple simultaneous users
- **Real-time Updates**: WebSocket-based live synchronization for chat conversations
- **Secure Authentication**: Per-user authentication via Clerk integration

### AI Agent Capabilities
- **Natural Language Processing**: Convert conversational input to mobile app task operations
- **Multi-step Reasoning**: Complex task breakdown using `maxSteps` parameter
- **CRUD Operations**: Create, read, update, delete tasks in mobile app's SQLite database
- **Context Awareness**: Maintain conversation history and user preferences in Convex

## Project Structure

```
todoist-agent-backend/
├── ea-ai-main2/ea-ai-main2/    # ✅ PRIMARY FRONTEND
│   ├── src/                    # React components and pages
│   ├── convex/                 # Backend functions and schema
│   │   ├── auth.ts             # Convex Auth configuration
│   │   ├── myFunctions.ts      # Core backend logic
│   │   └── schema.ts           # Database schema
│   ├── package.json
│   └── vite.config.ts
├── convex/                      # 📚 LEGACY REFERENCE
│   ├── schema.ts           # Original schema (users + conversations + activity)
│   ├── agents.ts           # AI agent logic with Vercel AI SDK
│   ├── todoist.ts          # Task API integration functions
│   └── http.ts             # HTTP endpoints
├── updates/                     # Development logs and debugging history
├── CLAUDE.md                    # Development guidelines and workflow
└── README.md                    # This file
```

## Development Setup

### Prerequisites
- Node.js 18+
- Convex CLI (`npm i -g convex`)
- OpenAI API key (for AI functionality)
- Modern web browser

### Installation

```bash
# Clone and setup
git clone <repository>
cd todoist-agent-backend

# Navigate to EA-AI-main2
cd ea-ai-main2/ea-ai-main2/

# Install dependencies
npm install

# Start development
npm run dev     # Frontend (localhost:5173)
npx convex dev  # Backend (separate terminal)
```

### Environment Configuration

Environment variables are managed via Convex Dashboard:
```bash
# Set via Convex CLI
npx convex env set OPENAI_API_KEY sk-...
npx convex env set SITE_URL http://localhost:5173

# JWT keys are auto-generated during auth setup
```

### Database Schema

```typescript
// ea-ai-main2/ea-ai-main2/convex/schema.ts (Active)
export default defineSchema({
  users: defineTable({
    // Convex Auth fields (auto-managed)
  }),
  
  // Add custom tables as needed
});

// Legacy schema reference (convex/schema.ts)
export default defineSchema({
  users: defineTable({
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    todoistToken: v.optional(v.string()),
    preferences: v.object({
      timezone: v.optional(v.string()),
      defaultProject: v.optional(v.string())
    })
  }).index("by_firebase_uid", ["firebaseUid"]),

  conversations: defineTable({
    userId: v.string(),
    message: v.string(),
    response: v.string(),
    timestamp: v.number(),
    toolCalls: v.optional(v.array(v.any()))
  }).index("by_user", ["userId"]),

  userActivity: defineTable({
    userId: v.string(),
    totalMessages: v.number(),
    lastActiveAt: v.number(),
    // ... activity tracking fields
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

### Web-First Design
- React + Vite for modern web development
- Convex real-time subscriptions for live updates
- Clean authentication with Convex Auth
- TypeScript for full type safety
- Strategic development with stacked PRs

## Development Workflow

1. **EA-AI-main2 Development**: Primary focus on React frontend with Convex backend
2. **Stacked PR Strategy**: Use TodoWrite + Graphite for organized feature development
3. **Real-time Testing**: Live updates via Convex subscriptions during development
4. **Production Deployment**: Single command deployment with Convex Cloud
5. **Legacy Reference**: Use original convex/ directory for reference implementations

This architecture provides a robust, scalable foundation for multi-user AI-powered applications with modern web technologies and proven development workflows.

---

## Development Guidelines & Lessons Learned

Based on extensive debugging sessions and architectural evolution, this section documents critical patterns and best practices to prevent common pitfalls and ensure successful development.

### 🎯 Core Development Principles

#### 1. Navigation Architecture Verification
**Critical Rule**: Always verify which files your navigation system actually loads.

**Common Pitfall**: File structure doesn't always match routing structure
- ✅ **Correct**: Check routing configuration to see which files are active
- ❌ **Wrong**: Assume files in parent directories are used over tab directories
- **Example**: `(tabs)/chat.tsx` takes precedence over `(authenticated)/chat.tsx` in Expo Router

**Verification Steps**:
1. Check navigation/routing configuration files (`_layout.tsx`, navigation setup)
2. Trace route definitions to actual file paths
3. Test UI changes on device to confirm correct files are loading

#### 2. Native Module Dependency Strategy
**Core Philosophy**: Prioritize functionality over aesthetics when native modules cause issues.

**Dependency Risk Assessment**:
- 🟢 **Low Risk**: Standard React Native components, core Expo modules
- 🟡 **Medium Risk**: Popular, well-maintained native modules (react-native-screens)
- 🔴 **High Risk**: Complex native modules with C++ compilation (expo-blur, react-native-reanimated)

**Native Module Guidelines**:
- Always have fallback implementations using standard View components
- Test on device early - simulators hide native module registration issues
- Consider build memory requirements (heavy modules can require 4GB+ RAM)
- Use `expo-doctor` to check for compatibility issues

**Alternative Patterns for Modern UI**:
```typescript
// Instead of expo-blur BlurView
<View style={{
  backgroundColor: 'rgba(248, 248, 248, 0.95)',
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: '#e0e0e0'
}}>
  {/* Your content */}
</View>

// Instead of complex gesture handlers
<TouchableOpacity onPress={handleAction}>
  {/* Simple, reliable touch handling */}
</TouchableOpacity>
```

#### 3. Version Management & Compatibility
**Strategy**: Conservative version choices that prioritize stability over latest features.

**Version Selection Rules**:
- ✅ Use tested version combinations from successful projects
- ✅ Stick with Expo SDK LTS versions when possible
- ❌ Avoid bleeding-edge versions in production projects
- ❌ Don't downgrade working systems based on isolated errors

**Working Configuration Matrix** (Verified Stable):
```json
{
  "expo": "~53.0.20",
  "react": "19.0.0", 
  "react-native": "0.79.5",
  "expo-router": "~5.1.4",
  "@clerk/clerk-expo": "^2.14.12"
}
```

### 🚨 Debugging Methodology

#### Systematic Problem-Solving Approach

**1. Error Categorization**
- **Build Errors**: Compilation failures, dependency conflicts
- **Runtime Errors**: App crashes, native module failures  
- **UX Issues**: Navigation problems, UI rendering issues

**2. Root Cause Analysis Process**
```
Error Occurs → Reproduce Consistently → Check Recent Changes → 
Verify File Structure → Test Component Isolation → Apply Minimal Fix
```

**3. Debug Information Gathering**
- Full error stack traces with file paths and line numbers
- Device logs vs simulator behavior differences
- Network request/response debugging for backend integration
- Bundle analysis for dependency-related issues

#### Common Issue Decision Tree

**Navigation/Routing Issues**:
1. Check which files are actually being loaded by navigation system
2. Verify route definitions match intended file structure  
3. Test navigation flow on device with debug logging

**Native Module Crashes**:
1. Identify specific native module causing crash
2. Check version compatibility with current Expo SDK
3. Implement fallback using standard components
4. Consider build system memory requirements

**Authentication Problems**:
1. Verify JWT token generation and validation
2. Check network connectivity and API endpoints
3. Simplify OAuth flows by removing custom configurations
4. Test with minimal authentication implementation first

### 🎨 Modern UI Patterns (Native Module Safe)

#### ChatGPT-Style Interface Components
```typescript
// Message Layout (No gesture handlers needed)
const MessageItem = ({ role, content }) => (
  <View style={styles.messageRow}>
    {role === 'bot' ? <BotAvatar /> : <UserAvatar />}
    <View style={styles.messageContent}>
      <Text style={styles.messageText}>{content}</Text>
    </View>
  </View>
);

// Input Container (No BlurView needed)
const MessageInput = () => (
  <View style={styles.inputContainer}>
    <TextInput style={styles.input} />
    <TouchableOpacity style={styles.sendButton}>
      <Ionicons name="arrow-up-circle" />
    </TouchableOpacity>
  </View>
);
```

#### Performance Optimizations
- Use `FlashList` instead of `FlatList` for long lists
- Implement `Role` enum systems instead of boolean flags
- Utilize absolute positioning for input areas (better keyboard handling)
- Apply proper `estimatedItemSize` for FlashList performance

### 📱 Platform-Specific Considerations

#### Android Development
- **Memory Management**: Build processes can require 2-4GB RAM
- **Native Modules**: More prone to ViewManager registration issues
- **Testing**: Always test on actual device, not just emulator

#### iOS Development  
- **Authentication**: OAuth flows work more reliably
- **UI Components**: Better support for modal presentations
- **Performance**: Generally better with complex UI components

### 🔧 Build & Deployment Best Practices

#### Development Environment Setup
1. **Memory Allocation**: Ensure adequate system RAM (8GB+ recommended)
2. **Dependency Installation**: Use `--legacy-peer-deps` for version conflicts
3. **Clean Builds**: Regular `expo prebuild --clean` to resolve native issues
4. **Version Control**: Track working configurations in documentation

#### Production Deployment Checklist
- [ ] All native modules tested on target devices
- [ ] Authentication flows validated end-to-end
- [ ] Memory usage profiled during build process
- [ ] Navigation routes verified with actual user flows
- [ ] Fallback implementations tested for critical native modules

### ⚠️ Anti-Patterns to Avoid

#### What NOT to Do
1. **Never** modify working systems based on single error screenshots without reproduction
2. **Never** add complex native modules without testing build memory requirements
3. **Never** assume file structure matches routing configuration
4. **Never** implement custom authentication when OAuth fails - simplify instead
5. **Never** ignore device testing in favor of simulator-only development

#### Red Flags in Development
- Build processes requiring >4GB RAM
- Navigation changes not appearing on device
- Native module errors mentioning ViewManager or expo-modules-core
- Authentication errors with network timeouts
- Dependency conflicts requiring multiple `--force` installations

### 📚 Reference Documentation

**Essential Reading**:
- [Expo Router File-Based Routing](https://docs.expo.dev/router/introduction/) - Navigation architecture
- [React Native New Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page) - Native module compatibility
- [Clerk React Native Integration](https://clerk.com/docs/quickstarts/expo) - Authentication best practices
- [Metro Bundler Configuration](https://metrobundler.dev/docs/configuration) - Build optimization

**Debugging Resources**:
- [Expo Development Build Troubleshooting](https://docs.expo.dev/develop/development-builds/troubleshooting/)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Android Studio Profiler](https://developer.android.com/studio/profile) - Memory usage analysis

### 🔥 Quick Reference - Common Issues & Solutions

#### "UI Changes Not Appearing on Device"
**Cause**: Navigation routing pointing to wrong files  
**Solution**: 
1. Check `_layout.tsx` routing configuration
2. Verify which files are actually active (e.g., `(tabs)/` vs parent directory)
3. Test changes in the correct file path

#### "No ViewManager found for ExpoBlurView"
**Cause**: Native module not properly linked  
**Solution**:
1. Replace with standard `<View>` + `backgroundColor: 'rgba(248, 248, 248, 0.95)'`
2. Run `expo prebuild --clean` to regenerate native code
3. Consider if blur effect is worth the complexity

#### "Build Memory Exhaustion"
**Cause**: Complex native modules requiring 4GB+ RAM  
**Solution**:
1. Review dependency list for heavy modules (react-native-reanimated, expo-blur)
2. Implement lightweight alternatives using standard components
3. Adjust Gradle memory settings: `org.gradle.jvmargs=-Xmx2048m`

#### "Authentication Network Failures"
**Cause**: Complex OAuth configuration conflicts  
**Solution**:
1. Simplify OAuth flow - remove custom `redirectUrl` parameters
2. Use default Expo linking instead of custom URL schemes
3. Test with minimal authentication implementation first

#### "Navigation Stack/Tab Confusion"
**Cause**: Mixed navigation patterns  
**Solution**:
1. Use pure Expo Router file-based routing
2. Organize with `(authenticated)` groups and proper `_layout.tsx` hierarchy
3. Avoid mixing React Navigation with Expo Router

#### Current Working Architecture (EA AI Frontend2)
```bash
ea-ai-frontend2/
├── app/
│   ├── _layout.tsx                 # Root with Clerk auth
│   ├── index.tsx                   # Login screen
│   └── (authenticated)/
│       ├── _layout.tsx             # Auth wrapper with modal configs
│       ├── (tabs)/
│       │   ├── _layout.tsx         # Tab navigation (Chat→Tasks→Settings)
│       │   ├── chat.tsx            # ✅ ACTIVE - Modern ChatGPT UI
│       │   ├── tasks.tsx           # Task list with SQLite
│       │   └── settings.tsx        # User settings
│       ├── task-detail.tsx         # Modal task creation
│       └── date-select.tsx         # Date picker modal
├── components/
│   ├── MessageItem.tsx             # Role-based message display
│   ├── MessageInput.tsx            # ✅ FIXED - Standard View (no BlurView)
│   ├── MessageIdeas.tsx            # Task suggestion cards
│   ├── TaskRow.tsx                 # SQLite task display
│   └── Fab.tsx                     # Floating action button
├── services/
│   └── TaskService.ts              # Raw SQL operations (no ORM)
└── types/
    └── Task.ts                     # TypeScript interfaces
```

**Verified Working Versions**:
- Expo SDK: `~53.0.20`
- React: `19.0.0`
- React Native: `0.79.5`
- Clerk: `^2.14.12`
- expo-router: `~5.1.4`

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