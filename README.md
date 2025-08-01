# Todoist Agent Backend

A multi-user AI agent system for natural language Todoist task management, built with Convex backend and Vercel AI SDK.

## Project Overview

This system provides a mobile-agnostic backend that enables natural language interaction with Todoist through AI agents. Users can create, read, update, and delete tasks using conversational interfaces across any frontend platform.

**✅ Current Status**: Fully functional with modern ChatGPT-style UI implemented and MCP integrations working (GitHub + Graphite). The EA AI Frontend2 mobile app successfully demonstrates:
- Modern linear message layout with avatars and role-based messaging
- FlashList performance optimization for smooth scrolling
- Lightweight architecture avoiding complex native modules
- Working authentication via Clerk with JWT integration
- Complete task management with local SQLite storage
- Proven debugging methodologies documented for future development

## Directory Structure & Access Methods

### Working Directories

This project contains **two distinct working directories** with different access patterns:

#### 1. Main Project Directory (Current Working Directory)
- **Path**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend`
- **Access**: Standard `cd` commands work, this is the current working directory
- **Contents**: Convex backend, web frontend, mobile apps, Chrome extension
- **Usage**: All development commands, git operations, and file modifications

#### 2. EA AI Frontend Directory
- **Path**: `C:\Users\AtheA\Desktop\ea-ai-frontend2\` (separate location)
- **Access**: Navigate to separate directory outside main project
- **Contents**: React Native Expo app for EA AI integration (optimized build)
- **Repository**: [WahabBasa/ea-ai-frontend2](https://github.com/WahabBasa/ea-ai-frontend2)
- **Usage**: Primary mobile frontend development directory (latest working version)

### Important Access Notes

```bash
# ✅ WORKS - Main project directory
cd convex/
cat schema.ts
npm install

# ✅ WORKS - EA AI Frontend directory  
cd C:\Users\AtheA\Desktop\ea-ai-frontend2\
npm install
npx expo start

# ✅ WORKS - Backend development
cd ../
npx convex dev
```

### Related Projects

- **EA AI Frontend2**: [WahabBasa/ea-ai-frontend2](https://github.com/WahabBasa/ea-ai-frontend2) - React Native Expo app for EA AI integration (main mobile frontend - optimized build)
- **React Native Frontend**: [WahabBasa/todoapp](https://github.com/WahabBasa/todoapp) - React Native Todoist clone that consumes this backend
- **OpenCode Fork**: [WahabBasa/opencode-copy2](https://github.com/WahabBasa/opencode-copy2) - AI coding agent for terminal (forked for study)

## Mobile App Architecture

### EA AI Frontend - React Native Expo

The primary mobile frontend is built with React Native and Expo, providing cross-platform iOS and Android support:

**Key Features:**
- **Cross-Platform**: Single codebase for iOS and Android
- **Expo Integration**: Rapid development and deployment
- **TypeScript**: Full type safety and developer experience  
- **Real-time Updates**: WebSocket integration with Convex backend
- **Natural Language Interface**: AI-powered task management through conversational UI

**Repository**: [WahabBasa/ea-ai-frontend2](https://github.com/WahabBasa/ea-ai-frontend2)

**Development Workflow:**
```bash
# Navigate to frontend
cd C:\Users\AtheA\Desktop\ea-ai-frontend2\

# Install dependencies
npm install

# Start development server
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android
```

**Architecture Pattern:**
- **API Integration**: HTTP/WebSocket communication with Convex backend
- **State Management**: React hooks and context for UI state
- **Navigation**: Expo Router for type-safe navigation
- **Styling**: Native components with responsive design
- **Authentication**: Clerk integration for user management

### Core Architecture

```
Mobile Apps (Any Framework) → HTTP/WebSocket → Convex Backend → Vercel AI SDK → Mobile App SQLite
                                              ↓
                                         Convex Database (Users + Conversations Only)
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
├── convex/
│   ├── schema.ts           # Database schema definitions (users + conversations)
│   ├── agents.ts           # AI agent logic with Vercel AI SDK
│   ├── todoist.ts          # Task API integration functions (for mobile app)
│   ├── http.ts             # HTTP endpoints for mobile clients
│   └── auth.ts             # User authentication handlers
├── src/
│   ├── test-interface.html # Simple web testing interface
│   └── todoist-client.ts   # Task API wrapper (will be replaced with mobile app API)
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