import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { requireInvite } from "./access";

/** Throws unless the visitor manages the invitation, before its picture is stored. */
export const check = internalQuery({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    await requireInvite(ctx, inviteId);
    return null;
  },
});

/**
 * Gives the published design the picture just stored for it, when it's
 * still the design and revision the studio drew, deleting the one it
 * replaces. Every picture an invitation keeps was stored by attachImage,
 * never named by the studio, so no one else's file can be deleted here.
 * Says whether the picture was kept.
 */
export const set = internalMutation({
  args: {
    inviteId: v.id("invites"),
    designId: v.id("designs"),
    revision: v.number(),
    image: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { invite } = await requireInvite(ctx, args.inviteId);
    const published = invite.published;
    if (
      published?.designId !== args.designId ||
      published.revision !== args.revision
    )
      return false;
    if (published.image) await ctx.storage.delete(published.image);
    await ctx.db.patch("invites", invite._id, {
      published: { ...published, image: args.image },
    });
    return true;
  },
});
