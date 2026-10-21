import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { proofSummaryValidator, summarize } from "./proofs";
import { photoValidator, photoView } from "./shop/photos";
import {
  type LineChoices,
  lineProblemValidator,
  loadProduct,
  MAX_QUANTITY,
  normalizeLine,
  orderFees,
  problems,
  unitPrice,
} from "./shop/pricing";
import { answerValidator, pickedValidator } from "./shop/validators";
import { errors } from "./utils/errors";

/**
 * The shortest token the shop's server may make for a cart: it's the cart's
 * only key, so it must be too long to guess.
 */
const MIN_TOKEN_LENGTH = 32;

const lineValidator = v.object({
  id: v.id("cartLines"),
  handle: v.string(),
  title: v.string(),
  image: v.union(photoValidator, v.null()),
  quantity: v.number(),
  minQuantity: v.optional(v.number()),
  options: v.array(pickedValidator),
  answers: v.array(v.object({ label: v.string(), value: v.string() })),
  fees: v.array(v.string()),
  proof: v.optional(
    v.object({ id: v.id("proofs"), ...proofSummaryValidator.fields }),
  ),
  /** One of it, in bani, with its options' surcharges and paid choices. */
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  /** `price` times `quantity`. */
  total: v.number(),
  problems: v.array(lineProblemValidator),
});

const cartValidator = v.object({
  lines: v.array(lineValidator),
  /** What the order pays once, whatever the quantities. */
  fees: v.array(
    v.object({ key: v.string(), label: v.string(), price: v.number() }),
  ),
  /** The lines and the fees together, in bani, before delivery. */
  total: v.number(),
  /** How many lines: each a product, as the couple chose it. */
  count: v.number(),
});

