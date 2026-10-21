import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { choiceValidator, lineOptionKindValidator } from "../shop/validators";
import { errors } from "../utils/errors";
import { requireWorkshop } from "./staff";

/**
 * The shop's order options in the workshop, at /studio/atelier/optiuni: what
 * each asks, whether it must be answered, and a select's choices and what
 * each adds. An option is the same on every product that asks it, so a
 * change shows on all of them. Its key and kind stay as the seed made them:
 * the cart answers an option by its key. A changed option is the team's
 * (editedAt), and the seed leaves it alone.
 */

/** The most order options the workshop reads: far more than the shop has. */
const LINE_OPTIONS_READ = 500;

/** The most products the workshop reads to see which ask an option. */
const PRODUCTS_READ = 2000;

/** The longest an option's name, or one of its choices', can be. */
const LABEL_LENGTH = 100;

/** The longest the line under an option's name can be. */
const HINT_LENGTH = 300;

/** The most choices a select can have: jolene.ro's had 12 at most. */
const MOST_CHOICES = 40;

/** The most a choice can add, in bani: 100.000 lei, as a product's price. */
const MOST_BANI = 10_000_000;

/** An order option as the workshop's list shows it. */
const optionRowValidator = v.object({
  handle: v.string(),
  key: v.string(),
  label: v.string(),
  hint: v.union(v.string(), v.null()),
  kind: lineOptionKindValidator,
  required: v.boolean(),
  choices: v.array(choiceValidator),
  /** How many products ask it, for sale or not. */
  askedBy: v.number(),
  /** When the team last changed it: null as the seed left it. */
  editedAt: v.union(v.number(), v.null()),
});

/** An order option with all the workshop can change on it, and who asks it. */
const workshopOptionValidator = v.object({
  handle: v.string(),
  key: v.string(),
  label: v.string(),
  hint: v.union(v.string(), v.null()),
  kind: lineOptionKindValidator,
  required: v.boolean(),
  choices: v.array(choiceValidator),
  /** The products that ask it: those for sale first, by name. */
  products: v.array(
    v.object({ handle: v.string(), title: v.string(), published: v.boolean() }),
  ),
  /**
   * The other options that ask the same (its key), each with its own
   * choices or prices: a product asks one of them, and its answer is theirs.
   */
  sharing: v.array(
    v.object({
      handle: v.string(),
      label: v.string(),
      hint: v.union(v.string(), v.null()),
      kind: lineOptionKindValidator,
      required: v.boolean(),
      choices: v.array(choiceValidator),
    }),
  ),
  /** When the team last changed it, and who: null as the seed left it. */
  editedAt: v.union(v.number(), v.null()),
  editedBy: v.union(v.string(), v.null()),
});

/** By name, then those of the same name in the seed's order: 2 before 10. */
const byLabel = (a: Doc<"lineOptions">, b: Doc<"lineOptions">) =>
  a.label.localeCompare(b.label, "ro") ||
  a.handle.localeCompare(b.handle, "ro", { numeric: true });

const products = (ctx: QueryCtx) =>
  ctx.db.query("products").take(PRODUCTS_READ);

const optionByHandle = (ctx: QueryCtx, handle: string) =>
  ctx.db
    .query("lineOptions")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();

/** A choice's name as the option compares it with its other choices'. */
const nameOf = (label: string) => label.toLocaleLowerCase("ro");

/** Every order option the shop has, by name, with how many products ask it. */
export const list = query({
  args: {},
  returns: v.array(optionRowValidator),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    const [options, all] = await Promise.all([
      ctx.db.query("lineOptions").take(LINE_OPTIONS_READ),
      products(ctx),
    ]);
    const asked = new Map<string, number>();
    for (const product of all)
      for (const handle of product.lineOptions)
        asked.set(handle, (asked.get(handle) ?? 0) + 1);
    return options.sort(byLabel).map((option) => ({
      handle: option.handle,
      key: option.key,
      label: option.label,
      hint: option.hint ?? null,
      kind: option.kind,
      required: option.required,
      choices: option.choices,
      askedBy: asked.get(option.handle) ?? 0,
      editedAt: option.editedAt ?? null,
    }));
  },
});

