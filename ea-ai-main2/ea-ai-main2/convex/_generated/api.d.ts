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
import type * as auth from "../auth.js";
import type * as chatSessions from "../chatSessions.js";
import type * as cleanup from "../cleanup.js";
import type * as conversations from "../conversations.js";
import type * as google_calendar_auth from "../google-calendar/auth.js";
import type * as google_calendar_client from "../google-calendar/client.js";
import type * as google_calendar_events from "../google-calendar/events.js";
import type * as google_calendar_utils from "../google-calendar/utils.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as myFunctions from "../myFunctions.js";
import type * as projects from "../projects.js";
import type * as subTodos from "../subTodos.js";
import type * as tasks from "../tasks.js";
import type * as todoist_api from "../todoist/api.js";
import type * as todoist_auth from "../todoist/auth.js";
import type * as todoist_integration from "../todoist/integration.js";

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
  auth: typeof auth;
  chatSessions: typeof chatSessions;
  cleanup: typeof cleanup;
  conversations: typeof conversations;
  "google-calendar/auth": typeof google_calendar_auth;
  "google-calendar/client": typeof google_calendar_client;
  "google-calendar/events": typeof google_calendar_events;
  "google-calendar/utils": typeof google_calendar_utils;
  http: typeof http;
  labels: typeof labels;
  myFunctions: typeof myFunctions;
  projects: typeof projects;
  subTodos: typeof subTodos;
  tasks: typeof tasks;
  "todoist/api": typeof todoist_api;
  "todoist/auth": typeof todoist_auth;
  "todoist/integration": typeof todoist_integration;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