async function findCart(ctx: QueryCtx, token: string) {
  if (token.length < MIN_TOKEN_LENGTH) return null;
  return await ctx.db
    .query("carts")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

async function linesOf(ctx: QueryCtx, cartId: Id<"carts">) {
  return await ctx.db
    .query("cartLines")
    .withIndex("by_cartId", (q) => q.eq("cartId", cartId))
    .take(100);
}

async function lineInCart(
  ctx: MutationCtx,
  token: string,
  lineId: Id<"cartLines">,
) {
  const cart = await findCart(ctx, token);
  const line = await ctx.db.get("cartLines", lineId);
  if (!cart || !line || line.cartId !== cart._id)
    throw new ConvexError(errors.notFound);
  return { cart, line };
}

/** Whether two lines ask the same of the same product. */
function sameLine(
  a: Pick<Doc<"cartLines">, "productId" | "proofId"> & LineChoices,
  b: Pick<Doc<"cartLines">, "productId" | "proofId"> & LineChoices,
) {
  const choices = ({ options, answers, fees }: LineChoices) =>
    JSON.stringify([options, answers, fees]);
  return (
    a.productId === b.productId &&
    a.proofId === b.proofId &&
    choices(a) === choices(b)
  );
}

/**
 * A cart as the shop shows it, priced from the catalog as it is now: each
 * line with what stops it being ordered, if anything, and the fees the order
 * pays once. Null for a token that has no cart.
 */
export const get = query({
  args: { token: v.string() },
  returns: v.union(cartValidator, v.null()),
  handler: async (ctx, { token }) => {
    const cart = await findCart(ctx, token);
    if (!cart) return null;
    const lines = (
      await Promise.all(
        (
          await linesOf(ctx, cart._id)
        ).map(async (line) => {
          const product = await ctx.db.get("products", line.productId);
          return product && { line, product: await loadProduct(ctx, product) };
        }),
      )
    ).flatMap((found) => (found ? [found] : []));

    const fees = orderFees(
      lines.map(({ line, product }) => ({ product, choices: line })),
    ).map(({ key, label, price }) => ({ key, label, price }));
    const priced = await Promise.all(
      lines.map(async ({ line, product }) => {
        const { price, compareAtPrice } = unitPrice(product, line);
        const proof = line.proofId && (await summarize(ctx, line.proofId));
        const image = product.product.images[0];
        return {
          id: line._id,
          handle: product.product.handle,
          title: product.product.title,
          image: image ? await photoView(ctx, image) : null,
          quantity: line.quantity,
          minQuantity: product.product.minQuantity,
          options: line.options,
          answers: line.answers.flatMap(({ key, value }) => {
            const option = product.lineOptions.find((o) => o.key === key);
            return option ? [{ label: option.label, value }] : [];
          }),
          fees: line.fees,
          proof:
            line.proofId && proof ? { id: line.proofId, ...proof } : undefined,
          price,
          compareAtPrice,
          total: price * line.quantity,
          problems: problems(product, line),
        };
      }),
    );
    return {
      lines: priced,
      fees,
      total:
        priced.reduce((sum, line) => sum + line.total, 0) +
        fees.reduce((sum, fee) => sum + fee.price, 0),
      count: priced.length,
    };
  },
});

/**
 * Puts a product in the cart with the couple's choices, adding to the line
 * that already asks the same. Makes the cart on its first line, under the
 * token the shop's server made for it.
 */
export const add = mutation({
  args: {
    token: v.string(),
    handle: v.string(),
    quantity: v.number(),
    options: v.array(pickedValidator),
    answers: v.array(answerValidator),
    fees: v.array(v.string()),
    /** A proof the couple approved in the studio for this product. */
    proofId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { token, handle, proofId: rawProofId, ...choices }) => {
    if (token.length < MIN_TOKEN_LENGTH) throw new ConvexError(errors.notFound);
    const product = await ctx.db
      .query("products")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!product?.published) throw new ConvexError(errors.productUnavailable);
    const line = normalizeLine(await loadProduct(ctx, product), choices);
    if (!line) throw new ConvexError(errors.invalidLine);

    let proofId: Id<"proofs"> | undefined;
    if (rawProofId !== undefined) {
      proofId = ctx.db.normalizeId("proofs", rawProofId) ?? undefined;
      const proof = proofId && (await summarize(ctx, proofId));
      if (!proof || proof.product !== handle)
        throw new ConvexError(errors.invalidLine);
    }

    const now = Date.now();
    const cart = await findCart(ctx, token);
    const cartId =
      cart?._id ?? (await ctx.db.insert("carts", { token, updatedAt: now }));
    if (cart) await ctx.db.patch("carts", cart._id, { updatedAt: now });

    const wanted = {
      productId: product._id,
      ...line,
      ...(proofId === undefined ? {} : { proofId }),
    };
    const existing = cart
      ? (await linesOf(ctx, cart._id)).find((other) => sameLine(other, wanted))
      : undefined;
    if (existing)
      await ctx.db.patch("cartLines", existing._id, {
        quantity: Math.min(existing.quantity + line.quantity, MAX_QUANTITY),
      });
    else await ctx.db.insert("cartLines", { cartId, ...wanted });
    return null;
  },
});

/** Changes how many of a line the cart holds; none takes it out. */
export const setQuantity = mutation({
  args: { token: v.string(), lineId: v.id("cartLines"), quantity: v.number() },
  returns: v.null(),
  handler: async (ctx, { token, lineId, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY)
      throw new ConvexError(errors.invalidLine);
    const { cart } = await lineInCart(ctx, token, lineId);
    if (quantity === 0) await ctx.db.delete("cartLines", lineId);
    else await ctx.db.patch("cartLines", lineId, { quantity });
    await ctx.db.patch("carts", cart._id, { updatedAt: Date.now() });
    return null;
  },
});

/** Takes a line out of the cart. */
export const remove = mutation({
  args: { token: v.string(), lineId: v.id("cartLines") },
  returns: v.null(),
  handler: async (ctx, { token, lineId }) => {
    const { cart } = await lineInCart(ctx, token, lineId);
    await ctx.db.delete("cartLines", lineId);
    await ctx.db.patch("carts", cart._id, { updatedAt: Date.now() });
    return null;
  },
});
