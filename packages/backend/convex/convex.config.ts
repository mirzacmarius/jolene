import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
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
     * Resend's API key, for the emails Jolene sends: sign-in codes and the
     * couples' invitations. Without it the studio says signing in by email
     * isn't set up yet, and invitations go by link only.
     */
    RESEND_API_KEY: v.optional(v.string()),
    /**
     * The signing secret of Resend's webhook (http.ts), which tells the
     * couple when an invitation's email bounced. Emails go without it.
     */
    RESEND_WEBHOOK_SECRET: v.optional(v.string()),
    /**
     * Who Jolene's emails come from: an address on a domain Resend verified.
     * "Jolene <salut@jolene.ro>" when unset.
     */
    EMAIL_FROM: v.optional(v.string()),
    /**
     * Development and previews only: "1" writes sign-in codes to the logs
     * instead of sending them, to sign in without Resend, while there's no
     * RESEND_API_KEY. Never set on production.
     */
    AUTH_LOG_CODES: v.optional(v.string()),
    /**
     * Where guests open digital invitations, such as
     * https://invitatie.jolene.ro: a family's link is this, the invitation's
     * address and their code. The studio's own /invitatie when unset.
     */
    INVITE_URL: v.optional(v.string()),
  },
});

app.use(rateLimiter);
app.use(resend);

export default app;
