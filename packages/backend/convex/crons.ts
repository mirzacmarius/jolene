import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Orders Stripe was paid for that neither its webhook nor the couple's return recorded. */
crons.interval(
  "record paid checkouts",
  { hours: 1 },
  internal.checkout.reconcile,
  {},
);

/** Checkouts no one paid for. */
crons.interval(
  "forget unpaid checkouts",
  { hours: 24 },
  internal.checkout.forget,
  {},
);

/** Guest lists kept as long as the workshop set, after their event. */
crons.interval(
  "forget guest lists",
  { hours: 24 },
  internal.invites.forget.lists,
  {},
);

/** Resend's copies of the emails it sent, after 30 days. */
crons.interval("forget sent emails", { hours: 24 }, internal.emails.forget, {});

/** Photos the workshop uploaded for a product and never saved on it. */
crons.interval(
  "forget unsaved product photos",
  { hours: 24 },
  internal.workshop.products.forgetUploads,
  {},
);

export default crons;
