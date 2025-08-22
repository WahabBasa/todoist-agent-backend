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
import type * as cleanup from "../cleanup.js";
import type * as conversations from "../conversations.js";
import type * as googleCalendar_auth from "../googleCalendar/auth.js";
import type * as googleCalendar_client from "../googleCalendar/client.js";
import type * as googleCalendar_events from "../googleCalendar/events.js";
import type * as googleCalendar_oauthFlow from "../googleCalendar/oauthFlow.js";
import type * as googleCalendar_sessionManager from "../googleCalendar/sessionManager.js";
import type * as googleCalendar_utils from "../googleCalendar/utils.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as myFunctions from "../myFunctions.js";
import type * as projects from "../projects.js";
import type * as subTodos from "../subTodos.js";
import type * as tasks from "../tasks.js";
import type * as todoist_api from "../todoist/api.js";
import type * as todoist_auth from "../todoist/auth.js";
import type * as todoist_integration from "../todoist/integration.js";
import type * as users from "../users.js";

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
  cleanup: typeof cleanup;
  conversations: typeof conversations;
  "googleCalendar/auth": typeof googleCalendar_auth;
  "googleCalendar/client": typeof googleCalendar_client;
  "googleCalendar/events": typeof googleCalendar_events;
  "googleCalendar/oauthFlow": typeof googleCalendar_oauthFlow;
  "googleCalendar/sessionManager": typeof googleCalendar_sessionManager;
  "googleCalendar/utils": typeof googleCalendar_utils;
  http: typeof http;
  labels: typeof labels;
  myFunctions: typeof myFunctions;
  projects: typeof projects;
  subTodos: typeof subTodos;
  tasks: typeof tasks;
  "todoist/api": typeof todoist_api;
  "todoist/auth": typeof todoist_auth;
  "todoist/integration": typeof todoist_integration;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
