import { describe, expect, test } from "bun:test";
import type { Catalog } from "../catalog";
import { readCatalog } from "../files";
import type { Document } from "./documents";
import { extras, feeHandles, keys, types } from "./inputs";
import { type Mode, type Store, type SyncOptions, sync } from "./sync";

/** A few products of the catalog, with the options and categories they use. */
async function sample(...handles: string[]): Promise<Catalog> {
  const catalog = await readCatalog();
  const products = catalog.products.filter((p) => handles.includes(p.handle));
  const used = (pick: (p: (typeof products)[number]) => string[]) =>
    new Set(products.flatMap(pick));
  const options = used((p) => p.lineOptions);
  const categories = used((p) => p.categories);
  return {
    products,
    lineOptions: catalog.lineOptions.filter((o) => options.has(o.handle)),
    categories: catalog.categories.filter((c) => categories.has(c.handle)),
  };
}

type Product = {
  id: string;
  handle: string;
  status: string;
  variants: { nodes: { id: string; title: string }[] };
  input: Record<string, unknown>;
};

/**
 * A store in memory, answering the sync's calls as Shopify does, and
 * refusing a reference to something it doesn't have.
 */
class FakeStore implements Store {
  calls: Document[] = [];
  scopes = [
    "write_products",
    "write_publications",
    "write_metaobjects",
    "write_metaobject_definitions",
    "read_orders",
  ];
  // The sales channels of Jolene's store.
  publications = [
    {
      id: "gid://shopify/Publication/1",
      title: "Online Store",
      app: "online_store",
    },
    {
      id: "gid://shopify/Publication/2",
      title: "Vercel Storefronts",
      app: "vercel-storefronts",
    },
    { id: "gid://shopify/Publication/4", title: "Shop", app: "shop-72" },
    { id: "gid://shopify/Publication/5", title: "Point of Sale", app: "pos" },
  ];
  definitions = new Map<string, { id: string; keys: [string, string][] }>();
  metafields = new Map<string, string>();
  metaobjects = new Map<string, { id: string; fields: unknown }>();
  collections = new Map<string, string>();
  products = new Map<string, Product>();
  published = new Map<string, string>();
  private next = 1;

  private id(type: string) {
    return `gid://shopify/${type}/${this.next++}`;
  }

  private exists(id: string) {
    const ids = new Set<string>([
      ...[...this.metaobjects.values()].map((m) => m.id),
      ...this.collections.values(),
      ...[...this.products.values()].flatMap((p) => [
        p.id,
        ...p.variants.nodes.map((v) => v.id),
      ]),
    ]);
    return ids.has(id);
  }

  private refuse(message: string) {
    return { userErrors: [{ field: null, message }] };
  }

  async request<T>(
    name: Document,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    this.calls.push(name);
    return this.answer(name, variables as never) as T;
  }

