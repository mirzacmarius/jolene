import type {
  Catalog,
  Category,
  Image,
  LineOption,
  Product,
  ProductOption,
} from "../catalog";
import { cleanDescription } from "./descriptions";
import { readField, spellChoice } from "./fields";
import { imageUrl } from "./images";
import { feesIn, minQuantity } from "./terms";
import { decodeEntities, textOf } from "./text";
import { cleanTitle } from "./titles";
import type { ImageLabel, WooCategory, WooField, WooProduct } from "./woo";

export type Source = {
  products: WooProduct[];
  categories: WooCategory[];
  labels: ImageLabel[];
};

/** WordPress's default category and jolene.ro's "no category". */
const uncategorized = new Set(["fara-categorie", "uncategorized"]);

/** Category names jolene.ro writes in capitals or without diacritics. */
const categoryTitles: Record<string, string> = {
  agende: "Agende",
  "invitatii-cu-sigiliu": "Invitații cu sigiliu",
  "invitatii-foaie-calc": "Invitații cu foaie de calc",
  "invitatii-premium": "Invitații premium",
  "invitatii-tematice": "Invitații tematice",
  marturii: "Mărturii",
  "marturii-botez": "Mărturii botez",
};

/** A line option before it has a handle. */
type Ask = Omit<LineOption, "handle">;

/**
 * jolene.ro's catalog as the shop sells it. Products keep the names of
 * their addresses as handles, so /produs/<name>/ redirects to
 * /products/<name>.
 */
export function liftCatalog(source: Source): Catalog {
  const labels = new Map(source.labels.map((label) => [label.path, label]));
  const wooCategories = new Map(source.categories.map((c) => [c.id, c]));

  const products = source.products.map((woo) => {
    const title = cleanTitle(woo.name);
    const descriptionHtml = cleanDescription(
      woo.short_description_html,
      woo.description_html,
    );
    const text = textOf(descriptionHtml);
    const { options, asks } = readFields(woo.options);
    const images = new Map<string, Image>();
    for (const image of woo.images)
      images.set(image.url, {
        url: imageUrl(
          image,
          labels.get(`images/${woo.slug}/${image.filename}`),
        ),
        alt: image.alt.trim() || title,
      });
    const onSale =
      woo.price.sale !== null && woo.price.regular > woo.price.price;
    const min = minQuantity(text);
    const product = {
      handle: handleOf(woo.slug),
      title,
      price: woo.price.price,
      ...(onSale ? { compareAtPrice: woo.price.regular } : {}),
      ...(min ? { minQuantity: min } : {}),
      options,
      lineOptions: [] as string[],
      fees: feesIn(text),
      categories: categoriesOf(woo, wooCategories),
      tags: [...new Set(woo.tags)],
      images: [...images.values()],
      woo: { id: woo.id, path: new URL(woo.permalink).pathname },
      descriptionHtml,
    } satisfies Product;
    return { product, asks };
  });

  // Products share a line option when they ask the same, the same way. The
  // one most products ask is named after what it asks, the others numbered.
  const shared = new Map<string, { ask: Ask; products: number }>();
  for (const { asks } of products)
    for (const ask of asks) {
      const id = identity(ask);
      const entry = shared.get(id) ?? { ask, products: 0 };
      entry.products++;
      shared.set(id, entry);
    }
  const ranked = [...shared].sort(
    ([a, x], [b, y]) =>
      x.ask.key.localeCompare(y.ask.key) ||
      y.products - x.products ||
      a.localeCompare(b),
  );
  const handles = new Map<string, string>();
  const numbers = new Map<string, number>();
  for (const [id, { ask }] of ranked) {
    const number = (numbers.get(ask.key) ?? 0) + 1;
    numbers.set(ask.key, number);
    handles.set(id, number === 1 ? ask.key : `${ask.key}-${number}`);
  }
  for (const { product, asks } of products)
    product.lineOptions = asks.map((ask) => handles.get(identity(ask)) ?? "");

  const used = new Set(products.flatMap(({ product }) => product.categories));
  const categories: Category[] = source.categories
    .filter((category) => used.has(category.slug))
    .map((category) => ({
      handle: category.slug,
      title: categoryTitles[category.slug] ?? decodeEntities(category.name),
    }));

  return {
    products: products
      .map(({ product }) => product)
      .sort((a, b) => a.handle.localeCompare(b.handle)),
    lineOptions: ranked
      .map(([id, { ask }]) => ({ handle: handles.get(id) ?? "", ...ask }))
      .sort((a, b) => a.handle.localeCompare(b.handle)),
    categories: categories.sort((a, b) => a.handle.localeCompare(b.handle)),
  };
}

/**
 * A product's options: the ones it's made of become Shopify's, the others
 * go with its cart line. Of two fields asking the same, the one with a
 * label stays; jolene.ro's plugin repeats some without one.
 */
function readFields(fields: WooField[]): {
  options: ProductOption[];
  asks: Ask[];
} {
  const options: ProductOption[] = [];
  const asks: (Ask & { labelled: boolean })[] = [];
  for (const field of fields) {
    const read = readField(field.label, field.name);
    const choices = (field.options ?? []).map((choice) => ({
      label: spellChoice(read.key, choice.label),
      price: Number(choice.price ?? 0),
    }));
    if (read.variant && field.type === "select") {
      if (options.some((option) => option.name === read.label))
        throw new Error(`Two "${read.label}" options`);
      options.push({
        name: read.label,
        values: choices.map(({ label, price }) => ({
          name: label,
          surcharge: price,
        })),
      });
      continue;
    }
    const ask = {
      key: read.key,
      label: read.label,
      ...(read.hint ? { hint: read.hint } : {}),
      kind: field.type,
      required: read.required,
      choices,
      labelled: field.label !== null,
    };
    const same = asks.findIndex((other) => other.key === ask.key);
    if (same === -1) asks.push(ask);
    else if (asks[same]?.labelled === ask.labelled)
      throw new Error(`"${read.label}" is asked twice`);
    else if (ask.labelled) asks[same] = ask;
  }
  return { options, asks: asks.map(({ labelled: _, ...ask }) => ask) };
}

function identity(ask: Ask): string {
  return JSON.stringify([
    ask.key,
    ask.label,
    ask.hint ?? "",
    ask.kind,
    ask.required,
    ask.choices.map((choice) => [choice.label, choice.price]),
  ]);
}

/** WordPress allows underscores in a product's address; Shopify doesn't. */
function handleOf(slug: string): string {
  const handle = slug.replaceAll("_", "-");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))
    throw new Error(`"${slug}" can't be a Shopify handle`);
  return handle;
}

/** A product's categories and their parents, by handle. */
function categoriesOf(
  woo: WooProduct,
  categories: Map<number, WooCategory>,
): string[] {
  const handles = new Set<string>();
  for (const { id } of woo.categories)
    for (
      let category = categories.get(id);
      category;
      category = categories.get(category.parent)
    )
      if (!uncategorized.has(category.slug)) handles.add(category.slug);
  return [...handles].sort();
}
