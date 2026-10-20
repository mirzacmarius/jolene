/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as ai_changes from "../ai/changes.js";
import type * as ai_config from "../ai/config.js";
import type * as ai_context from "../ai/context.js";
import type * as ai_limits from "../ai/limits.js";
import type * as ai_model from "../ai/model.js";
import type * as ai_prompt from "../ai/prompt.js";
import type * as ai_reply from "../ai/reply.js";
import type * as ai_report from "../ai/report.js";
import type * as ai_request from "../ai/request.js";
import type * as ai_run from "../ai/run.js";
import type * as ai_standIn from "../ai/standIn.js";
import type * as ai_tools from "../ai/tools.js";
import type * as ai_validators from "../ai/validators.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as catalog_save from "../catalog/save.js";
import type * as designs from "../designs.js";
import type * as designs_apply from "../designs/apply.js";
import type * as designs_versions from "../designs/versions.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as proofs from "../proofs.js";
import type * as proofs_image from "../proofs/image.js";
import type * as simple from "../simple.js";
import type * as simple_compose from "../simple/compose.js";
import type * as simple_tones from "../simple/tones.js";
import type * as utils_assets from "../utils/assets.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_validators from "../utils/validators.js";
import type * as workshop from "../workshop.js";
import type * as workshop_orders from "../workshop/orders.js";
import type * as workshop_proofs from "../workshop/proofs.js";
import type * as workshop_staff from "../workshop/staff.js";
import type * as workshop_validators from "../workshop/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  "ai/changes": typeof ai_changes;
  "ai/config": typeof ai_config;
  "ai/context": typeof ai_context;
  "ai/limits": typeof ai_limits;
  "ai/model": typeof ai_model;
  "ai/prompt": typeof ai_prompt;
  "ai/reply": typeof ai_reply;
  "ai/report": typeof ai_report;
  "ai/request": typeof ai_request;
  "ai/run": typeof ai_run;
  "ai/standIn": typeof ai_standIn;
  "ai/tools": typeof ai_tools;
  "ai/validators": typeof ai_validators;
  auth: typeof auth;
  catalog: typeof catalog;
  "catalog/save": typeof catalog_save;
  designs: typeof designs;
  "designs/apply": typeof designs_apply;
  "designs/versions": typeof designs_versions;
  events: typeof events;
  http: typeof http;
  init: typeof init;
  proofs: typeof proofs;
  "proofs/image": typeof proofs_image;
  simple: typeof simple;
  "simple/compose": typeof simple_compose;
  "simple/tones": typeof simple_tones;
  "utils/assets": typeof utils_assets;
  "utils/auth": typeof utils_auth;
  "utils/errors": typeof utils_errors;
  "utils/validators": typeof utils_validators;
  workshop: typeof workshop;
  "workshop/orders": typeof workshop_orders;
  "workshop/proofs": typeof workshop_proofs;
  "workshop/staff": typeof workshop_staff;
  "workshop/validators": typeof workshop_validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
