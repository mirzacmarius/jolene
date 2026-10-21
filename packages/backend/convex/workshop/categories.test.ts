import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { catalog } from "@jolene/products/data";
import { testConvex } from "../../test/convex";
import { api, internal } from "../_generated/api";
import { handleOf } from "./categories";

const workshopEnv = ["WORKSHOP_EMAILS", "SITE_URL"] as const;

beforeEach(() => {
  Object.assign(process.env, {
    WORKSHOP_EMAILS: "atelier@jolene.ro",
    SITE_URL: "https://www.orvibo.it/studio",
  });
});

// The functions read the environment through the same process.env object.
afterEach(() => {
  for (const name of workshopEnv) Reflect.deleteProperty(process.env, name);
  setSystemTime();
});

const firstPage = { numItems: 1000, cursor: null };

/** Luna: 8,50 lei, from 20, in two categories, with no papers to choose. */
const LUNA = "18207";

/** The catalog, and who signs in: the workshop, and a couple. */
async function setUp() {
  const t = testConvex();
  await t.action(internal.init.seed, {});
  const signIn = async (user: {
    email?: string;
    emailVerificationTime?: number;
  }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", user));
    // Convex Auth's subject is the user id and the session id.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  return {
    t,
    couple: await signIn({}),
    workshop: await signIn({
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
  };
}

type Workshop = Awaited<ReturnType<typeof setUp>>["workshop"];

/** What the workshop's page sends to save the list as it shows it. */
async function asShown(workshop: Workshop) {
  const { categories, version } = await workshop.query(
    api.workshop.categories.list,
    {},
  );
  return {
    version,
    categories: categories.map(({ handle, title }) => ({ handle, title })),
  };
}

/** The shop's categories' addresses and names, in its order. */
async function shopShelves(t: Awaited<ReturnType<typeof setUp>>["t"]) {
  const categories = await t.query(api.shop.categories, {});
  return categories.map(({ handle, title }) => ({ handle, title }));
}

/** Puts Luna on a category too, as its product page does. */
async function shelveLuna(workshop: Workshop, category: string) {
  const product = catalog.products.find(({ handle }) => handle === LUNA);
  if (!product) throw new Error(`The catalog has no ${LUNA}`);
  await workshop.mutation(api.workshop.products.save, {
    handle: LUNA,
    editedAt: null,
    title: product.title,
    price: 850,
    compareAtPrice: null,
    minQuantity: 20,
    surcharges: [],
    published: true,
    photos: product.images.map(({ alt }, kept) => ({ kept, alt })),
    categories: [...product.categories, category],
    lineOptions: product.lineOptions,
  });
}

describe("an address from a category's name", () => {
  test("keeps its letters without their marks, and hyphens the rest", () => {
    expect(handleOf("Mărturii de botez")).toBe("marturii-de-botez");
    expect(handleOf("Țări & Șampanie!")).toBe("tari-sampanie");
    // jolene.ro's older names were typed with a cedilla.
    expect(handleOf("Invitaţii nunţă")).toBe("invitatii-nunta");
    expect(handleOf("  -- Save the date --  ")).toBe("save-the-date");
    expect(handleOf("✿")).toBe("");
    expect(handleOf("a".repeat(80))).toHaveLength(60);
  });
});

describe("the workshop's categories", () => {
  test("lists the shop's, in its order, with what each has for sale", async () => {
    const { t, workshop } = await setUp();
    const list = await workshop.query(api.workshop.categories.list, {});
    expect(
      list.categories.map(({ handle, title }) => ({ handle, title })),
    ).toEqual(
      catalog.categories.map(({ handle, title }) => ({ handle, title })),
    );
    expect(list.editedAt).toBeNull();
    expect(list.editedBy).toBeNull();
    for (const category of list.categories) {
      const shelf = await t.query(api.shop.products, {
        category: category.handle,
        paginationOpts: firstPage,
      });
      expect(category.forSale).toBe(shelf.page.length);
      expect(category.more).toBe(false);
      expect(category.page).toBe(
        `https://www.orvibo.it/collections/${category.handle}`,
      );
    }
  });

  test("renames and reorders them, which the shop shows and the seed keeps", async () => {
    const { t, workshop } = await setUp();
    const shown = await asShown(workshop);
    const weddings = shown.categories.find(
      ({ handle }) => handle === "invitatii-nunta",
    );
    if (!weddings) throw new Error("The seed has wedding invitations");
    const categories = [
      { ...weddings, title: "  Invitații de nuntă " },
      ...shown.categories.filter((category) => category !== weddings),
    ];
    await workshop.mutation(api.workshop.categories.save, {
      version: shown.version,
      categories,
    });

    const saved = categories.map(({ handle, title }) => ({
      handle,
      title: title.trim(),
    }));
    expect(await shopShelves(t)).toEqual(saved);
    const list = await workshop.query(api.workshop.categories.list, {});
    expect(list.editedBy).toBe("atelier@jolene.ro");
    expect(list.editedAt).toBeNumber();
    // The product page names the category as the team does.
    expect(
      (await t.query(api.shop.category, { handle: "invitatii-nunta" }))?.title,
    ).toBe("Invitații de nuntă");

    await t.action(internal.init.seed, {});
    expect(await shopShelves(t)).toEqual(saved);
  });

  test("adds one with an address of its own, shown in the shop once a product is on it", async () => {
    const { t, workshop } = await setUp();
    const shown = await asShown(workshop);
    await workshop.mutation(api.workshop.categories.save, {
      version: shown.version,
      categories: [
        { title: "Mărturii de cununie" },
        ...shown.categories,
        // An address another category has, or the shop's page of all.
        { title: "Agende!" },
        { title: "All" },
        { title: "✿" },
      ],
    });

    const list = await workshop.query(api.workshop.categories.list, {});
    expect(list.categories.map(({ handle }) => handle)).toEqual([
      "marturii-de-cununie",
      ...shown.categories.map(({ handle }) => handle),
      "agende-2",
      "all-2",
      "categorie",
    ]);
    expect(list.categories[0]).toMatchObject({
      title: "Mărturii de cununie",
      forSale: 0,
    });
    // Nothing is for sale on it yet, so the shop leaves it out.
    const before = await shopShelves(t);
    expect(before.map(({ handle }) => handle)).toEqual(
      shown.categories.map(({ handle }) => handle),
    );

    await shelveLuna(workshop, "marturii-de-cununie");
    expect((await shopShelves(t))[0]).toEqual({
      handle: "marturii-de-cununie",
      title: "Mărturii de cununie",
    });
    const shelf = await t.query(api.shop.products, {
      category: "marturii-de-cununie",
      paginationOpts: firstPage,
    });
    expect(shelf.page.map((product) => product.handle)).toEqual([LUNA]);

    // The seed leaves the team's categories as they are.
    await t.action(internal.init.seed, {});
    expect(
      (await workshop.query(api.workshop.categories.list, {})).categories.map(
        ({ handle, title }) => ({ handle, title }),
      ),
    ).toEqual(list.categories.map(({ handle, title }) => ({ handle, title })));
  });

  test("gives a new one no address a product is still on", async () => {
    const { t, workshop } = await setUp();
    // A category the shop dropped, whose products still name it.
    await t.run(async (ctx) => {
      const agende = await ctx.db
        .query("categories")
        .withIndex("by_handle", (q) => q.eq("handle", "agende"))
        .unique();
      if (agende) await ctx.db.delete("categories", agende._id);
    });
    const shown = await asShown(workshop);
    await workshop.mutation(api.workshop.categories.save, {
      version: shown.version,
      categories: [...shown.categories, { title: "Agende" }],
    });
    const list = await workshop.query(api.workshop.categories.list, {});
    expect(list.categories.at(-1)).toMatchObject({
      handle: "agende-2",
      title: "Agende",
      forSale: 0,
    });
  });

  test("changes nothing from a list someone else's change made old", async () => {
    const { workshop } = await setUp();
    const shown = await asShown(workshop);
    const [first, ...rest] = shown.categories;
    if (!first) throw new Error("The seed has categories");
    await workshop.mutation(api.workshop.categories.save, {
      version: shown.version,
      categories: [...rest, first],
    });
    await expect(
      workshop.mutation(api.workshop.categories.save, {
        version: shown.version,
        categories: [{ ...first, title: "Accesorii" }, ...rest],
      }),
    ).rejects.toThrow("categories-changed");
    const list = await workshop.query(api.workshop.categories.list, {});
    expect(list.categories.at(-1)?.title).toBe(first.title);
  });

  test("leaves them the seed's when saving them as they are", async () => {
    const { t, workshop } = await setUp();
    await workshop.mutation(
      api.workshop.categories.save,
      await asShown(workshop),
    );
    expect(
      (await workshop.query(api.workshop.categories.list, {})).editedAt,
    ).toBeNull();
    const kept = await t.run((ctx) => ctx.db.query("categories").collect());
    expect(kept.every((category) => category.editedAt === undefined)).toBe(
      true,
    );
  });

  test("refuses a list that drops a category, repeats one, or names one as it can't", async () => {
    const { workshop } = await setUp();
    const { version, categories } = await asShown(workshop);
    const [first, second, ...rest] = categories;
    if (!first || !second) throw new Error("The seed has categories");
    for (const refused of [
      // One taken away, or listed twice.
      [second, ...rest],
      [first, first, ...rest],
      [first, second, ...rest, { handle: "colectia-noua", title: "Nouă" }],
      // A name that's empty, too long, or another category's.
      [{ ...first, title: " " }, second, ...rest],
      [{ ...first, title: "A".repeat(101) }, second, ...rest],
      [first, { ...second, title: first.title.toUpperCase() }, ...rest],
      [first, second, ...rest, { title: ` ${first.title.toLowerCase()} ` }],
      // More than the shop can have.
      [
        ...categories,
        ...Array.from({ length: 100 - categories.length + 1 }, (_, number) => ({
          title: `Categoria ${number}`,
        })),
      ],
    ])
      await expect(
        workshop.mutation(api.workshop.categories.save, {
          version,
          categories: refused,
        }),
      ).rejects.toThrow("invalid-input");
    expect((await asShown(workshop)).categories).toEqual(categories);
  });

  test("open to the workshop alone", async () => {
    const { couple, workshop } = await setUp();
    await expect(
      couple.query(api.workshop.categories.list, {}),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.mutation(api.workshop.categories.save, await asShown(workshop)),
    ).rejects.toThrow("workshop-only");
  });
});