/** One order option, all the workshop can change on it; null for an unknown one. */
export const option = query({
  args: { handle: v.string() },
  returns: v.union(workshopOptionValidator, v.null()),
  handler: async (ctx, { handle }) => {
    await requireWorkshop(ctx);
    const option = await optionByHandle(ctx, handle);
    if (!option) return null;
    const [options, all] = await Promise.all([
      ctx.db.query("lineOptions").take(LINE_OPTIONS_READ),
      products(ctx),
    ]);
    return {
      handle: option.handle,
      key: option.key,
      label: option.label,
      hint: option.hint ?? null,
      kind: option.kind,
      required: option.required,
      choices: option.choices,
      products: all
        .filter((product) => product.lineOptions.includes(handle))
        .sort(
          (a, b) =>
            Number(b.published) - Number(a.published) ||
            a.title.localeCompare(b.title, "ro", { numeric: true }),
        )
        .map((product) => ({
          handle: product.handle,
          title: product.title,
          published: product.published,
        })),
      sharing: options
        .filter((other) => other.key === option.key && other.handle !== handle)
        .sort(byLabel)
        .map((other) => ({
          handle: other.handle,
          label: other.label,
          hint: other.hint ?? null,
          kind: other.kind,
          required: other.required,
          choices: other.choices,
        })),
      editedAt: option.editedAt ?? null,
      editedBy: option.editedBy ?? null,
    };
  },
});

/** A whole number of bani from 0 up to MOST_BANI. */
const isBani = (amount: number) =>
  Number.isInteger(amount) && amount >= 0 && amount <= MOST_BANI;

/**
 * Changes an order option from the version the workshop's page showed: its
 * name, the line under it, whether it must be answered, and a select's
 * choices, in order, with what each adds to each one ordered. If someone
 * changed it since, nothing changes (line-option-changed), and the page shows
 * their version. A cart whose answer is no longer one of its choices asks
 * the couple to add the product again; paid orders keep what they chose.
 */
export const save = mutation({
  args: {
    handle: v.string(),
    /** When the option was last changed, as the page showed it; null if never. */
    editedAt: v.union(v.number(), v.null()),
    label: v.string(),
    /** The line under its name; empty for none. */
    hint: v.string(),
    required: v.boolean(),
    /** A select's choices, in order, each price in bani; none for the others. */
    choices: v.array(choiceValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const by = await requireWorkshop(ctx);
    const option = await optionByHandle(ctx, args.handle);
    if (!option) throw new ConvexError(errors.notFound);
    if ((option.editedAt ?? null) !== args.editedAt)
      throw new ConvexError(errors.lineOptionChanged);

    const label = args.label.trim();
    const hint = args.hint.trim();
    const choices = args.choices.map((choice) => ({
      label: choice.label.trim(),
      price: choice.price,
    }));
    const names = new Set(choices.map((choice) => nameOf(choice.label)));
    if (
      !label ||
      label.length > LABEL_LENGTH ||
      hint.length > HINT_LENGTH ||
      (option.kind === "select"
        ? choices.length === 0 ||
          choices.length > MOST_CHOICES ||
          names.size !== choices.length ||
          choices.some(
            (choice) =>
              !choice.label ||
              choice.label.length > LABEL_LENGTH ||
              !isBani(choice.price),
          )
        : choices.length > 0)
    )
      throw new ConvexError(errors.invalidInput);

    const unchanged =
      label === option.label &&
      hint === (option.hint ?? "") &&
      args.required === option.required &&
      choices.length === option.choices.length &&
      choices.every(
        (choice, index) =>
          choice.label === option.choices[index]?.label &&
          choice.price === option.choices[index].price,
      );
    // Saving nothing new leaves it the seed's, if it was.
    if (unchanged) return null;

    await ctx.db.patch("lineOptions", option._id, {
      label,
      hint: hint || undefined,
      required: args.required,
      choices,
      editedAt: Date.now(),
      editedBy: by,
    });
    return null;
  },
});
