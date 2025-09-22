# TaskAI - Production-Ready Intelligent Task Management System

TaskAI is an intelligent executive assistant built in the active project at `ea-ai-main2/ea-ai-main2/`. It leverages Claude 3.5 Sonnet/Haiku for AI capabilities including behavioral learning via internal todo workflows and multi-layer caching for efficiency. Performance features real-time sync through Convex. Integrations include Google Calendar (event management), Todoist (task/project ops), and GitHub/MCP tools. The design system uses a ChatGPT-inspired grey theme with TailwindCSS v4.

## System Architecture

### Backend Structure (convex/)

Key functions in `ai.ts` handle AI orchestration with tools for integrations. Schema defines `chatSessions` (modes/subagents, auth/sessions via Clerk tokenIdentifier), `conversations` (tool-enabled messages), `aiInternalTodos`, and integration tokens. Auth uses Clerk; sessions support primary/subagent flows.

### Frontend Structure (src/)

React components include chat interface (`ChatView.tsx` with `Chat.tsx`, message rendering, input), UI primitives (`ui/` with Tailwind), hooks (`use-auto-scroll`, etc.), and views (`SettingsView.tsx` for integrations).

## Tech Stack

React 19, TypeScript, Vite, Convex (realtime backend), Anthropic SDK (via OpenRouter).

## Quick Start

1. `npm install`

2. Set env: `CONVEX_URL`, `CONVEX_DEPLOYMENT_URL`, `OPENROUTER_API_KEY` (for Anthropic models).

3. `npm run dev` (no auto-start; deploy Convex separately via dashboard/cli).

## Usage Examples

- Chat: "Create tasks for project X" → AI plans/executes via Todoist.

- Calendar: "Schedule meeting tomorrow" → Creates Google event.

- Settings: Connect Todoist/Google accounts.
