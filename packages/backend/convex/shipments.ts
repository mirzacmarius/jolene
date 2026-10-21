import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  env,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  emailConfigured,
  emailLayout,
  fromHeader,
  sendEmail,
  sender,
} from "./emails";
import { randomCode } from "./invites/codes";
import {
  pickupReadyEmail,
  shipmentEmail,
  shipmentNotice,
} from "./orders/emails";
import { orderName } from "./orders/format";
import { orderUrl, shopUrl } from "./orders/links";
import {
  type Parcel,
  parcelValidator,
  shipmentValidator,
} from "./orders/validators";
import schema from "./schema";
import { bookingOf, STANDARD_PARCEL, validParcel } from "./shipments/booking";
import {
  book as bookCourier,
  ColeteOnlineError,
  coleteOnline,
  label,
  savedAddress,
  signIn,
  tracking,
} from "./shipments/coleteOnline";
import { errors } from "./utils/errors";
import { requireWorkshop } from "./workshop/staff";

/**
 * An order's parcel, which goes with the courier Colete Online books
 * cheapest for it (ADR 0019): the workshop books it once the parcel is
 * packed, prints its label, and the couple gets an email naming the courier
 * and its AWB. Colete Online tells Convex of the parcel's progress, which
 * the order's page shows. A test order books on Colete Online's staging
 * API, which no courier collects from. When Colete Online can't book it,
 * the workshop books the courier itself and types its AWB in.
 */

/** How long a booking may stay unanswered before it's taken as stuck. */
const STUCK = 15 * 60_000;

/** The secret in the address Colete Online tells of a parcel's progress at. */
const KEY_LENGTH = 32;

const said = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Why it wasn't booked, as the team reads it. */
function refusal(error: unknown): string {
  return error instanceof ColeteOnlineError && error.unsure
    ? `${error.message}. Colete Online poate să-l fi comandat totuși: verificați în contul Colete Online înainte să-l comandați din nou.`
    : said(error);
}

/** Tells the team, or the logs while no email can go out. */
async function tellTeam(
  ctx: MutationCtx,
  order: Doc<"orders">,
  notice: Parameters<typeof shipmentNotice>[1],
) {
  const shop = shopUrl();
  const email = shipmentNotice(
    order,
    notice,
    shop && orderUrl(shop, order.token),
  );
  if (!emailConfigured()) {
    console.warn(email.text);
    return;
  }
  const { name, address } = sender();
  await sendEmail(ctx, {
    to: env.ORDERS_EMAIL?.trim() || address,
    from: fromHeader(name, address),
    subject: email.subject,
    text: email.text,
    html: emailLayout(email.html, email.footer),
  });
}

/** Sends the couple one of their order's emails, once for `key`. */
async function tellCouple(
  ctx: MutationCtx,
  order: Doc<"orders">,
  email: { subject: string; text: string; html: string; footer: string },
  key: string,
) {
  if (!order.customer.email) return;
  if (!emailConfigured()) {
    console.log(
      `Order ${orderName(order.number)}'s email "${email.subject}" went by no email: RESEND_API_KEY isn't set`,
    );
    return;
  }
  const { name, address } = sender();
  await sendEmail(ctx, {
    to: order.customer.email,
    from: fromHeader(name, address),
    subject: email.subject,
    text: email.text,
    html: emailLayout(email.html, email.footer),
    replyTo: [env.ORDERS_EMAIL?.trim() || address],
    idempotencyKey: `order-${order._id}-${key}`,
  });
}

/** Whether Colete Online is booking the courier, and not for so long it's stuck. */
const inFlight = (shipment: Doc<"orders">["shipment"]) =>
  shipment?.status === "booking" && Date.now() - shipment.at < STUCK;

async function orderByNumber(ctx: MutationCtx, number: number) {
  return await ctx.db
    .query("orders")
    .withIndex("by_number", (q) => q.eq("number", number))
    .unique();
}

/**
 * Books the courier for an order's parcel, packed as `parcel` says or in
 * the standard box: for the workshop, once the order is made. A booking
 * Colete Online refused, or one stuck for a quarter of an hour, can be
 * asked for again; Colete Online may have booked a stuck one all the same,
 * so the team looks there first.
 */
