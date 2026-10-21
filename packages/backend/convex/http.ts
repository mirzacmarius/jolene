import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handleResendWebhook } from "./emails";
import { paidOrder, signedByShopify } from "./orders/shopify";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Shopify's orders/paid webhook: a paid order unlocks the digital
 * invitations it was for (orders.ts). Only the store can sign it.
 */
http.route({
  path: "/shopify/orders-paid",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signed = await signedByShopify(
      body,
      request.headers.get("x-shopify-hmac-sha256"),
      env.SHOPIFY_WEBHOOK_SECRET?.trim() ?? "",
    );
    if (!signed)
      return new Response("Not signed by the store", { status: 401 });
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("Not JSON", { status: 400 });
    }
    const order = paidOrder(payload);
    if (!order) return new Response("Not an order", { status: 400 });
    if (order.lines.length > 0)
      await ctx.runMutation(internal.orders.paid, order);
    return new Response(null, { status: 200 });
  }),
});

/** Resend's webhook: which invitation emails were delivered or bounced. */
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleResendWebhook(ctx, request);
  }),
});

export default http;
