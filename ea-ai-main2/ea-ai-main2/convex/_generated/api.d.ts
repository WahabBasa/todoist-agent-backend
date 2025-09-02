/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_caching from "../ai/caching.js";
import type * as ai_eventDrivenProcessor from "../ai/eventDrivenProcessor.js";
import type * as ai_mentalModel from "../ai/mentalModel.js";
import type * as ai_messageConversion from "../ai/messageConversion.js";
import type * as ai_messageV2 from "../ai/messageV2.js";
import type * as ai_processor from "../ai/processor.js";
import type * as ai_session from "../ai/session.js";
import type * as ai_stateOrchestrator from "../ai/stateOrchestrator.js";
import type * as ai_system from "../ai/system.js";
import type * as ai_toolIntegration from "../ai/toolIntegration.js";
import type * as ai_toolRegistry from "../ai/toolRegistry.js";
import type * as ai_tools_internal from "../ai/tools/internal.js";
import type * as ai_tools_pureTools from "../ai/tools/pureTools.js";
import type * as ai_tools_todoist from "../ai/tools/todoist.js";
import type * as ai_tools_utils from "../ai/tools/utils.js";
import type * as ai from "../ai.js";
import type * as aiInternalTodos from "../aiInternalTodos.js";
import type * as chatSessions from "../chatSessions.js";
import type * as chatStream from "../chatStream.js";
import type * as cleanupOrphans from "../cleanupOrphans.js";
import type * as cleanupTables from "../cleanupTables.js";
import type * as clerk from "../clerk.js";
import type * as conversations from "../conversations.js";
import type * as debug_cleanupDuplicateTokens from "../debug/cleanupDuplicateTokens.js";
import type * as debug_fixTokenIdentifier from "../debug/fixTokenIdentifier.js";
import type * as debug_todoistDebug from "../debug/todoistDebug.js";
import type * as googleCalendar_auth from "../googleCalendar/auth.js";
import type * as http from "../http.js";
import type * as mentalModels from "../mentalModels.js";
import type * as migrateTokens from "../migrateTokens.js";
import type * as shared_tools from "../shared/tools.js";
import type * as streamEvents from "../streamEvents.js";
import type * as streamingCompat from "../streamingCompat.js";
import type * as todoist_auth from "../todoist/auth.js";
import type * as todoist_integration from "../todoist/integration.js";
import type * as todoist_model from "../todoist/model.js";
import type * as todoist_syncApi from "../todoist/syncApi.js";
import type * as todoist_userAccess from "../todoist/userAccess.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

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
  "ai/eventDrivenProcessor": typeof ai_eventDrivenProcessor;
  "ai/mentalModel": typeof ai_mentalModel;
  "ai/messageConversion": typeof ai_messageConversion;
  "ai/messageV2": typeof ai_messageV2;
  "ai/processor": typeof ai_processor;
  "ai/session": typeof ai_session;
  "ai/stateOrchestrator": typeof ai_stateOrchestrator;
  "ai/system": typeof ai_system;
  "ai/toolIntegration": typeof ai_toolIntegration;
  "ai/toolRegistry": typeof ai_toolRegistry;
  "ai/tools/internal": typeof ai_tools_internal;
  "ai/tools/pureTools": typeof ai_tools_pureTools;
  "ai/tools/todoist": typeof ai_tools_todoist;
  "ai/tools/utils": typeof ai_tools_utils;
  ai: typeof ai;
  aiInternalTodos: typeof aiInternalTodos;
  chatSessions: typeof chatSessions;
  chatStream: typeof chatStream;
  cleanupOrphans: typeof cleanupOrphans;
  cleanupTables: typeof cleanupTables;
  clerk: typeof clerk;
  conversations: typeof conversations;
  "debug/cleanupDuplicateTokens": typeof debug_cleanupDuplicateTokens;
  "debug/fixTokenIdentifier": typeof debug_fixTokenIdentifier;
  "debug/todoistDebug": typeof debug_todoistDebug;
  "googleCalendar/auth": typeof googleCalendar_auth;
  http: typeof http;
  mentalModels: typeof mentalModels;
  migrateTokens: typeof migrateTokens;
  "shared/tools": typeof shared_tools;
  streamEvents: typeof streamEvents;
  streamingCompat: typeof streamingCompat;
  "todoist/auth": typeof todoist_auth;
  "todoist/integration": typeof todoist_integration;
  "todoist/model": typeof todoist_model;
  "todoist/syncApi": typeof todoist_syncApi;
  "todoist/userAccess": typeof todoist_userAccess;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  persistentTextStreaming: {
    lib: {
      addChunk: FunctionReference<
        "mutation",
        "internal",
        { final: boolean; streamId: string; text: string },
        any
      >;
      createStream: FunctionReference<"mutation", "internal", {}, any>;
      getStreamStatus: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        "pending" | "streaming" | "done" | "error" | "timeout"
      >;
      getStreamText: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          text: string;
        }
      >;
      setStreamStatus: FunctionReference<
        "mutation",
        "internal",
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          streamId: string;
        },
        any
      >;
    };
  };
};
