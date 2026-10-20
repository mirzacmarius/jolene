import type { Catalog, FeeKey } from "../catalog";
import { fees } from "../catalog";
import { namespace, types } from "../order";
import { apiVersion, type Document } from "./documents";
import {
  choiceDefinition,
  choiceUpserts,
  collectionInput,
  extras,
  extrasInput,
  feeHandles,
  feeProductInput,
  type Ids,
  lineOptionDefinition,
  lineOptionUpsert,
  mostExtras,
  productInput,
  productMetafieldDefinitions,
  type Status,
} from "./inputs";
import type { Checker } from "./schema";

/**
 * plan: checks every call against the schema and, given the store, reads
 * what it already has. draft: creates what it lacks, products as drafts.
 * publish: then puts the drafts on sale.
 */
export type Mode = "plan" | "draft" | "publish";

/** The Admin API, as admin.ts calls it. */
export type Store = {
  request<T>(
    name: Document,
    variables?: Record<string, unknown>,
    options?: { idempotent?: boolean },
  ): Promise<T>;
};

export type SyncOptions = {
  catalog: Catalog;
  checker: Pick<Checker, "check">;
  mode: Mode;
  /** Without a store, the run only checks the calls it would make. */
  store?: Store;
  /** The shop's sales channel: its publication's ID or catalog title. */
  publication?: string;
  /** Updates from the catalog what the store already has. */
  overwrite?: boolean;
  /** How long Shopify gets to fetch new products' photos before the check. */
  photoWait?: number;
  log?: (line: string) => void;
};

export type Outcome = {
  /** Markdown, for the run's summary. */
  report: string;
  problems: string[];
};

/** The scopes the sync needs, as the Dev Dashboard app's version lists them. */
export const scopes = [
  "write_products",
  "write_publications",
  "write_metaobjects",
  "write_metaobject_definitions",
];

/**
 * The sales channels a shop of its own reads the store through: Vercel
 * Storefronts on a store Vercel's Shopify integration made, as Jolene's,
 * and Headless on any other.
 */
const storefronts = ["vercel-storefronts", "headless"];

/** A run stops after this many problems: something larger is wrong. */
const enough = 25;

type UserErrors = {
  userErrors: { field?: string[] | null; message: string }[];
};
type Page<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type StoreProduct = {
  id: string;
  handle: string;
  status: string;
  variants: { nodes: { id: string; title: string }[] };
};
type Definition = {
  id: string;
  fieldDefinitions: { key: string; type: { name: string } }[];
};
type Tally = {
  catalog: number;
  store: number;
  created: number;
  updated: number;
};

/** IDs in the shape of the store's, for checking calls before a run. */
const placeholders: Ids = {
  definition: () => "gid://shopify/MetaobjectDefinition/0",
  metaobject: () => "gid://shopify/Metaobject/0",
  collection: () => "gid://shopify/Collection/0",
  feeVariant: () => "gid://shopify/ProductVariant/0",
};

export function sync(options: SyncOptions): Promise<Outcome> {
  return new Sync(options).run();
}

class Sync {
  private problems: string[] = [];
  private lines: string[] = [];
  private definitions = new Map<string, string>();
  private metafieldDefinitions = new Map<string, string>();
  private metaobjects = new Map<string, string>();
  private collections = new Map<string, string>();
  private products = new Map<string, StoreProduct>();
  private tallies = new Map<string, Tally>();
  /** Products this run created, whose photos Shopify is fetching. */
  private fetching: string[] = [];

  private ids: Ids = {
    definition: (type) => this.known(this.definitions, type, "definition"),
    metaobject: (type, handle) =>
      this.known(this.metaobjects, `${type}/${handle}`, "metaobject"),
    collection: (handle) => this.known(this.collections, handle, "collection"),
    feeVariant: (fee) => this.feeVariant(fee),
  };

  constructor(private options: SyncOptions) {}

  private get stopped() {
    return this.problems.length > 0;
  }

