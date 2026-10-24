import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { randomCode } from "../invites/codes";
import { errors } from "../utils/errors";
import { rateLimiter } from "../utils/limits";
import { requireOwnDesign } from "./access";

/**
 * A design's viewing link (docs/adr/0023): the couple turns it on to show
 * the design to parents and friends, who see it with the couple's details
 * and change nothing. Its code is as long as a partner's link's: 31 to the
 * 12th, so trying links at random finds no one's.
 */
export const VIEW_CODE_LENGTH = 12;

export const viewCode = () => randomCode(VIEW_CODE_LENGTH);

/** The longest name the studio gives what a picture was drawn from. */
export const MAX_DRAWN_LENGTH = 100;

/**
 * Throws unless the visitor owns the design and its viewing link is on, and
 * neither they nor everyone together have stored many pictures lately,
 * before a picture is stored for it.
 */
export const allow = internalMutation({
  args: { designId: v.id("designs") },
  returns: v.null(),
  handler: async (ctx, { designId }) => {
    const design = await requireOwnDesign(ctx, designId);
    if (!design.viewCode) throw new ConvexError(errors.notFound);
    const mine = await rateLimiter.limit(ctx, "viewImage", {
      key: design.ownerId,
    });
    const everyone = await rateLimiter.limit(ctx, "viewImages");
    if (!mine.ok || !everyone.ok) throw new ConvexError(errors.tooMany);
    return null;
  },
});

/**
 * Gives the design the picture just stored for its link, deleting the one
 * it replaces: every picture a design keeps was stored by attachViewImage,
 * never named by the studio, so no one else's file can be deleted here.
 */
export const setImage = internalMutation({
  args: {
    designId: v.id("designs"),
    image: v.id("_storage"),
    drawn: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const design = await requireOwnDesign(ctx, args.designId);
    if (!design.viewCode) throw new ConvexError(errors.notFound);
    if (design.viewImage) await ctx.storage.delete(design.viewImage);
    await ctx.db.patch("designs", design._id, {
      viewImage: args.image,
      viewImageDrawn: args.drawn,
    });
    return null;
  },
});
