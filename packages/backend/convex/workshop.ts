import { Admin } from "@jolene/products/admin";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env, query } from "./_generated/server";
import {
  checkOrder,
  proofIdsOf,
  readOrders,
  readStoreData,
} from "./workshop/orders";
import { PROOFS_PER_CALL, printJobOf } from "./workshop/proofs";
import { workshopAccess } from "./workshop/staff";
import {
  ordersValidator,
  printJobValidator,
  type proofValidator,
} from "./workshop/validators";

/** Who is signed in, as the workshop's page needs to know. */
export const access = query({
  args: {},
  returns: v.union(
    v.object({
      signedIn: v.literal(false),
      googleConfigured: v.boolean(),
      /** The workshop's page where Google sign-in completes. */
      signInAt: v.union(v.string(), v.null()),
    }),
    v.object({
      signedIn: v.literal(true),
      email: v.string(),
      allowed: v.boolean(),
    }),
  ),
  handler: async (ctx) => await workshopAccess(ctx),
});

/** The store this deployment reads orders from, once it's set up for it. */
function storeConfig() {
  const domain = env.SHOPIFY_STORE_DOMAIN?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const clientId = env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = env.SHOPIFY_CLIENT_SECRET?.trim();
  return domain && clientId && clientSecret
    ? { domain, clientId, clientSecret }
    : null;
}

/**
 * The store's open orders, oldest first, each line with its proof and what
 * the workshop should check before making it. Read from Shopify each time,
 * so the list is never behind the admin; Shopify keeps the orders.
 */
export const orders = action({
  args: {},
  returns: ordersValidator,
  handler: async (ctx): Promise<Infer<typeof ordersValidator>> => {
    await ctx.runQuery(internal.workshop.staff.check, {});
    const store = storeConfig();
    if (!store) return { status: "not-connected" };
    let found: Awaited<ReturnType<typeof readOrders>>;
    let data: Awaited<ReturnType<typeof readStoreData>>;
    try {
      const admin = await Admin.connect(store);
      found = await readOrders(admin);
      data = await readStoreData(admin, found.orders);
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const proofs = new Map<string, Infer<typeof proofValidator>>();
    const ids = proofIdsOf(found.orders);
    for (let start = 0; start < ids.length; start += PROOFS_PER_CALL)
      for (const proof of await ctx.runQuery(
        internal.workshop.proofs.summaries,
        { ids: ids.slice(start, start + PROOFS_PER_CALL) },
      ))
        proofs.set(proof.id, proof);

    return {
      status: "read",
      orders: found.orders.map((order) =>
        checkOrder(order, data, proofs, store.domain),
      ),
      more: found.more,
      admin: `https://${store.domain}/admin/orders`,
      readAt: Date.now(),
    };
  },
});

/**
 * What the print file of an order's proof is made from, for the studio, which
 * makes the file (apps/studio/src/app/studio/api/print-files).
 */
export const printJob = query({
  args: { proofId: v.string() },
  returns: v.union(printJobValidator, v.null()),
  handler: async (ctx, { proofId }) => await printJobOf(ctx, proofId),
});
