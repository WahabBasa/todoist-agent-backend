/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai_agents_registry from "../ai/agents/registry.js";
import type * as ai_agents_types from "../ai/agents/types.js";
import type * as ai_assistantMessage_parseAssistantMessage from "../ai/assistantMessage/parseAssistantMessage.js";
import type * as ai_caching from "../ai/caching.js";
import type * as ai_langfuse_client from "../ai/langfuse/client.js";
import type * as ai_langfuse_logger from "../ai/langfuse/logger.js";
import type * as ai_prompts_execution_prompt from "../ai/prompts/execution-prompt.js";
import type * as ai_prompts_general_prompt from "../ai/prompts/general-prompt.js";
import type * as ai_prompts_planning_prompt from "../ai/prompts/planning-prompt.js";
import type * as ai_prompts_sections_capabilities from "../ai/prompts/sections/capabilities.js";
import type * as ai_prompts_sections_customSystemPrompt from "../ai/prompts/sections/customSystemPrompt.js";
import type * as ai_prompts_sections_index from "../ai/prompts/sections/index.js";
import type * as ai_prompts_sections_modes from "../ai/prompts/sections/modes.js";
import type * as ai_prompts_sections_objective from "../ai/prompts/sections/objective.js";
import type * as ai_prompts_sections_rules from "../ai/prompts/sections/rules.js";
import type * as ai_prompts_sections_systemInfo from "../ai/prompts/sections/systemInfo.js";
import type * as ai_prompts_sections_toolUseGuidelines from "../ai/prompts/sections/toolUseGuidelines.js";
import type * as ai_prompts_system from "../ai/prompts/system.js";
import type * as ai_prompts_zen from "../ai/prompts/zen.js";
import type * as ai_session from "../ai/session.js";
import type * as ai_simpleMessages from "../ai/simpleMessages.js";
import type * as ai_state_ConversationState from "../ai/state/ConversationState.js";
import type * as ai_system from "../ai/system.js";
import type * as ai_toolRegistry from "../ai/toolRegistry.js";
import type * as ai_tools_ToolRepetitionDetector from "../ai/tools/ToolRepetitionDetector.js";
import type * as ai_tools_googleCalendar from "../ai/tools/googleCalendar.js";
import type * as ai_tools_internal from "../ai/tools/internal.js";
import type * as ai_tools_simpleDelegation from "../ai/tools/simpleDelegation.js";
import type * as ai_tools_taskTool from "../ai/tools/taskTool.js";
import type * as ai_tools_todoist from "../ai/tools/todoist.js";
import type * as ai_tools_utils from "../ai/tools/utils.js";
import type * as ai_tracing_enhanced_analysis_promptAnalysis from "../ai/tracing/enhanced/analysis/promptAnalysis.js";
import type * as ai_tracing_enhanced_attributes_promptAttributes from "../ai/tracing/enhanced/attributes/promptAttributes.js";
import type * as ai_tracing_enhanced_spans_enhancedPromptSpans from "../ai/tracing/enhanced/spans/enhancedPromptSpans.js";
import type * as ai_tracing_exporters_consoleExporter from "../ai/tracing/exporters/consoleExporter.js";
import type * as ai_tracing_index from "../ai/tracing/index.js";
import type * as ai_tracing_spans_messageSpans from "../ai/tracing/spans/messageSpans.js";
import type * as ai_tracing_spans_promptSpans from "../ai/tracing/spans/promptSpans.js";
import type * as ai_tracing_spans_toolCallSpans from "../ai/tracing/spans/toolCallSpans.js";
import type * as ai_tracing_tracer from "../ai/tracing/tracer.js";
import type * as ai_tracing_utils_spanUtils from "../ai/tracing/utils/spanUtils.js";
import type * as ai from "../ai.js";
import type * as aiInternalTodos from "../aiInternalTodos.js";
import type * as chatSessions from "../chatSessions.js";
import type * as cleanup from "../cleanup.js";
import type * as cleanupOrphans from "../cleanupOrphans.js";
import type * as cleanupTables from "../cleanupTables.js";
import type * as clerk from "../clerk.js";
import type * as conversations from "../conversations.js";
import type * as customSystemPrompts from "../customSystemPrompts.js";
import type * as debug_cleanupDuplicateTokens from "../debug/cleanupDuplicateTokens.js";
import type * as debug_fixTokenIdentifier from "../debug/fixTokenIdentifier.js";
import type * as debug_sessionMigration from "../debug/sessionMigration.js";
import type * as debug_todoistDebug from "../debug/todoistDebug.js";
import type * as googleCalendar_auth from "../googleCalendar/auth.js";
import type * as http from "../http.js";
import type * as migrateTokens from "../migrateTokens.js";
import type * as migrations_backfillSessionTimestamps from "../migrations/backfillSessionTimestamps.js";
import type * as todoist_BatchTodoistHandler from "../todoist/BatchTodoistHandler.js";
import type * as todoist_auth from "../todoist/auth.js";
import type * as todoist_integration from "../todoist/integration.js";
import type * as todoist_syncApi from "../todoist/syncApi.js";
import type * as todoist_userAccess from "../todoist/userAccess.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ai/agents/registry": typeof ai_agents_registry;
  "ai/agents/types": typeof ai_agents_types;
  "ai/assistantMessage/parseAssistantMessage": typeof ai_assistantMessage_parseAssistantMessage;
  "ai/caching": typeof ai_caching;
  "ai/langfuse/client": typeof ai_langfuse_client;
  "ai/langfuse/logger": typeof ai_langfuse_logger;
  "ai/prompts/execution-prompt": typeof ai_prompts_execution_prompt;
  "ai/prompts/general-prompt": typeof ai_prompts_general_prompt;
  "ai/prompts/planning-prompt": typeof ai_prompts_planning_prompt;
  "ai/prompts/sections/capabilities": typeof ai_prompts_sections_capabilities;
  "ai/prompts/sections/customSystemPrompt": typeof ai_prompts_sections_customSystemPrompt;
  "ai/prompts/sections/index": typeof ai_prompts_sections_index;
  "ai/prompts/sections/modes": typeof ai_prompts_sections_modes;
  "ai/prompts/sections/objective": typeof ai_prompts_sections_objective;
  "ai/prompts/sections/rules": typeof ai_prompts_sections_rules;
  "ai/prompts/sections/systemInfo": typeof ai_prompts_sections_systemInfo;
  "ai/prompts/sections/toolUseGuidelines": typeof ai_prompts_sections_toolUseGuidelines;
  "ai/prompts/system": typeof ai_prompts_system;
  "ai/prompts/zen": typeof ai_prompts_zen;
  "ai/session": typeof ai_session;
  "ai/simpleMessages": typeof ai_simpleMessages;
  "ai/state/ConversationState": typeof ai_state_ConversationState;
  "ai/system": typeof ai_system;
  "ai/toolRegistry": typeof ai_toolRegistry;
  "ai/tools/ToolRepetitionDetector": typeof ai_tools_ToolRepetitionDetector;
  "ai/tools/googleCalendar": typeof ai_tools_googleCalendar;
  "ai/tools/internal": typeof ai_tools_internal;
  "ai/tools/simpleDelegation": typeof ai_tools_simpleDelegation;
  "ai/tools/taskTool": typeof ai_tools_taskTool;
  "ai/tools/todoist": typeof ai_tools_todoist;
  "ai/tools/utils": typeof ai_tools_utils;
  "ai/tracing/enhanced/analysis/promptAnalysis": typeof ai_tracing_enhanced_analysis_promptAnalysis;
  "ai/tracing/enhanced/attributes/promptAttributes": typeof ai_tracing_enhanced_attributes_promptAttributes;
  "ai/tracing/enhanced/spans/enhancedPromptSpans": typeof ai_tracing_enhanced_spans_enhancedPromptSpans;
  "ai/tracing/exporters/consoleExporter": typeof ai_tracing_exporters_consoleExporter;
  "ai/tracing/index": typeof ai_tracing_index;
  "ai/tracing/spans/messageSpans": typeof ai_tracing_spans_messageSpans;
  "ai/tracing/spans/promptSpans": typeof ai_tracing_spans_promptSpans;
  "ai/tracing/spans/toolCallSpans": typeof ai_tracing_spans_toolCallSpans;
  "ai/tracing/tracer": typeof ai_tracing_tracer;
  "ai/tracing/utils/spanUtils": typeof ai_tracing_utils_spanUtils;
  ai: typeof ai;
  aiInternalTodos: typeof aiInternalTodos;
  chatSessions: typeof chatSessions;
  cleanup: typeof cleanup;
  cleanupOrphans: typeof cleanupOrphans;
  cleanupTables: typeof cleanupTables;
  clerk: typeof clerk;
  conversations: typeof conversations;
  customSystemPrompts: typeof customSystemPrompts;
  "debug/cleanupDuplicateTokens": typeof debug_cleanupDuplicateTokens;
  "debug/fixTokenIdentifier": typeof debug_fixTokenIdentifier;
  "debug/sessionMigration": typeof debug_sessionMigration;
  "debug/todoistDebug": typeof debug_todoistDebug;
  "googleCalendar/auth": typeof googleCalendar_auth;
  http: typeof http;
  migrateTokens: typeof migrateTokens;
  "migrations/backfillSessionTimestamps": typeof migrations_backfillSessionTimestamps;
  "todoist/BatchTodoistHandler": typeof todoist_BatchTodoistHandler;
  "todoist/auth": typeof todoist_auth;
  "todoist/integration": typeof todoist_integration;
  "todoist/syncApi": typeof todoist_syncApi;
  "todoist/userAccess": typeof todoist_userAccess;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
