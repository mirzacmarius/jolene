import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
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

export default http;
