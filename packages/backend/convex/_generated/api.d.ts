/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as catalog_save from "../catalog/save.js";
import type * as designs from "../designs.js";
import type * as designs_versions from "../designs/versions.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as seed_eucalipt from "../seed/eucalipt.js";
import type * as utils_assets from "../utils/assets.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_validators from "../utils/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  catalog: typeof catalog;
  "catalog/save": typeof catalog_save;
  designs: typeof designs;
  "designs/versions": typeof designs_versions;
  events: typeof events;
  http: typeof http;
  init: typeof init;
  "seed/eucalipt": typeof seed_eucalipt;
  "utils/assets": typeof utils_assets;
  "utils/auth": typeof utils_auth;
  "utils/errors": typeof utils_errors;
  "utils/validators": typeof utils_validators;
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
