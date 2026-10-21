import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handleStripeWebhook } from "./checkout";
import { handleResendWebhook } from "./emails";

const http = httpRouter();

auth.addHttpRoutes(http);

/** Resend's webhook: which invitation emails were delivered or bounced. */
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleResendWebhook(ctx, request);
  }),
});

/**
 * Stripe's webhook: a Checkout Session paid, recorded as an order. Stripe
 * sends checkout.session.completed and
 * checkout.session.async_payment_succeeded here.
 */
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleStripeWebhook(ctx, request);
  }),
});

export default http;
