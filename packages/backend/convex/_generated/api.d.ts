/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as accounts_move from "../accounts/move.js";
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
import type * as cart from "../cart.js";
import type * as catalog from "../catalog.js";
import type * as catalog_save from "../catalog/save.js";
import type * as checkout from "../checkout.js";
import type * as checkout_delivery from "../checkout/delivery.js";
import type * as checkout_open from "../checkout/open.js";
import type * as checkout_stripe from "../checkout/stripe.js";
import type * as crons from "../crons.js";
import type * as designs from "../designs.js";
import type * as designs_apply from "../designs/apply.js";
import type * as designs_versions from "../designs/versions.js";
import type * as emails from "../emails.js";
import type * as events from "../events.js";
import type * as guests from "../guests.js";
import type * as households from "../households.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as invites from "../invites.js";
import type * as invites_access from "../invites/access.js";
import type * as invites_codes from "../invites/codes.js";
import type * as invites_image from "../invites/image.js";
import type * as invites_rules from "../invites/rules.js";
import type * as invites_shop from "../invites/shop.js";
import type * as invites_text from "../invites/text.js";
import type * as invites_unlock from "../invites/unlock.js";
import type * as invites_validators from "../invites/validators.js";
import type * as orders from "../orders.js";
import type * as orders_emails from "../orders/emails.js";
import type * as orders_format from "../orders/format.js";
import type * as orders_links from "../orders/links.js";
import type * as orders_validators from "../orders/validators.js";
import type * as partners from "../partners.js";
import type * as proofs from "../proofs.js";
import type * as proofs_image from "../proofs/image.js";
import type * as shop from "../shop.js";
import type * as shop_load from "../shop/load.js";
import type * as shop_photos from "../shop/photos.js";
import type * as shop_pricing from "../shop/pricing.js";
import type * as shop_validators from "../shop/validators.js";
import type * as simple from "../simple.js";
import type * as simple_compose from "../simple/compose.js";
import type * as simple_tones from "../simple/tones.js";
import type * as utils_assets from "../utils/assets.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_limits from "../utils/limits.js";
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
  accounts: typeof accounts;
  "accounts/move": typeof accounts_move;
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
  cart: typeof cart;
  catalog: typeof catalog;
  "catalog/save": typeof catalog_save;
  checkout: typeof checkout;
  "checkout/delivery": typeof checkout_delivery;
  "checkout/open": typeof checkout_open;
  "checkout/stripe": typeof checkout_stripe;
  crons: typeof crons;
  designs: typeof designs;
  "designs/apply": typeof designs_apply;
  "designs/versions": typeof designs_versions;
  emails: typeof emails;
  events: typeof events;
  guests: typeof guests;
  households: typeof households;
  http: typeof http;
  init: typeof init;
  invites: typeof invites;
  "invites/access": typeof invites_access;
  "invites/codes": typeof invites_codes;
  "invites/image": typeof invites_image;
  "invites/rules": typeof invites_rules;
  "invites/shop": typeof invites_shop;
  "invites/text": typeof invites_text;
  "invites/unlock": typeof invites_unlock;
  "invites/validators": typeof invites_validators;
  orders: typeof orders;
  "orders/emails": typeof orders_emails;
  "orders/format": typeof orders_format;
  "orders/links": typeof orders_links;
  "orders/validators": typeof orders_validators;
  partners: typeof partners;
  proofs: typeof proofs;
  "proofs/image": typeof proofs_image;
  shop: typeof shop;
  "shop/load": typeof shop_load;
  "shop/photos": typeof shop_photos;
  "shop/pricing": typeof shop_pricing;
  "shop/validators": typeof shop_validators;
  simple: typeof simple;
  "simple/compose": typeof simple_compose;
  "simple/tones": typeof simple_tones;
  "utils/assets": typeof utils_assets;
  "utils/auth": typeof utils_auth;
  "utils/errors": typeof utils_errors;
  "utils/limits": typeof utils_limits;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