  // biome-ignore lint/suspicious/noExplicitAny: the calls' variables vary.
  private answer(name: Document, v: any): unknown {
    const page = <T>(nodes: T[]) => ({
      nodes,
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    switch (name) {
      case "access":
        return {
          shop: { name: "Jolene", myshopifyDomain: "jolene.myshopify.com" },
          currentAppInstallation: {
            accessScopes: this.scopes.map((handle) => ({ handle })),
          },
        };
      case "publications":
        return {
          publications: {
            nodes: this.publications.map((p) => ({
              id: p.id,
              catalog: { title: p.title, apps: { nodes: [{ handle: p.app }] } },
            })),
          },
        };
      case "definitions": {
        const definition = (type: string) => {
          const found = this.definitions.get(type);
          return found
            ? {
                id: found.id,
                fieldDefinitions: found.keys.map(([key, type]) => ({
                  key,
                  type: { name: type },
                })),
              }
            : null;
        };
        return {
          choice: definition(v.choice),
          lineOption: definition(v.lineOption),
          metafieldDefinitions: {
            nodes: [...this.metafields].map(([key, type]) => ({
              id: `gid://shopify/MetafieldDefinition/${key}`,
              key,
              type: { name: type },
            })),
          },
        };
      }
      case "metaobjects":
        return {
          metaobjects: page(
            [...this.metaobjects]
              .filter(([key]) => key.startsWith(`${v.type}/`))
              .map(([key, m]) => ({ id: m.id, handle: key.split("/")[1] })),
          ),
        };
      case "collections":
        return {
          collections: page(
            [...this.collections].map(([handle, id]) => ({ id, handle })),
          ),
        };
      case "products":
        return {
          products: page(
            [...this.products.values()].map(({ input: _, ...p }) => p),
          ),
        };
      case "createMetaobjectDefinition": {
        const { type, fieldDefinitions } = v.definition;
        if (this.definitions.has(type))
          return { metaobjectDefinitionCreate: this.refuse("Type taken") };
        const id = this.id("MetaobjectDefinition");
        this.definitions.set(type, {
          id,
          keys: fieldDefinitions.map((f: { key: string; type: string }) => [
            f.key,
            f.type,
          ]),
        });
        return {
          metaobjectDefinitionCreate: {
            metaobjectDefinition: { id },
            userErrors: [],
          },
        };
      }
      case "createMetafieldDefinition":
        this.metafields.set(v.definition.key, v.definition.type);
        return {
          metafieldDefinitionCreate: {
            createdDefinition: { id: this.id("MetafieldDefinition") },
            userErrors: [],
          },
        };
      case "upsertMetaobject": {
        const { type, handle } = v.handle;
        if (!this.definitions.has(type))
          return { metaobjectUpsert: this.refuse(`No ${type} definition`) };
        for (const field of v.metaobject.fields)
          if (field.key === "choices")
            for (const id of JSON.parse(field.value))
              if (!this.exists(id))
                return { metaobjectUpsert: this.refuse(`No ${id}`) };
        const key = `${type}/${handle}`;
        const id = this.metaobjects.get(key)?.id ?? this.id("Metaobject");
        this.metaobjects.set(key, { id, fields: v.metaobject.fields });
        return { metaobjectUpsert: { metaobject: { id }, userErrors: [] } };
      }
      case "createCollection": {
        const id = this.id("Collection");
        this.collections.set(v.collection.handle, id);
        return {
          collectionCreate: {
            collection: { id, handle: v.collection.handle },
            userErrors: [],
          },
        };
      }
      case "setProduct": {
        const input = v.input;
        for (const id of input.collections ?? [])
          if (!this.exists(id))
            return { productSet: this.refuse(`No collection ${id}`) };
        for (const metafield of input.metafields ?? [])
          if (metafield.type.startsWith("list."))
            for (const id of JSON.parse(metafield.value))
              if (!this.exists(id))
                return { productSet: this.refuse(`No ${id}`) };
        const handle = v.identifier.handle;
        const existing = this.products.get(handle);
        const product: Product = {
          id: existing?.id ?? this.id("Product"),
          handle,
          status: input.status ?? existing?.status ?? "ACTIVE",
          variants: {
            nodes: input.variants.map(
              (variant: { optionValues: { name: string }[] }) => ({
                id: this.id("ProductVariant"),
                title: variant.optionValues.map((o) => o.name).join(" / "),
              }),
            ),
          },
          input,
        };
        this.products.set(handle, product);
        const { input: _, ...answer } = product;
        return { productSet: { product: answer, userErrors: [] } };
      }
      case "setStatus":
        for (const product of this.products.values())
          if (product.id === v.id) product.status = v.status;
        return {
          productUpdate: { product: { status: v.status }, userErrors: [] },
        };
      case "publish":
        this.published.set(v.id, v.publicationId);
        return { publishablePublish: { userErrors: [] } };
      case "media":
        return {
          nodes: v.ids.map((id: string) => {
            const product = [...this.products.values()].find(
              (p) => p.id === id,
            );
            const files = (product?.input.files ?? []) as {
              originalSource: string;
            }[];
            return {
              handle: product?.handle,
              media: {
                nodes: files.map((file) => ({
                  status: file.originalSource.endsWith("broken.jpg")
                    ? "FAILED"
                    : "READY",
                  mediaErrors: [],
                  originalSource: { url: file.originalSource },
                })),
              },
            };
          }),
        };
      default:
        throw new Error(`The fake store doesn't answer ${name}`);
    }
  }
}

const valid = { check: () => [] };

function run(
  catalog: Catalog,
  mode: Mode,
  store?: FakeStore,
  more: Partial<SyncOptions> = {},
) {
  return sync({ catalog, checker: valid, mode, store, photoWait: 0, ...more });
}

const handles = [
  "18216", // paper, line options, a fee and a minimum
  "abum-craciun-magie-in-doi", // nothing to choose
  "marturie-botez-pink-teddy", // the urgency fee
];

describe("sync", () => {
  test("without a store, only checks the calls", async () => {
    const outcome = await run(await sample(...handles), "plan", undefined, {
      checker: { check: (name) => (name === "publish" ? ["no"] : []) },
    });
    expect(outcome.problems).toEqual(["publish: no"]);
    expect(outcome.report).toContain("# Products: plan");
  });

  test("a plan reads the store and changes nothing", async () => {
    const store = new FakeStore();
    const outcome = await run(await sample(...handles), "plan", store);
    expect(outcome.problems).toEqual([]);
    expect(
      store.calls.filter((c) => /^(create|upsert|set|publish)/.test(c)),
    ).toEqual([]);
    expect(outcome.report).toContain("Publishing to Vercel Storefronts");
    expect(outcome.report).toContain("| Products | 3 | 0 |");
  });

  test("a draft run creates the catalog as drafts the shop can read", async () => {
    const catalog = await sample(...handles);
    const store = new FakeStore();
    const outcome = await run(catalog, "draft", store);
    expect(outcome.problems).toEqual([]);

    expect([...store.definitions.keys()].sort()).toEqual(
      Object.values(types).sort(),
    );
    expect([...store.metafields.keys()].sort()).toEqual(
      Object.values(keys).sort(),
    );
    expect(store.collections.size).toBe(catalog.categories.length);
    const product = store.products.get("18216");
    expect(product?.status).toBe("DRAFT");
    expect(product?.variants.nodes.map((v) => v.title)).toEqual([
      "Alb mat 300 gr",
      "Ivory texturat 300 gr",
      "Alb sidef 300 gr",
      "Auriu sidef 300 gr",
      "Crem mat 300 gr",
    ]);
    const metafields = product?.input.metafields as {
      key: string;
      value: string;
    }[];
    const fee = metafields.find((m) => m.key === keys.fees);
    expect(JSON.parse(fee?.value ?? "[]")).toEqual([
      store.products
        .get("diacritice")
        ?.variants.nodes.find((v) => v.title === "50 lei")?.id,
    ]);
    expect(metafields.find((m) => m.key === keys.minQuantity)?.value).toBe(
      "30",
    );
    for (const handle of [...feeHandles, extras.handle])
      expect(store.products.get(handle)?.status).toBe("DRAFT");

    // Products wait in the sales channel; the categories wait for the sale.
    expect(store.published.get(product?.id ?? "")).toBe(
      "gid://shopify/Publication/2",
    );
    for (const id of store.collections.values())
      expect(store.published.has(id)).toBe(false);
    expect(outcome.report).toContain("| Products | 3 | 0 | 3 | 0 |");
  });

  test("runs again without changing what the store has, unless told to", async () => {
    const catalog = await sample(...handles);
    const store = new FakeStore();
    await run(catalog, "draft", store);
    const writes = () =>
      store.calls.filter((c) => /^(create|upsert|setProduct)/.test(c)).length;
    const before = writes();
    expect((await run(catalog, "draft", store)).problems).toEqual([]);
    expect(writes()).toBe(before);

    const id = store.products.get("18216")?.id;
    const outcome = await run(catalog, "draft", store, { overwrite: true });
    expect(outcome.problems).toEqual([]);
    const product = store.products.get("18216");
    expect(product?.id).toBe(id ?? "");
    // An update keeps the photos and the status Jolene may have changed.
    expect(product?.input.files).toBeUndefined();
    expect(product?.input.status).toBeUndefined();
  });

  test("publishing puts drafts on sale and leaves what Jolene archived", async () => {
    const catalog = await sample(...handles);
    const store = new FakeStore();
    await run(catalog, "draft", store);
    const archived = store.products.get("abum-craciun-magie-in-doi");
    if (archived) archived.status = "ARCHIVED";
    const outcome = await run(catalog, "publish", store);
    expect(outcome.problems).toEqual([]);
    expect(store.products.get("18216")?.status).toBe("ACTIVE");
    expect(archived?.status).toBe("ARCHIVED");
    for (const handle of [...feeHandles, extras.handle])
      expect(store.products.get(handle)?.status).toBe("UNLISTED");
    for (const id of store.collections.values())
      expect(store.published.get(id)).toBe("gid://shopify/Publication/2");
  });

  test("stops before writing when the app lacks a scope", async () => {
    const store = new FakeStore();
    store.scopes = ["write_products"];
    const outcome = await run(await sample(...handles), "draft", store);
    expect(outcome.problems[0]).toContain("write_metaobjects");
    expect(store.calls).toEqual(["access"]);
  });

  test("needs the sales channel named when it can't tell which is the shop's", async () => {
    const catalog = await sample(...handles);
    const store = new FakeStore();
    store.publications.push({
      id: "gid://shopify/Publication/3",
      title: "Other",
      app: "headless",
    });
    const outcome = await run(catalog, "draft", store);
    expect(outcome.problems[0]).toContain("naming the shop's sales channel");
    expect(store.products.size).toBe(0);

    const named = await run(catalog, "draft", store, { publication: "Other" });
    expect(named.problems).toEqual([]);
    expect(store.published.get(store.products.get("18216")?.id ?? "")).toBe(
      "gid://shopify/Publication/3",
    );
  });

  test("reports the photos Shopify couldn't fetch", async () => {
    const catalog = await sample("abum-craciun-magie-in-doi");
    const [product] = catalog.products;
    if (product)
      product.images = [{ url: "https://jolene.ro/broken.jpg", alt: "" }];
    const outcome = await run(catalog, "draft", new FakeStore());
    expect(outcome.problems).toEqual([
      "A photo failed: abum-craciun-magie-in-doi: https://jolene.ro/broken.jpg ()",
    ]);
    expect(outcome.report).toContain("1 failed");
  });
});
