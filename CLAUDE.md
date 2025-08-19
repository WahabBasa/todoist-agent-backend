# Claude Development Guide - Todoist Agent Backend

## 🚀 Quick Start - READ THESE FIRST
1. **Project Overview**: Read `README.md` for complete architecture, tech stack, and directory structure
2. **Recent Context**: Check latest devlog in `updates/` folder for recent debugging sessions and lessons learned
3. **MCP Tools Ready**: GitHub + Graphite integrations are working (see devlog 2025-08-01 for setup details)
4. **Documentation Research**: Always use the docs-researcher subagent for any documentation lookup or research tasks

## 📁 Key File Locations
- **Main Project**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend` (current directory)
- **Active Project**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2\` (React 19 + TypeScript frontend with Convex backend)
- **Backend**: `C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2\convex\` folder (Convex functions, schema, agents)
- **Devlogs**: `updates/YYYY-MM-DD_devlog.md` (debugging history and lessons learned)

## 🥞 Development Workflow - Strategic Stacked PRs

### Phase 1: PLAN FIRST (Before Any Coding)
**Use TodoWrite tool to plan feature breakdown:**
```
1. Define the complete feature goal
2. Break into 3-5 logical, independent PRs
3. Map dependencies between PRs
4. Validate each PR can pass CI independently
```

**Planning Template:**
```
Feature: [Name]
Goal: [What we're building]

PR Sequence:
  PR1: [Foundation] - Can be reviewed independently
    ↓
  PR2: [Core Logic] - Builds on PR1
    ↓  
  PR3: [Integration] - Uses PR1+PR2
    ↓
  PR4: [Polish/Tests] - Completes the feature
```

### Phase 2: Execute with Graphite
```bash
# 1. Work on PR1 changes
# 2. Create stacked branch + commit
gt create --all --message "feat(scope): PR1 description"

# 3. Submit PR1
gt submit

# 4. Work on PR2 changes (builds on PR1)
gt create --all --message "feat(scope): PR2 description"

# 5. Submit entire stack
gt submit --stack

# Continue for PR3, PR4...
```

**Key Commands:**
- `gt log` - Visualize your stack
- `gt sync` - Keep stack updated with main
- `gt modify --all` - Address PR feedback and auto-restack

### Stacking Decision Framework

**✅ SHOULD Stack When:**
- PR2 logically builds on PR1's changes
- PRs are small and focused (< 200 lines each)
- Each PR has a clear, single purpose
- Dependency chain is logical and reviewable

**❌ DON'T Stack When:**
- PRs are independent features
- Any PR is too large (> 300 lines)
- Changes affect unrelated parts of codebase
- One PR might be controversial/need major changes

## 🔍 Pre-Development Routine Checks

**STARTUP ROUTINE - ALWAYS CHECK CURRENT DATE FIRST:**
1. **Check Current Date** - Run `date` command (returns format like "Mon, Aug 18, 2025 12:40:05 PM") to verify today's date before any other action
2. **Check Today's Devlog** - Look for devlog matching today's date in `updates/` folder (format: YYYY-MM-DD_devlog.md)
3. **Create Today's Devlog if Missing** - If no devlog exists for today, create empty file `updates/YYYY-MM-DD_devlog.md` and inform user
4. **Review README Architecture** - Understand current system state
5. **Read CSS Design System Files** - Always read these files COMPLETELY for design system context:
   - `ea-ai-main2/ea-ai-main2/src/index.css` - **READ FULL FILE** - Main CSS configuration (Tailwind v4 @theme, ChatGPT grey theme, border radius system, typography)
   - `ea-ai-main2/ea-ai-main2/postcss.config.js` - PostCSS/Tailwind processing pipeline
6. **Architecture Alignment** - Ensure changes fit the React → Convex → AI SDK flow
7. **Check Someday Tasks** - Review `personal/someday/todolist.md` for conditional tasks that may now be ready

**For Feature Development:**
1. **Plan with TodoWrite** - Break features into 3-5 logical, stackable PRs
2. **Validate Stacking Logic** - Ensure each PR can pass CI independently
3. **Check Dependencies** - Map PR dependencies before coding

**📚 Documentation Research Protocol:**
- **ALWAYS use docs-researcher subagent** for any documentation lookup, API reference, or research task
- **Examples of when to use docs-researcher**:
  - Looking up framework APIs (React, Convex, TailwindCSS, etc.)
  - Understanding integration patterns or best practices
  - Finding version-specific implementation guides
  - Researching library compatibility or migration guides
- **Never attempt manual documentation research** - delegate to the specialized subagent

**Quality Assurance:**
1. **File Location Verification** - Confirm working in correct project directory
2. **Schema Compatibility** - Check `ea-ai-main2/ea-ai-main2/convex/schema.ts` for data structure impacts
3. **Frontend Integration** - Consider React frontend implications and component interactions

**Breaking Features into Stacks:**
- **Small, Focused PRs** - Each PR should have a single, clear purpose
- **Logical Dependencies** - Stack PRs that build on each other naturally  
- **Independent Testing** - Each PR should be able to pass CI on its own

## 📋 Real-World Stacking Examples

### Example 1: Adding New AI Agent Capability
```
Feature: Add task priority management to AI agent
Goal: Users can set/update task priorities via natural language

PR Sequence:
  PR1: Add priority field to Convex schema + migration
    ↓
  PR2: Update AI agent tools to handle priority operations  
    ↓
  PR3: Add priority UI components to React frontend
    ↓
  PR4: Add tests and error handling

Why this works: Each PR is reviewable independently, but builds logically
```

### Example 2: Backend + Frontend Integration
```
Feature: Add task categories functionality
Goal: Organize tasks by custom categories

PR Sequence:
  PR1: Backend - Add categories to Convex schema + CRUD functions
    ↓  
  PR2: Backend - Update AI agent to recognize category commands
    ↓
  PR3: Frontend - Add category selection UI in React app
    ↓
  PR4: Integration - Connect frontend category UI to backend API

Why this works: Backend stable before frontend depends on it
```

### Example 3: When NOT to Stack
```
❌ Bad Example:
  PR1: Add user authentication  
  PR2: Fix mobile app navigation bug
  PR3: Update documentation

Why bad: These are independent changes, no logical dependencies
Better: Create 3 separate PRs, not a stack
```

## 🏗️ Project Architecture (Summary from README)
```
React Frontend → Convex Backend → Claude AI (Anthropic SDK) → Convex Database
                      ↓
            Real-time Updates & Authentication
```

## 🔧 Debugging Guidelines (From Devlogs)
- **Component Loading Issues**: Always verify which files are actually loaded by the React router
- **TypeScript Compilation**: Check for smart quotes and Unicode characters breaking builds
- **MCP Connection Issues**: Use CMD.exe wrapper for Windows path resolution
- **AI SDK Integration**: Ensure proper message format for CoreMessage interface

## 🔒 User Base & Security Monitoring

**User Detection Trigger:**
- **Monitor Devlogs**: Check `updates/` for mentions of "users", "signups", "payments", or user metrics
- **When Users Detected**: Review `personal/someday/todolist.md` for security-sensitive tasks
- **Security Protocol**: Any browser automation or advanced tooling requires security review first

**AgentDeskAI Setup Trigger:**
- **Condition**: Application has confirmed paying users (documented in devlogs)
- **Action Required**: 
  1. Run security audit on current codebase
  2. Review browser automation security implications
  3. Test AgentDeskAI MCP in isolated environment
  4. Set up with: `claude mcp add browser-tools npx -- @agentdeskai/browser-tools-mcp@1.2.0`

## 📚 Reference Links
- **README.md** - Complete project documentation
- **updates/** - Historical debugging context and lessons learned
- **ea-ai-main2/ea-ai-main2/convex/schema.ts** - Database schema (users, tasks, projects, conversations)

---
*This guide organizes existing documentation - always refer to README.md for complete details*

**Last Updated**: August 1, 2025 - Enhanced with strategic planning elements from Graphite blog