export async function bookShipment(
  ctx: MutationCtx,
  order: Doc<"orders">,
  parcel: Parcel = STANDARD_PARCEL,
): Promise<void> {
  if (!coleteOnline()) throw new ConvexError(errors.courierUnavailable);
  if (
    order.delivery?.key !== "courier" ||
    !order.address ||
    !validParcel(parcel)
  )
    throw new ConvexError(errors.invalidInput);
  const { shipment } = order;
  if (shipment?.status === "booked" || inFlight(shipment))
    throw new ConvexError(errors.shipmentBooked);
  const key = randomCode(KEY_LENGTH);
  await ctx.db.patch("orders", order._id, {
    shipment: { status: "booking", at: Date.now(), parcel, key },
  });
  await ctx.scheduler.runAfter(0, internal.shipments.create, {
    orderId: order._id,
    key,
  });
}

/** Books the courier for an order's parcel, for the workshop (bookShipment). */
export const book = mutation({
  args: { number: v.number(), parcel: v.optional(parcelValidator) },
  returns: v.null(),
  handler: async (ctx, { number, parcel }) => {
    await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    if (!order) throw new ConvexError(errors.notFound);
    await bookShipment(ctx, order, parcel);
    return null;
  },
});

/** The order whose booking `key` is, while it's being booked or booked. */
export const pending = internalQuery({
  args: { orderId: v.id("orders"), key: v.string() },
  returns: v.union(schema.doc("orders"), v.null()),
  handler: async (ctx, { orderId, key }) => {
    const order = await ctx.db.get("orders", orderId);
    return order?.shipment?.key === key ? order : null;
  },
});

/** Where Colete Online tells this deployment of a parcel's progress. */
const hookUrl = (orderId: Id<"orders">, key: string) =>
  `${env.CONVEX_SITE_URL}/colete-online-webhook?${new URLSearchParams({ order: orderId, key })}`;

/** Asks Colete Online for the courier `book` asked for, and its label. */
export const create = internalAction({
  args: { orderId: v.id("orders"), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, key }) => {
    const order: Doc<"orders"> | null = await ctx.runQuery(
      internal.shipments.pending,
      { orderId, key },
    );
    const shipment = order?.shipment;
    if (!order || shipment?.status !== "booking") return null;
    const account = coleteOnline();
    let session: Awaited<ReturnType<typeof signIn>>;
    let booked: Awaited<ReturnType<typeof bookCourier>>;
    try {
      if (!account)
        throw new ColeteOnlineError(
          "Colete Online nu mai e configurat: comandați curierul direct în Colete Online.",
        );
      session = await signIn(account, order.test);
      const addressId = account.addressId ?? (await savedAddress(session));
      if (!addressId)
        throw new ColeteOnlineError(
          "Contul Colete Online n-are nicio adresă salvată de unde să ridice curierul: salvați adresa atelierului în Colete Online.",
        );
      booked = await bookCourier(
        session,
        bookingOf(order, shipment.parcel ?? STANDARD_PARCEL, addressId, {
          url: hookUrl(orderId, key),
          key,
        }),
      );
    } catch (error) {
      await ctx.runMutation(internal.shipments.refused, {
        orderId,
        key,
        error: refusal(error),
      });
      return null;
    }
    await ctx.runMutation(internal.shipments.booked, {
      orderId,
      key,
      id: booked.id,
      awb: booked.awb,
      courier: booked.courier,
      service: booked.service,
      ...(booked.price !== null && { price: booked.price }),
      ...(booked.pickupDate && { pickupDate: booked.pickupDate }),
    });
    await finish(ctx, session, orderId, key, booked.id);
    return null;
  },
});

