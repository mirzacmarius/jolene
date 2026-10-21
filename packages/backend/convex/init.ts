import { fees } from "@jolene/products/catalog";
import { catalog } from "@jolene/products/data";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { photoUrl } from "@jolene/products/photos";
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

/** A price in lei, as the catalog lists it, in whole bani, as Convex keeps it. */
const bani = (lei: number) => Math.round(lei * 100);

/** How many products one mutation brings up to date. */
const PRODUCTS_PER_MUTATION = 100;

/**
 * Gives a deployment Jolene's collections (@jolene/suites) in the order the
 * gallery shows them, with the artwork they draw, and the shop's catalog
 * (@jolene/products) as jolene.ro had it (`bun run seed`). The artwork ships
 * with the studio and the photos are in the photo store (ADR 0016), or on
 * jolene.ro until they're copied, so nothing is uploaded. Running it again
 * brings every collection up to date with the code, and every product nobody
 * has changed in Convex.
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

    await ctx.runMutation(internal.shop.load.shelves, {
      categories: catalog.categories,
      lineOptions: catalog.lineOptions.map(({ choices, ...option }) => ({
        ...option,
        choices: choices.map((choice) => ({
          ...choice,
          price: bani(choice.price),
        })),
      })),
      fees: Object.entries(fees).map(([key, fee]) => ({
        key,
        label: fee.label,
        description: fee.description,
        price: bani(fee.price),
      })),
    });
    const listed = catalog.products.map(
      (
        { woo: _, price, compareAtPrice, options, images, ...product },
        position,
      ) => ({
        ...product,
        price: bani(price),
        ...(compareAtPrice === undefined
          ? {}
          : { compareAtPrice: bani(compareAtPrice) }),
        options: options.map(({ name, values }) => ({
          name,
          values: values.map((value) => ({
            name: value.name,
            surcharge: bani(value.surcharge),
          })),
        })),
        images: images.map(({ url, alt }) => ({ source: photoUrl(url), alt })),
        position,
      }),
    );
    const products = [
      ...listed,
      // Bought for one event at a time, from the studio (ADR 0014).
      {
        handle: digitalInvitation.handle,
        title: digitalInvitation.title,
        descriptionHtml: digitalInvitation.descriptionHtml,
        price: bani(digitalInvitation.price),
        options: [],
        lineOptions: [],
        categories: [],
        tags: [],
        images: [],
        fees: [],
        position: listed.length,
        forEvent: true as const,
      },
    ];
    for (let start = 0; start < products.length; start += PRODUCTS_PER_MUTATION)
      await ctx.runMutation(internal.shop.load.products, {
        products: products.slice(start, start + PRODUCTS_PER_MUTATION),
      });
    await ctx.runMutation(internal.shop.load.retire, {
      handles: products.map((product) => product.handle),
    });
    console.info(`Seeded the shop's ${products.length} products`);
    return null;
  },
});
