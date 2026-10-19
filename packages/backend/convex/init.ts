import { eucalyptusArtwork } from "@jolene/design";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { eucalipt } from "./seed/eucalipt";

/**
 * Gives a deployment the Eucalipt suite and its artwork, so the studio has a
 * design to show before Jolene's own are imported (`bun run seed`). Running it
 * again brings both up to date with the code.
 */
export const seed = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { svg, ...artwork } = eucalyptusArtwork;
    const storageId = await ctx.storage.store(
      new Blob([svg], { type: artwork.contentType }),
    );
    await ctx.runMutation(internal.catalog.save.asset, {
      ...artwork,
      storageId,
      kind: "artwork",
      recolorable: true,
    });

    const { templates, ...suite } = eucalipt;
    await ctx.runMutation(internal.catalog.save.suite, {
      suite: {
        ...suite,
        styles: [...suite.styles],
        published: true,
        sortOrder: 0,
      },
      templates: templates.map((template) => ({ ...template })),
    });
    console.info(`Seeded the ${suite.name.ro} suite`);
    return null;
  },
});
