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

/** Classic Roses' invitation: 6,30 lei, and 1 leu for its ivory paper. */
const ROSES = "invitatie-de-nunta-classic-roses";

/** A line of Classic Roses with a seal of a colour, as the shop adds it. */
const roses = (token: string, seal: string) => ({
  token,
  handle: ROSES,
  quantity: 30,
  options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
  answers: [
    { key: "culoare-sigiliu", value: seal },
    { key: "text-personalizat", value: "Ana și Mihai" },
  ],
  fees: [],
});

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

/** What the option's page sends to save it as it shows it. */
async function asShown(workshop: Workshop, handle: string) {
  const option = await workshop.query(api.workshop.lineOptions.option, {
    handle,
  });
  if (!option) throw new Error(`The seed has no ${handle}`);
  return {
    handle,
    editedAt: option.editedAt,
    label: option.label,
    hint: option.hint ?? "",
    required: option.required,
    choices: option.choices,
  };
}

/** The catalog's products that ask an option. */
const askers = (handle: string) =>
  catalog.products.filter((product) => product.lineOptions.includes(handle));

describe("the workshop's order options", () => {
  test("lists every one by name, with how many products ask it", async () => {
    const { workshop } = await setUp();
    const options = await workshop.query(api.workshop.lineOptions.list, {});
    expect(options).toHaveLength(catalog.lineOptions.length);
    const labels = options.map((option) => option.label);
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, "ro")),
    );
    for (const option of options) {
      expect(option.askedBy).toBe(askers(option.handle).length);
      expect(option.editedAt).toBeNull();
    }
    // Those of one name in the seed's order, the tenth after the second.
    expect(
      options
        .filter((option) => option.key === "culoare-plic")
        .map((option) => option.handle)
        .slice(0, 3),
    ).toEqual(["culoare-plic", "culoare-plic-2", "culoare-plic-3"]);
    const seal = options.find((option) => option.handle === "culoare-sigiliu");
    expect(seal).toMatchObject({
      key: "culoare-sigiliu",
      label: "Culoare sigiliu",
      kind: "select",
      required: false,
      shows: "seal",
    });
    expect(
      options.find((option) => option.handle === "flori-criogenate")?.shows,
    ).toBeNull();
    // Its prices in bani, as the shop keeps them.
    expect(seal?.choices.slice(0, 2)).toEqual([
      { label: "Fără sigiliu", price: 0 },
      { label: "Alb", price: 150 },
    ]);
  });

  test("shows one with the products that ask it and those that share its answer", async () => {
    const { t, workshop } = await setUp();
    const asking = askers("culoare-plic-2");
    const [offSale] = asking;
    if (!offSale) throw new Error("A product asks culoare-plic-2");
    await t.run(async (ctx) => {
      const product = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) => q.eq("handle", offSale.handle))
        .unique();
      if (product)
        await ctx.db.patch("products", product._id, { published: false });
    });

    const option = await workshop.query(api.workshop.lineOptions.option, {
      handle: "culoare-plic-2",
    });
    expect(option).toMatchObject({
      handle: "culoare-plic-2",
      key: "culoare-plic",
      label: "Culoare plic",
      hint: null,
      kind: "select",
      required: false,
      editedAt: null,
      editedBy: null,
    });
    expect(option?.products.map((product) => product.handle).sort()).toEqual(
      asking.map((product) => product.handle).sort(),
    );
    // Those for sale first, by name; the one taken off sale last.
    const forSale = option?.products.filter((product) => product.published);
    expect(forSale?.map((product) => product.title)).toEqual(
      forSale
        ?.map((product) => product.title)
        .sort((a, b) => a.localeCompare(b, "ro", { numeric: true })),
    );
    expect(option?.products.at(-1)).toEqual({
      handle: offSale.handle,
      title: offSale.title,
      published: false,
    });
    expect(option?.sharing.map((other) => other.handle)).toEqual(
      catalog.lineOptions
        .filter(
          (other) =>
            other.key === "culoare-plic" && other.handle !== "culoare-plic-2",
        )
        .map((other) => other.handle),
    );
    expect(
      await workshop.query(api.workshop.lineOptions.option, {
        handle: "nowhere",
      }),
    ).toBeNull();
  });

  test("changes a select's name, choices and prices on every product that asks it", async () => {
    const { t, workshop } = await setUp();
    await t.mutation(api.cart.add, roses("a".repeat(40), "Alb"));
    await t.mutation(api.cart.add, roses("b".repeat(40), "Blue"));
    const shown = await asShown(workshop, "culoare-sigiliu");
    const choices = [
      ...shown.choices.map((choice) =>
        choice.label === "Alb"
          ? { ...choice, price: 200 }
          : choice.label === "Blue"
            ? { ...choice, label: "Bleu" }
            : choice,
      ),
      { label: " Lavandă ", price: 150 },
    ];
    await workshop.mutation(api.workshop.lineOptions.save, {
      ...shown,
      label: "  Culoarea sigiliului ",
      hint: "Ceara sigiliului, în culoarea aleasă.",
      choices,
    });

    const saved = choices.map((choice) => ({
      ...choice,
      label: choice.label.trim(),
    }));
    const option = await workshop.query(api.workshop.lineOptions.option, {
      handle: "culoare-sigiliu",
    });
    expect(option).toMatchObject({
      label: "Culoarea sigiliului",
      hint: "Ceara sigiliului, în culoarea aleasă.",
      choices: saved,
      editedBy: "atelier@jolene.ro",
    });
    expect(option?.editedAt).toBeNumber();
    // Every product that asks it shows it so.
    for (const handle of [ROSES, askers("culoare-sigiliu").at(-1)?.handle]) {
      const product = await t.query(api.shop.product, { handle: handle ?? "" });
      expect(
        product?.lineOptions.find(
          (other) => other.handle === "culoare-sigiliu",
        ),
      ).toMatchObject({ label: "Culoarea sigiliului", choices: saved });
    }

    // A cart's line costs what its choice adds now: 6,30 + 1 + 2 lei.
    const white = await t.query(api.cart.get, { token: "a".repeat(40) });
    expect(white?.lines[0]).toMatchObject({ price: 930, problems: [] });
    // One whose choice was renamed asks the couple to choose again.
    const blue = await t.query(api.cart.get, { token: "b".repeat(40) });
    expect(blue?.lines[0]?.problems).toEqual([
      { kind: "changed", label: "Culoarea sigiliului" },
    ]);

    // The seed leaves it as the team made it.
    await t.action(internal.init.seed, {});
    expect(
      await workshop.query(api.workshop.lineOptions.option, {
        handle: "culoare-sigiliu",
      }),
    ).toEqual(option);
  });

  test("gives each choice the look the team sets, which the studio shows", async () => {
    const { t, workshop } = await setUp();
    const shown = await asShown(workshop, "culoare-sigiliu");
    // jolene.ro's choices show their wax until the team changes it.
    expect(shown.choices.slice(0, 3)).toEqual([
      { label: "Fără sigiliu", price: 0, look: { kind: "seal", color: null } },
      { label: "Alb", price: 150, look: { kind: "seal", color: "#f4f1ea" } },
      { label: "Bronz", price: 150, look: { kind: "seal", color: "#8a5a2b" } },
    ]);
    await workshop.mutation(api.workshop.lineOptions.save, {
      ...shown,
      choices: [
        ...shown.choices.map((choice) =>
          choice.label === "Bronz"
            ? { ...choice, look: { kind: "seal" as const, color: "#7A4A1B" } }
            : choice.label === "Alb"
              ? { ...choice, look: null }
              : choice,
        ),
        { label: "Lavandă", price: 150 },
      ],
    });

    const option = await workshop.query(api.workshop.lineOptions.option, {
      handle: "culoare-sigiliu",
    });
    expect(option?.choices.slice(0, 3)).toEqual([
      { label: "Fără sigiliu", price: 0, look: { kind: "seal", color: null } },
      // Choosing it leaves a design's seal as it is.
      { label: "Alb", price: 150, look: null },
      { label: "Bronz", price: 150, look: { kind: "seal", color: "#7a4a1b" } },
    ]);
    // A new choice shows nothing until the team gives it a look.
    expect(option?.choices.at(-1)).toEqual({
      label: "Lavandă",
      price: 150,
      look: null,
    });
    const product = await t.query(api.catalog.product, {
      template: "royal-blue-invitatie",
    });
    expect(product?.lineOptions[0]?.choices).toEqual(option?.choices ?? []);
  });

  test("changes what a written one asks, and whether it must be answered", async () => {
    const { t, workshop } = await setUp();
    const shown = await asShown(workshop, "text-personalizat-5");
    expect(shown).toMatchObject({
      label: "Text personalizat",
      hint: "Textul pentru eticheta personalizată.",
      required: false,
      choices: [],
    });
    await expect(
      workshop.mutation(api.workshop.lineOptions.save, {
        ...shown,
        choices: [{ label: "Da", price: 0 }],
      }),
    ).rejects.toThrow("invalid-input");
    await workshop.mutation(api.workshop.lineOptions.save, {
      ...shown,
      label: "Textul etichetei",
      hint: " ",
      required: true,
    });
    const option = await workshop.query(api.workshop.lineOptions.option, {
      handle: "text-personalizat-5",
    });
    expect(option).toMatchObject({
      label: "Textul etichetei",
      hint: null,
      required: true,
    });
    const [asker] = askers("text-personalizat-5");
    if (!asker) throw new Error("A product asks text-personalizat-5");
    const product = await t.query(api.shop.product, { handle: asker.handle });
    const shownInShop = product?.lineOptions.find(
      (other) => other.handle === "text-personalizat-5",
    );
    expect(shownInShop).toMatchObject({
      label: "Textul etichetei",
      required: true,
    });
    expect(shownInShop?.hint).toBeUndefined();
  });

  test("changes nothing from a page someone else's change made old", async () => {
    const { workshop } = await setUp();
    const shown = await asShown(workshop, "ciucure");
    await workshop.mutation(api.workshop.lineOptions.save, {
      ...shown,
      label: "Ciucure de mătase",
    });
    await expect(
      workshop.mutation(api.workshop.lineOptions.save, {
        ...shown,
        required: true,
      }),
    ).rejects.toThrow("line-option-changed");
    expect(
      await workshop.query(api.workshop.lineOptions.option, {
        handle: "ciucure",
      }),
    ).toMatchObject({ label: "Ciucure de mătase", required: false });
  });

  test("leaves one the seed's when saving it as it is", async () => {
    const { t, workshop } = await setUp();
    // One whose choices show in the studio, and one asked in words.
    for (const handle of ["panglica-5", "flori-criogenate"]) {
      await workshop.mutation(
        api.workshop.lineOptions.save,
        await asShown(workshop, handle),
      );
      const stored = await t.run((ctx) =>
        ctx.db
          .query("lineOptions")
          .withIndex("by_handle", (q) => q.eq("handle", handle))
          .unique(),
      );
      expect(stored?.editedAt).toBeUndefined();
      expect(stored?.editedBy).toBeUndefined();
    }
  });

  test("refuses what an option can't have", async () => {
    const { workshop } = await setUp();
    const shown = await asShown(workshop, "culoare-sigiliu");
    const [none, white, ...rest] = shown.choices;
    if (!none || !white) throw new Error("The seal has choices");
    for (const refused of [
      // A name that's empty or too long, or a line under it too long.
      { label: " " },
      { label: "A".repeat(101) },
      { hint: "A".repeat(301) },
      // No choices, too many, or one with a name that's empty, too long or
      // another's.
      { choices: [] },
      {
        choices: Array.from({ length: 41 }, (_, number) => ({
          label: `Culoarea ${number}`,
          price: 0,
        })),
      },
      { choices: [none, { ...white, label: " " }, ...rest] },
      { choices: [none, { ...white, label: "A".repeat(101) }, ...rest] },
      { choices: [none, white, { ...white, label: " ALB " }, ...rest] },
      // A price below nothing, in part of a ban, or more than the shop takes.
      { choices: [none, { ...white, price: -100 }, ...rest] },
      { choices: [none, { ...white, price: 150.5 }, ...rest] },
      { choices: [none, { ...white, price: 10_000_001 }, ...rest] },
      // A look of something else than a seal, or a colour that isn't one.
      {
        choices: [
          { ...none, look: { kind: "envelope" as const, color: "#ffffff" } },
          white,
          ...rest,
        ],
      },
      {
        choices: [
          none,
          { ...white, look: { kind: "seal" as const, color: "alb" } },
          ...rest,
        ],
      },
    ])
      await expect(
        workshop.mutation(api.workshop.lineOptions.save, {
          ...shown,
          ...refused,
        }),
      ).rejects.toThrow("invalid-input");
    await expect(
      workshop.mutation(api.workshop.lineOptions.save, {
        ...shown,
        handle: "nowhere",
      }),
    ).rejects.toThrow("not-found");
    // Preserved flowers change nothing in a design.
    const flowers = await asShown(workshop, "flori-criogenate");
    await expect(
      workshop.mutation(api.workshop.lineOptions.save, {
        ...flowers,
        choices: flowers.choices.map((choice) => ({
          ...choice,
          look: { kind: "seal" as const, color: null },
        })),
      }),
    ).rejects.toThrow("invalid-input");
    expect(await asShown(workshop, "culoare-sigiliu")).toEqual(shown);
  });

  test("open to the workshop alone", async () => {
    const { couple, workshop } = await setUp();
    await expect(
      couple.query(api.workshop.lineOptions.list, {}),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.query(api.workshop.lineOptions.option, { handle: "ciucure" }),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.mutation(
        api.workshop.lineOptions.save,
        await asShown(workshop, "ciucure"),
      ),
    ).rejects.toThrow("workshop-only");
  });
});