/** After Colete Online booked it: keeps the label and tells the couple. */
async function finish(
  ctx: ActionCtx,
  session: Awaited<ReturnType<typeof signIn>>,
  orderId: Id<"orders">,
  key: string,
  id: string,
) {
  let file: Id<"_storage"> | undefined;
  let warning: string | undefined;
  try {
    file = await ctx.storage.store(await label(session, id));
  } catch (error) {
    warning = `Eticheta n-a putut fi luată din Colete Online (${said(error)}): o găsiți în contul Colete Online.`;
  }
  await ctx.runMutation(internal.shipments.labelled, {
    orderId,
    key,
    ...(file && { file }),
    ...(warning && { warning }),
  });
}

/** Records the courier Colete Online booked: from now on nothing books it again. */
export const booked = internalMutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    id: v.string(),
    awb: v.string(),
    courier: v.string(),
    service: v.string(),
    price: v.optional(v.number()),
    pickupDate: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, key, ...booked }) => {
    const order = await ctx.db.get("orders", orderId);
    const shipment = order?.shipment;
    if (!order || shipment?.key !== key) return null;
    await ctx.db.patch("orders", orderId, {
      shipment: {
        ...shipment,
        status: "booked",
        at: Date.now(),
        ...booked,
      },
    });
    return null;
  },
});

/** Records that Colete Online refused the booking, and tells the team. */
export const refused = internalMutation({
  args: { orderId: v.id("orders"), key: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, key, error }) => {
    const order = await ctx.db.get("orders", orderId);
    const shipment = order?.shipment;
    if (!order || shipment?.key !== key) return null;
    await ctx.db.patch("orders", orderId, {
      shipment: { ...shipment, status: "failed", at: Date.now(), error },
    });
    console.warn(
      `Order ${orderName(order.number)}'s courier wasn't booked: ${error}`,
    );
    await tellTeam(ctx, order, { problem: error });
    return null;
  },
});

/**
 * Keeps the label of a booked parcel, notes what went wrong once it was
 * booked, and tells the couple it's on its way.
 */
export const labelled = internalMutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    file: v.optional(v.id("_storage")),
    warning: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, key, file, warning }) => {
    const order = await ctx.db.get("orders", orderId);
    const shipment = order?.shipment;
    if (!order || shipment?.key !== key || shipment.status !== "booked")
      return null;
    await ctx.db.patch("orders", orderId, {
      shipment: {
        ...shipment,
        ...(file && { label: file }),
        ...(warning && { warning }),
      },
    });
    const booked = [shipment.courier, shipment.awb && `AWB ${shipment.awb}`]
      .filter(Boolean)
      .join(", ");
    if (warning) {
      console.warn(
        `Order ${orderName(order.number)}'s courier (${booked}): ${warning}`,
      );
      await tellTeam(ctx, order, { booked, problem: warning });
    }
    const shop = shopUrl();
    await tellCouple(
      ctx,
      order,
      shipmentEmail(
        order,
        { courier: shipment.courier ?? "", awb: shipment.awb ?? "" },
        shop && orderUrl(shop, order.token),
      ),
      `shipment-${shipment.id}`,
    );
    return null;
  },
});

/**
 * Colete Online's word that a parcel's progress changed, through the
 * address its booking gave: Convex asks Colete Online where it is rather
 * than trusting what it was sent. False for an address no booking gave.
 */
export const heard = internalMutation({
  args: { order: v.string(), key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { order: id, key }) => {
    const orderId = ctx.db.normalizeId("orders", id);
    const order = orderId && (await ctx.db.get("orders", orderId));
    if (!orderId || !order || order.shipment?.key !== key) return false;
    if (order.shipment.status === "booked")
      await ctx.scheduler.runAfter(0, internal.shipments.track, {
        orderId,
        key,
      });
    return true;
  },
});

/** For http.ts: Colete Online's webhook, at the address each booking gave. */
export async function handleColeteOnlineWebhook(
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const known = await ctx.runMutation(internal.shipments.heard, {
    order: params.get("order") ?? "",
    key: params.get("key") ?? "",
  });
  return new Response(null, { status: known ? 200 : 404 });
}

