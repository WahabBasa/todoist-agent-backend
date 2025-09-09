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
import type * as ai_caching from "../ai/caching.js";
import type * as ai_messageV2 from "../ai/messageV2.js";
import type * as ai_processor from "../ai/processor.js";
import type * as ai_session from "../ai/session.js";
import type * as ai_system from "../ai/system.js";
import type * as ai_toolRegistry from "../ai/toolRegistry.js";
import type * as ai_tools_googleCalendar from "../ai/tools/googleCalendar.js";
import type * as ai_tools_internal from "../ai/tools/internal.js";
import type * as ai_tools_todoist from "../ai/tools/todoist.js";
import type * as ai_tools_utils from "../ai/tools/utils.js";
import type * as ai from "../ai.js";
import type * as aiInternalTodos from "../aiInternalTodos.js";
import type * as chatSessions from "../chatSessions.js";
import type * as cleanupOrphans from "../cleanupOrphans.js";
import type * as cleanupTables from "../cleanupTables.js";
import type * as clerk from "../clerk.js";
import type * as conversations from "../conversations.js";
import type * as customSystemPrompts from "../customSystemPrompts.js";
import type * as debug_cleanupDuplicateTokens from "../debug/cleanupDuplicateTokens.js";
import type * as debug_fixTokenIdentifier from "../debug/fixTokenIdentifier.js";
import type * as debug_todoistDebug from "../debug/todoistDebug.js";
import type * as googleCalendar_auth from "../googleCalendar/auth.js";
import type * as http from "../http.js";
import type * as mentalModels from "../mentalModels.js";
import type * as migrateTokens from "../migrateTokens.js";
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
  "ai/caching": typeof ai_caching;
  "ai/messageV2": typeof ai_messageV2;
  "ai/processor": typeof ai_processor;
  "ai/session": typeof ai_session;
  "ai/system": typeof ai_system;
  "ai/toolRegistry": typeof ai_toolRegistry;
  "ai/tools/googleCalendar": typeof ai_tools_googleCalendar;
  "ai/tools/internal": typeof ai_tools_internal;
  "ai/tools/todoist": typeof ai_tools_todoist;
  "ai/tools/utils": typeof ai_tools_utils;
  ai: typeof ai;
  aiInternalTodos: typeof aiInternalTodos;
  chatSessions: typeof chatSessions;
  cleanupOrphans: typeof cleanupOrphans;
  cleanupTables: typeof cleanupTables;
  clerk: typeof clerk;
  conversations: typeof conversations;
  customSystemPrompts: typeof customSystemPrompts;
  "debug/cleanupDuplicateTokens": typeof debug_cleanupDuplicateTokens;
  "debug/fixTokenIdentifier": typeof debug_fixTokenIdentifier;
  "debug/todoistDebug": typeof debug_todoistDebug;
  "googleCalendar/auth": typeof googleCalendar_auth;
  http: typeof http;
  mentalModels: typeof mentalModels;
  migrateTokens: typeof migrateTokens;
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