  async run(): Promise<Outcome> {
    const { mode, store } = this.options;
    this.lines.push(`# Products: ${mode}`, "");
    this.check();
    if (this.stopped) return this.outcome();
    if (!store) {
      this.say("Without the store's credentials, this run didn't read it.");
      return this.outcome();
    }
    try {
      if (!(await this.access(store))) return this.outcome();
      const publication = await this.publication(store);
      await this.read(store);
      if (mode === "plan" || this.stopped) return this.outcome();
      await this.define(store);
      if (this.stopped) return this.outcome();
      await this.setMetaobjects(store);
      await this.setCollections(store);
      await this.setProducts(store);
      if (publication) await this.publish(store, publication);
      if (mode === "publish") await this.activate(store);
      await this.checkPhotos(store);
    } catch (error) {
      this.problem(error instanceof Error ? error.message : String(error));
    }
    return this.outcome();
  }

  /** Checks every call the run can make against the Admin API's schema. */
  private check() {
    const { catalog, checker } = this.options;
    const product = "gid://shopify/Product/0";
    const calls: (readonly [Document, Record<string, unknown>, string])[] = [
      [
        "createMetaobjectDefinition",
        { definition: choiceDefinition() },
        types.choice,
      ],
      [
        "createMetaobjectDefinition",
        { definition: lineOptionDefinition(placeholders) },
        types.lineOption,
      ],
      ...productMetafieldDefinitions(placeholders).map(
        (definition) =>
          [
            "createMetafieldDefinition",
            { definition },
            `${namespace}.${definition.key}`,
          ] as const,
      ),
      ...[
        ...choiceUpserts(catalog),
        ...catalog.lineOptions.map((o) => lineOptionUpsert(o, placeholders)),
      ].map(
        (upsert) => ["upsertMetaobject", upsert, upsert.handle.handle] as const,
      ),
      ...catalog.categories.map(
        (category) =>
          [
            "createCollection",
            { collection: collectionInput(category) },
            category.handle,
          ] as const,
      ),
      ...[
        ...feeHandles.map((handle) =>
          feeProductInput(handle, { status: "DRAFT" }),
        ),
        extrasInput({ status: "DRAFT" }),
        ...catalog.products.flatMap((p) => [
          productInput(p, placeholders, { status: "DRAFT" }),
          productInput(p, placeholders),
        ]),
      ].map(
        (input) =>
          [
            "setProduct",
            { identifier: { handle: input.handle }, input },
            input.handle,
          ] as const,
      ),
      // The workshop's order list reads orders with these.
      ["orders", { after: null }, "orders"],
      ["orderLines", { id: "gid://shopify/Order/0", after: null }, "orders"],
      ["orderNodes", { ids: [product] }, "orders"],
      ["setStatus", { id: product, status: "ACTIVE" }, "activate"],
      ["setStatus", { id: product, status: "UNLISTED" }, "unlist"],
      [
        "publish",
        { id: product, publicationId: "gid://shopify/Publication/0" },
        "publish",
      ],
    ];
    for (const [name, variables, what] of calls)
      for (const problem of checker.check(name, variables))
        this.problem(`${what}: ${problem}`);

    // The extras product charges a line's paid options in steps.
    for (const product of catalog.products)
      if (mostExtras(product, catalog) > extras.most)
        this.problem(
          `${product.handle}: its options can add more than the extras product charges`,
        );
    for (const option of catalog.lineOptions)
      for (const choice of option.choices) {
        const steps = choice.price / extras.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-9)
          this.problem(
            `${option.handle}: "${choice.label}" costs ${choice.price} lei, not a multiple of ${extras.step}`,
          );
      }
    this.say(
      `Checked ${calls.length} calls against the Admin API's ${apiVersion} schema${
        this.stopped ? "." : ": all valid."
      }`,
    );
  }

  /** Whether the app has the scopes the sync needs. */
  private async access(store: Store): Promise<boolean> {
    const { shop, currentAppInstallation } = await store.request<{
      shop: { name: string; myshopifyDomain: string };
      currentAppInstallation: { accessScopes: { handle: string }[] };
    }>("access");
    const granted = new Set(
      currentAppInstallation.accessScopes.map((scope) => scope.handle),
    );
    this.say(`Store: ${shop.name} (${shop.myshopifyDomain}).`);
    const missing = scopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0)
      this.problem(
        `The app lacks the scopes ${missing.join(", ")}: add them to a new version of the app in the Dev Dashboard, release it and approve it on the store.`,
      );
    if (!granted.has("read_orders"))
      this.say(
        "The app can't read orders yet (read_orders), which the workshop's order list needs.",
      );
    else await this.orders(store);
    return missing.length === 0;
  }

  /**
   * Reads the open orders as the workshop's order list does, which Shopify
   * may refuse though the app has read_orders: it also asks apps reading
   * orders for its approval of how they handle customer data.
   */
  private async orders(store: Store) {
    try {
      const { orders } = await store.request<{
        orders: { nodes: unknown[]; pageInfo: { hasNextPage: boolean } };
      }>("orders", { after: null });
      const open = orders.pageInfo.hasNextPage
        ? `${orders.nodes.length} or more`
        : orders.nodes.length || "none";
      this.say(
        `The workshop's order list reads the store's orders: ${open} open.`,
      );
    } catch (error) {
      this.say(
        `The workshop's order list can't read the store's orders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * The publication of the sales channel the shop reads: the one asked
   * for, or else the store's only storefront channel.
   */
  private async publication(store: Store): Promise<string | undefined> {
    const { publications } = await store.request<{
      publications: {
        nodes: {
          id: string;
          catalog: {
            title: string;
            apps?: { nodes: { handle: string }[] };
          } | null;
        }[];
      };
    }>("publications");
    const list = publications.nodes.map((node) => ({
      id: node.id,
      title: node.catalog?.title ?? "",
      apps: node.catalog?.apps?.nodes.map((app) => app.handle) ?? [],
    }));
    this.say(
      `Sales channels: ${list
        .map(
          (p) => `${p.title || "untitled"} (${[p.id, ...p.apps].join(", ")})`,
        )
        .join("; ")}.`,
    );
    const asked = this.options.publication;
    const matching = asked
      ? list.filter(
          (p) =>
            p.id === asked || p.title.toLowerCase() === asked.toLowerCase(),
        )
      : list.filter((p) => p.apps.some((app) => storefronts.includes(app)));
    const [only] = matching;
    if (only && matching.length === 1) {
      this.say(`Publishing to ${only.title} (${only.id}).`);
      return only.id;
    }
    const why = asked
      ? `No one sales channel is "${asked}".`
      : "The store has no one Vercel Storefronts or Headless channel to publish to.";
    if (this.options.mode === "plan")
      this.say(`${why} A draft run needs the shop's one named.`);
    else this.problem(`${why} Run again naming the shop's sales channel.`);
    return undefined;
  }

  /** What the store already has of the catalog. */
  private async read(store: Store) {
    const { catalog } = this.options;
    const found = await store.request<{
      choice: Definition | null;
      lineOption: Definition | null;
      metafieldDefinitions: {
        nodes: { id: string; key: string; type: { name: string } }[];
      };
    }>("definitions", {
      choice: types.choice,
      lineOption: types.lineOption,
      namespace,
    });
    const definitions = [
      [types.choice, found.choice, choiceDefinition()],
      [types.lineOption, found.lineOption, lineOptionDefinition(placeholders)],
    ] as const;
    for (const [type, definition, input] of definitions) {
      if (!definition) continue;
      this.definitions.set(type, definition.id);
      const has = new Map(
        definition.fieldDefinitions.map((f) => [f.key, f.type.name]),
      );
      for (const field of input.fieldDefinitions)
        if (has.get(field.key) !== field.type)
          this.problem(
            `The store's ${type} definition has no ${field.type} field "${field.key}".`,
          );
    }
    const metafields = new Map(
      found.metafieldDefinitions.nodes.map((node) => [node.key, node]),
    );
    for (const definition of productMetafieldDefinitions(placeholders)) {
      const existing = metafields.get(definition.key);
      if (!existing) continue;
      if (existing.type.name !== definition.type)
        this.problem(
          `The store's ${namespace}.${definition.key} metafield is a ${existing.type.name}, not a ${definition.type}.`,
        );
      this.metafieldDefinitions.set(definition.key, existing.id);
    }

    for (const type of Object.values(types))
      for (const node of await this.all<{ id: string; handle: string }>(
        store,
        "metaobjects",
        { type },
      ))
        this.metaobjects.set(`${type}/${node.handle}`, node.id);
    for (const node of await this.all<{ id: string; handle: string }>(
      store,
      "collections",
    ))
      this.collections.set(node.handle, node.id);
    for (const node of await this.all<StoreProduct>(store, "products"))
      this.products.set(node.handle, node);

    const handles = (list: { handle: string }[]) => list.map((x) => x.handle);
    const services = [...feeHandles, extras.handle];
    this.tally(
      "Choices",
      choiceUpserts(catalog).map((u) => `${types.choice}/${u.handle.handle}`),
      this.metaobjects,
    );
    this.tally(
      "Line options",
      catalog.lineOptions.map((o) => `${types.lineOption}/${o.handle}`),
      this.metaobjects,
    );
    this.tally("Categories", handles(catalog.categories), this.collections);
    this.tally("Fees and extras", services, this.products);
    this.tally("Products", handles(catalog.products), this.products);
    const ours = new Set([...handles(catalog.products), ...services]);
    const others = [...this.products.keys()].filter((h) => !ours.has(h));
    if (others.length > 0)
      this.say(
        `The store also has ${others.length} products the catalog doesn't: ${others
          .slice(0, 10)
          .join(", ")}${others.length > 10 ? "…" : ""}.`,
      );
  }

  /** Creates the metaobject and metafield definitions the store lacks. */
  private async define(store: Store) {
    const create = async (type: string, definition: () => object) => {
      if (this.definitions.has(type)) return;
      const { metaobjectDefinitionCreate: result } = await store.request<{
        metaobjectDefinitionCreate: UserErrors & {
          metaobjectDefinition: { id: string } | null;
        };
      }>(
        "createMetaobjectDefinition",
        { definition: definition() },
        { idempotent: false },
      );
      if (this.failed(type, result) || !result.metaobjectDefinition) return;
      this.definitions.set(type, result.metaobjectDefinition.id);
      this.say(`Created the ${type} definition.`);
    };
    await create(types.choice, choiceDefinition);
    if (this.stopped) return;
    await create(types.lineOption, () => lineOptionDefinition(this.ids));
    if (this.stopped) return;
    for (const definition of productMetafieldDefinitions(this.ids)) {
      if (this.metafieldDefinitions.has(definition.key)) continue;
      const { metafieldDefinitionCreate: result } = await store.request<{
        metafieldDefinitionCreate: UserErrors & {
          createdDefinition: { id: string } | null;
        };
      }>("createMetafieldDefinition", { definition }, { idempotent: false });
      const name = `${namespace}.${definition.key}`;
      if (this.failed(name, result) || !result.createdDefinition) continue;
      this.metafieldDefinitions.set(
        definition.key,
        result.createdDefinition.id,
      );
      this.say(`Created the ${name} metafield definition.`);
    }
  }

  /** The choices, then the line options that list them. */
  private async setMetaobjects(store: Store) {
    const { catalog, overwrite } = this.options;
    const fresh = (type: string, handle: string) =>
      overwrite || !this.metaobjects.has(`${type}/${handle}`);
    await this.upsert(
      store,
      "Choices",
      choiceUpserts(catalog).filter((u) =>
        fresh(types.choice, u.handle.handle),
      ),
    );
    await this.upsert(
      store,
      "Line options",
      catalog.lineOptions
        .filter((option) => fresh(types.lineOption, option.handle))
        .flatMap(
          (option) =>
            this.attempt(option.handle, () =>
              lineOptionUpsert(option, this.ids),
            ) ?? [],
        ),
    );
  }

  private async upsert(
    store: Store,
    what: string,
    upserts: { handle: { type: string; handle: string }; metaobject: object }[],
  ) {
    await this.each(upserts, async (variables) => {
      const key = `${variables.handle.type}/${variables.handle.handle}`;
      const existed = this.metaobjects.has(key);
      const { metaobjectUpsert: result } = await store.request<{
        metaobjectUpsert: UserErrors & { metaobject: { id: string } | null };
      }>("upsertMetaobject", variables);
      if (this.failed(variables.handle.handle, result) || !result.metaobject)
        return;
      this.metaobjects.set(key, result.metaobject.id);
      this.count(what, existed);
    });
  }

  private async setCollections(store: Store) {
    const missing = this.options.catalog.categories.filter(
      (category) => !this.collections.has(category.handle),
    );
    await this.each(missing, async (category) => {
      const { collectionCreate: result } = await store.request<{
        collectionCreate: UserErrors & { collection: { id: string } | null };
      }>(
        "createCollection",
        { collection: collectionInput(category) },
        { idempotent: false },
      );
      if (this.failed(category.handle, result) || !result.collection) return;
      this.collections.set(category.handle, result.collection.id);
      this.count("Categories", false);
    });
  }

  /** The fee and extras products first: products point to the fees. */
  private async setProducts(store: Store) {
    const { catalog } = this.options;
    for (const handle of feeHandles)
      await this.setProduct(store, "Fees and extras", handle, (creating) =>
        feeProductInput(handle, creating),
      );
    await this.setProduct(store, "Fees and extras", extras.handle, extrasInput);
    await this.each(catalog.products, (product) =>
      this.setProduct(store, "Products", product.handle, (creating) =>
        productInput(product, this.ids, creating),
      ),
    );
  }

  private async setProduct(
    store: Store,
    what: string,
    handle: string,
    input: (creating?: { status: Status }) => object,
  ) {
    const existing = this.products.get(handle);
    if (existing && !this.options.overwrite) return;
    const built = this.attempt(handle, () =>
      input(existing ? undefined : { status: "DRAFT" }),
    );
    if (!built) return;
    const { productSet: result } = await store.request<{
      productSet: UserErrors & { product: StoreProduct | null };
    }>("setProduct", { identifier: { handle }, input: built });
    if (this.failed(handle, result) || !result.product) return;
    this.products.set(handle, result.product);
    if (!existing) this.fetching.push(result.product.id);
    this.count(what, Boolean(existing));
  }

  /**
   * Adds the products to the shop's sales channel, and the categories once
   * the products go on sale. A draft stays hidden until it's active.
   */
  private async publish(store: Store, publicationId: string) {
    const { catalog, mode } = this.options;
    const ids = [
      ...catalog.products.map((product) => product.handle),
      ...feeHandles,
      extras.handle,
    ].flatMap((handle) => this.products.get(handle)?.id ?? []);
    if (mode === "publish")
      for (const category of catalog.categories) {
        const id = this.collections.get(category.handle);
        if (id) ids.push(id);
      }
    let published = 0;
    await this.each(ids, async (id) => {
      const { publishablePublish: result } = await store.request<{
        publishablePublish: UserErrors;
      }>("publish", { id, publicationId });
      if (!this.failed(id, result)) published++;
    });
    this.say(
      `Added ${published} products and categories to the sales channel.`,
    );
  }

  /** Puts the catalog's drafts on sale, and the fees and extras unlisted. */
  private async activate(store: Store) {
    const statuses: [string, Status][] = [
      ...this.options.catalog.products.map(
        (p) => [p.handle, "ACTIVE"] as [string, Status],
      ),
      ...[...feeHandles, extras.handle].map(
        (handle) => [handle, "UNLISTED"] as [string, Status],
      ),
    ];
    let changed = 0;
    await this.each(statuses, async ([handle, status]) => {
      const product = this.products.get(handle);
      // What Jolene archived or put on sale herself stays as it is.
      if (product?.status !== "DRAFT") return;
      const { productUpdate: result } = await store.request<{
        productUpdate: UserErrors & { product: { status: string } | null };
      }>("setStatus", { id: product.id, status });
      if (this.failed(handle, result)) return;
      product.status = result.product?.status ?? status;
      changed++;
    });
    this.say(`Put ${changed} drafts on sale.`);
  }

  /** Reports the photos Shopify couldn't fetch from jolene.ro. */
  private async checkPhotos(store: Store) {
    if (this.fetching.length === 0) return;
    await sleep(this.options.photoWait ?? 60_000);
    const statuses = new Map<string, number>();
    const failed: string[] = [];
    for (let i = 0; i < this.fetching.length; i += 25) {
      const { nodes } = await store.request<{
        nodes: ({
          handle: string;
          media: {
            nodes: {
              status: string;
              mediaErrors: { message: string }[];
              originalSource?: { url: string | null } | null;
            }[];
          };
        } | null)[];
      }>("media", { ids: this.fetching.slice(i, i + 25) });
      for (const product of nodes)
        for (const media of product?.media.nodes ?? []) {
          statuses.set(media.status, (statuses.get(media.status) ?? 0) + 1);
          if (media.status === "FAILED")
            failed.push(
              `${product?.handle}: ${media.originalSource?.url ?? "a photo"} (${media.mediaErrors
                .map((error) => error.message)
                .join("; ")})`,
            );
        }
    }
    const counted = [...statuses]
      .map(([status, n]) => `${n} ${status.toLowerCase()}`)
      .join(", ");
    this.say(`Photos of the new products: ${counted || "none"}.`);
    for (const line of failed) this.problem(`A photo failed: ${line}`);
  }

  private async all<T>(
    store: Store,
    name: "metaobjects" | "collections" | "products",
    variables: Record<string, unknown> = {},
  ): Promise<T[]> {
    const nodes: T[] = [];
    for (let after: string | null = null; ; ) {
      const data: Record<string, Page<T>> = await store.request(name, {
        ...variables,
        after,
      });
      const page = data[name];
      if (!page) return nodes;
      nodes.push(...page.nodes);
      if (!page.pageInfo.hasNextPage) return nodes;
      after = page.pageInfo.endCursor;
    }
  }

  /** Runs `work` on the items a few at a time, until a run goes wrong. */
  private async each<T>(items: T[], work: (item: T) => Promise<void>) {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, items.length) }, async () => {
        while (next < items.length && this.problems.length < enough) {
          const item = items[next++] as T;
          try {
            await work(item);
          } catch (error) {
            this.problem(
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      }),
    );
  }

  private feeVariant(fee: FeeKey): string {
    const { product, variant } = fees[fee];
    const id = this.products
      .get(product)
      ?.variants.nodes.find((node) => node.title === variant)?.id;
    if (!id) throw new Missing(`the ${variant} variant of ${product}`);
    return id;
  }

  private known(map: Map<string, string>, key: string, what: string): string {
    const id = map.get(key);
    if (!id) throw new Missing(`the ${what} ${key}`);
    return id;
  }

  /** Builds a call's input, or notes what the store lacks for it. */
  private attempt<T>(what: string, build: () => T): T | undefined {
    try {
      return build();
    } catch (error) {
      if (!(error instanceof Missing)) throw error;
      this.problem(`${what}: skipped, as the store lacks ${error.message}.`);
      return undefined;
    }
  }

  private failed(what: string, result: UserErrors): boolean {
    for (const error of result.userErrors)
      this.problem(
        `${what}: ${error.message}${error.field ? ` (${error.field.join(".")})` : ""}`,
      );
    return result.userErrors.length > 0;
  }

  private tally(what: string, keys: string[], store: Map<string, unknown>) {
    this.tallies.set(what, {
      catalog: keys.length,
      store: keys.filter((key) => store.has(key)).length,
      created: 0,
      updated: 0,
    });
  }

  private count(what: string, updated: boolean) {
    const tally = this.tallies.get(what);
    if (tally) tally[updated ? "updated" : "created"]++;
  }

  private say(line: string) {
    this.lines.push(line);
    this.options.log?.(line);
  }

  private problem(problem: string) {
    if (this.problems.length >= enough) return;
    this.problems.push(problem);
    this.options.log?.(`Problem: ${problem}`);
  }

  private outcome(): Outcome {
    const lines = [...this.lines];
    if (this.tallies.size > 0) {
      const ran = this.options.mode !== "plan";
      lines.push(
        "",
        `| | In the catalog | Already in the store |${ran ? " Created | Updated |" : ""}`,
        `|---|---|---|${ran ? "---|---|" : ""}`,
        ...[...this.tallies].map(
          ([what, t]) =>
            `| ${what} | ${t.catalog} | ${t.store} |${ran ? ` ${t.created} | ${t.updated} |` : ""}`,
        ),
      );
    }
    if (this.problems.length > 0)
      lines.push(
        "",
        `## Problems${this.problems.length >= enough ? ` (the run stopped at ${enough})` : ""}`,
        "",
        ...this.problems.map((problem) => `- ${problem}`),
      );
    return { report: `${lines.join("\n")}\n`, problems: this.problems };
  }
}

/** Something a call points to that the store doesn't have. */
class Missing extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
