import { z } from "zod";

// Agent mode defines how the agent can be used in the system
export const AgentMode = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof AgentMode>;

// Permission levels for different capabilities
export const Permission = z.enum(["allow", "deny", "ask"]);
export type Permission = z.infer<typeof Permission>;

// Agent permissions structure
export const AgentPermissions = z.object({
  // File editing capabilities
  edit: Permission,
  // Web fetching permissions
  webfetch: Permission,
  // Bash command execution (can be granular per command pattern)
  bash: z.record(z.string(), Permission),
});
export type AgentPermissions = z.infer<typeof AgentPermissions>;

// Core agent configuration
export const AgentConfig = z.object({
  // Unique identifier for the agent
  name: z.string(),
  // Human-readable description
  description: z.string(),
  // How this agent can be invoked
  mode: AgentMode,
  // Whether this is a built-in system agent
  builtIn: z.boolean(),
  // What permissions this agent has
  permissions: AgentPermissions,
  // Which tools this agent can access
  tools: z.record(z.string(), z.boolean()),
  // Agent-specific options/parameters
  options: z.record(z.string(), z.any()),
  // Custom system prompt for this agent (optional)
  systemPrompt: z.string().optional(),
  // Temperature override for this agent
  temperature: z.number().optional(),
  // Model configuration override
  model: z.object({
    providerId: z.string(),
    modelId: z.string(),
  }).optional(),
});
export type AgentConfig = z.infer<typeof AgentConfig>;

// Agent registry type
export const AgentRegistry = z.record(z.string(), AgentConfig);
export type AgentRegistry = z.infer<typeof AgentRegistry>;

// Session delegation context
export const DelegationContext = z.object({
  // Parent session that delegated this task
  parentSessionId: z.string(),
  // The original task/request that was delegated
  delegatedTask: z.string(),
  // When this delegation was created
  createdAt: z.number(),
  // Current status of the delegation
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  // Agent that's handling this delegated task
  agentName: z.string(),
});
export type DelegationContext = z.infer<typeof DelegationContext>;

// Extended conversation info with agent context
export const ConversationWithAgent = z.object({
  // Standard conversation fields (extended from existing schema)
  sessionId: z.string(),
  // Which agent is handling this conversation
  agentMode: AgentMode,
  agentName: z.string(),
  // Delegation context if this is a subagent session
  delegation: DelegationContext.optional(),
  // Parent session if this is a child session
  parentSessionId: z.string().optional(),
});
export type ConversationWithAgent = z.infer<typeof ConversationWithAgent>;