/** Asks Colete Online where a booked parcel is, and keeps what it says. */
export const track = internalAction({
  args: { orderId: v.id("orders"), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, key }) => {
    const order: Doc<"orders"> | null = await ctx.runQuery(
      internal.shipments.pending,
      { orderId, key },
    );
    const account = coleteOnline();
    const id = order?.shipment?.id;
    if (!order || !account || !id || order.shipment?.status !== "booked")
      return null;
    try {
      const latest = await tracking(await signIn(account, order.test), id);
      if (latest)
        await ctx.runMutation(internal.shipments.tracked, {
          orderId,
          key,
          tracking: latest,
        });
    } catch (error) {
      // The next change, or the workshop, asks again.
      console.warn(
        `Order ${orderName(order.number)}'s parcel wasn't tracked: ${said(error)}`,
      );
    }
    return null;
  },
});

/** Keeps where a parcel is, unless Convex already knows of later. */
export const tracked = internalMutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    tracking: v.object({
      text: v.string(),
      at: v.number(),
      code: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, key, tracking }) => {
    const order = await ctx.db.get("orders", orderId);
    const shipment = order?.shipment;
    if (!order || shipment?.key !== key) return null;
    if (shipment.tracking && shipment.tracking.at > tracking.at) return null;
    await ctx.db.patch("orders", orderId, {
      shipment: { ...shipment, tracking },
    });
    return null;
  },
});

/** Asks Colete Online again where an order's parcel is, for the workshop. */
export const refresh = mutation({
  args: { number: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { number }) => {
    await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    const shipment = order?.shipment;
    if (
      !order ||
      shipment?.status !== "booked" ||
      !shipment.id ||
      !coleteOnline()
    )
      return false;
    await ctx.scheduler.runAfter(0, internal.shipments.track, {
      orderId: order._id,
      key: shipment.key,
    });
    return true;
  },
});

const { key: _key, label: _label, ...shownFields } = shipmentValidator.fields;

/**
 * An order's parcel as the workshop sees it, with the address its label
 * downloads from: null before anyone booked its courier.
 */
export const forWorkshop = query({
  args: { number: v.number() },
  returns: v.union(
    v.object({ ...shownFields, label: v.optional(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, { number }) => {
    await requireWorkshop(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    const shipment = order?.shipment;
    if (!shipment) return null;
    const { key: _, label: file, ...shown } = shipment;
    const url = file ? await ctx.storage.getUrl(file) : null;
    return { ...shown, ...(url && { label: url }) };
  },
});

/**
 * Records a courier the workshop booked itself, by the AWB it typed, and
 * tells the couple it's on its way: for when Colete Online can't book it.
 * Typing another AWB corrects it, and tells the couple again.
 */
export async function recordShipment(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  typed: { courier: string; awb: string },
): Promise<void> {
  const order = await ctx.db.get("orders", orderId);
  if (!order) throw new ConvexError(errors.notFound);
  const courier = typed.courier.trim();
  const awb = typed.awb.replace(/\s/g, "");
  if (order.delivery?.key !== "courier" || !order.address || !awb)
    throw new ConvexError(errors.invalidInput);
  // Colete Online's booking stands, unless it was refused or got stuck.
  const { shipment } = order;
  if (inFlight(shipment) || (shipment?.status === "booked" && shipment.id))
    throw new ConvexError(errors.shipmentBooked);
  await ctx.db.patch("orders", orderId, {
    shipment: {
      status: "booked",
      at: Date.now(),
      key: randomCode(KEY_LENGTH),
      awb,
      ...(courier && { courier }),
    },
  });
  const shop = shopUrl();
  await tellCouple(
    ctx,
    order,
    shipmentEmail(order, { courier, awb }, shop && orderUrl(shop, order.token)),
    `shipment-${awb}`,
  );
}

/**
 * Tells the couple their order is ready to pick up from the workshop: for
 * the workshop's status change to ready. Once for each order.
 */
export async function recordPickupReady(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<void> {
  const order = await ctx.db.get("orders", orderId);
  if (order?.delivery?.key !== "pickup") return;
  const shop = shopUrl();
  await tellCouple(
    ctx,
    order,
    pickupReadyEmail(order, shop && orderUrl(shop, order.token)),
    "ready",
  );
}
