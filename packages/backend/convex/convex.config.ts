import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    /**
     * Where the studio runs; Convex Auth sends sign-in links back here.
     * Optional at push time only because a fresh deployment must push before
     * its env can be set; every deployment sets it.
     */
    SITE_URL: v.optional(v.string()),
    /**
     * The AI designer's key for the Anthropic API. Without it the studio
     * shows the AI designer as not available yet.
     */
    ANTHROPIC_API_KEY: v.optional(v.string()),
    /** The model the AI designer runs on; ai/config.ts has the default. */
    AI_MODEL: v.optional(v.string()),
    /**
     * How much the model thinks: low, medium, high, xhigh or max; medium when
     * unset. Lower costs less and answers sooner.
     */
    AI_EFFORT: v.optional(v.string()),
    /** Messages one visitor may send the AI designer a day; 20 when unset. */
    AI_DAILY_LIMIT: v.optional(v.string()),
    /** Messages all visitors together may send it a day; 200 when unset. */
    AI_DAILY_LIMIT_TOTAL: v.optional(v.string()),
    /**
     * Local development only: "1" answers with a short scripted stand-in
     * instead of the model, to try the AI designer without a key. Never set
     * on a real deployment.
     */
    AI_STAND_IN: v.optional(v.string()),
    /**
     * The workshop's Google sign-in: the ID and secret of an OAuth client in
     * Google Cloud (auth.ts). The workshop's page says sign-in isn't set up
     * while they're unset; couples sign in without them.
     */
    AUTH_GOOGLE_ID: v.optional(v.string()),
    AUTH_GOOGLE_SECRET: v.optional(v.string()),
    /**
     * The Google accounts the workshop's order list opens to, by address,
     * comma-separated. It opens to no one while unset.
     */
    WORKSHOP_EMAILS: v.optional(v.string()),
    /**
     * The Shopify store the workshop's order list reads, such as
     * jolene.myshopify.com. The list says it isn't connected to the store
     * while this or the app's credentials are unset.
     */
    SHOPIFY_STORE_DOMAIN: v.optional(v.string()),
    /**
     * The client ID and secret of the Dev Dashboard app the store installed
     * (packages/products), which reads orders with read_orders. The secret
     * is only ever sent to the store.
     */
    SHOPIFY_CLIENT_ID: v.optional(v.string()),
    SHOPIFY_CLIENT_SECRET: v.optional(v.string()),
  },
});

export default app;
