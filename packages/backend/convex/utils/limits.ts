import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * How often visitors may do what costs Jolene or bothers someone else:
 * emails sent, what guests write without signing in, and calls to Stripe.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /** Sign-in codes sent to one address. */
  signInCode: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
  /** Sign-in codes sent to anyone, so no one can mail the world through us. */
  signInCodes: { kind: "token bucket", rate: 600, period: HOUR, capacity: 60 },
  /** Replies sent through one family's link. */
  reply: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  /** Families adding themselves through one invitation's open link. */
  join: { kind: "token bucket", rate: 120, period: HOUR, capacity: 40 },
  /** Emails of one invitation to its guests. */
  inviteEmails: {
    kind: "token bucket",
    rate: 600,
    period: HOUR,
    capacity: 600,
  },
  /** Partner links a couple makes, each one replacing the one before. */
  partnerLink: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
  /** Stripe checkout pages opened for one cart. */
  checkout: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  /** Stripe checkout pages opened for anyone, so no one floods Stripe through us. */
  checkouts: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 60 },
  /** Returns from Stripe that Convex hasn't recorded yet, each a call to Stripe. */
  confirms: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 60 },
});
