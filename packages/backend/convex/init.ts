import { suites } from "@jolene/suites";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const contentTypes: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
};

function contentTypeOf(path: string) {
  const type = contentTypes[path.slice(path.lastIndexOf(".") + 1)];
  if (!type) throw new Error(`${path} isn't an image the studio can serve`);
  return type;
}

/**
 * Gives a deployment Jolene's collections (@jolene/suites) in the order the
 * gallery shows them, with the artwork they draw (`bun run seed`). The
 * artwork ships with the studio, so nothing is uploaded. Running it again
 * brings every collection up to date with the code.
 */
export const seed = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const [sortOrder, { templates, art, ...suite }] of suites.entries()) {
      await ctx.runMutation(internal.catalog.save.suite, {
        suite: {
          ...suite,
          sampleFields: suite.sampleFields as Record<string, string>,
          published: true,
          sortOrder,
        },
        templates,
        art: Object.entries(art).map(([key, artwork]) => ({
          key,
          path: artwork.path,
          contentType: contentTypeOf(artwork.path),
          recolorable: artwork.recolorable ?? false,
          name: artwork.name,
        })),
      });
    }
    console.info(`Seeded ${suites.map((suite) => suite.slug).join(", ")}`);
    return null;
  },
});
