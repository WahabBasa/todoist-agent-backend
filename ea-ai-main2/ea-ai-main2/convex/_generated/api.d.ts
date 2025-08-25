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
import type * as ai from "../ai.js";
import type * as chatSessions from "../chatSessions.js";
import type * as cleanupOrphans from "../cleanupOrphans.js";
import type * as cleanupTables from "../cleanupTables.js";
import type * as clerk from "../clerk.js";
import type * as conversations from "../conversations.js";
import type * as debug_cleanupDuplicateTokens from "../debug/cleanupDuplicateTokens.js";
import type * as debug_fixTokenIdentifier from "../debug/fixTokenIdentifier.js";
import type * as debug_todoistDebug from "../debug/todoistDebug.js";
import type * as googleCalendar_auth from "../googleCalendar/auth.js";
import type * as googleCalendar_client from "../googleCalendar/client.js";
import type * as googleCalendar_events from "../googleCalendar/events.js";
import type * as googleCalendar_oauthFlow from "../googleCalendar/oauthFlow.js";
import type * as googleCalendar_sessionManager from "../googleCalendar/sessionManager.js";
import type * as googleCalendar_utils from "../googleCalendar/utils.js";
import type * as http from "../http.js";
import type * as migrateTokens from "../migrateTokens.js";
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
  ai: typeof ai;
  chatSessions: typeof chatSessions;
  cleanupOrphans: typeof cleanupOrphans;
  cleanupTables: typeof cleanupTables;
  clerk: typeof clerk;
  conversations: typeof conversations;
  "debug/cleanupDuplicateTokens": typeof debug_cleanupDuplicateTokens;
  "debug/fixTokenIdentifier": typeof debug_fixTokenIdentifier;
  "debug/todoistDebug": typeof debug_todoistDebug;
  "googleCalendar/auth": typeof googleCalendar_auth;
  "googleCalendar/client": typeof googleCalendar_client;
  "googleCalendar/events": typeof googleCalendar_events;
  "googleCalendar/oauthFlow": typeof googleCalendar_oauthFlow;
  "googleCalendar/sessionManager": typeof googleCalendar_sessionManager;
  "googleCalendar/utils": typeof googleCalendar_utils;
  http: typeof http;
  migrateTokens: typeof migrateTokens;
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
