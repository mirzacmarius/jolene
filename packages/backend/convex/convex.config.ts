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
  },
});

export default app;
