import {
  type Catalog,
  type Category,
  type FeeKey,
  fees,
  type LineOption,
  type Product,
} from "../catalog";
import { slug } from "../lift/text";
import { extrasHandle, keys, namespace, types } from "../order";

/**
 * How the catalog sits in Shopify, as the inputs of the Admin API's
 * mutations (documents.ts). Line options and their choices are metaobjects
 * Jolene edits in Shopify's admin; a product points to its line options, its
 * fees and its minimum through metafields the shop reads.
 */

/** The IDs the store gives what the sync creates, looked up as it goes. */
export type Ids = {
  definition(type: string): string;
  metaobject(type: string, handle: string): string;
  collection(handle: string): string;
  feeVariant(fee: FeeKey): string;
};

type Field = { key: string; value: string };

const storefront = { storefront: "PUBLIC_READ" } as const;

export function choiceDefinition() {
  return {
    type: types.choice,
    name: "Alegere",
    description: "Una dintre alegerile unei opțiuni de comandă și prețul ei.",
    displayNameKey: "label",
    access: storefront,
    fieldDefinitions: [
      {
        key: "label",
        name: "Text",
        type: "single_line_text_field",
        required: true,
      },
      {
        key: "price",
        name: "Preț pe bucată (lei)",
        type: "number_decimal",
        required: true,
        validations: [
          { name: "min", value: "0" },
          { name: "max_precision", value: "2" },
        ],
      },
    ],
  };
}

export function lineOptionDefinition(ids: Ids) {
  return {
    type: types.lineOption,
    name: "Opțiune de comandă",
    description:
      "Ce alege sau scrie un client când comandă un produs, în afară de variantele lui. Produsele care întreabă la fel o împart.",
    displayNameKey: "name",
    access: storefront,
    fieldDefinitions: [
      {
        key: "name",
        name: "Nume în admin",
        type: "single_line_text_field",
        required: true,
      },
      {
        key: "key",
        name: "Ce întreabă",
        type: "single_line_text_field",
        required: true,
      },
      {
        key: "label",
        name: "Etichetă",
        type: "single_line_text_field",
        required: true,
      },
      { key: "hint", name: "Indicație", type: "single_line_text_field" },
      {
        key: "kind",
        name: "Fel",
        type: "single_line_text_field",
        required: true,
        validations: [
          {
            name: "choices",
            value: JSON.stringify(["select", "text", "textarea", "email"]),
          },
        ],
      },
      { key: "required", name: "Obligatorie", type: "boolean", required: true },
      {
        key: "choices",
        name: "Alegeri",
        type: "list.metaobject_reference",
        validations: [
          {
            name: "metaobject_definition_id",
            value: ids.definition(types.choice),
          },
        ],
      },
    ],
  };
}

export function productMetafieldDefinitions(ids: Ids) {
  return [
    {
      namespace,
      key: keys.lineOptions,
      ownerType: "PRODUCT",
      name: "Opțiuni de comandă",
      description: "Ce alege sau scrie clientul când comandă, în ordine.",
      type: "list.metaobject_reference",
      validations: [
        {
          name: "metaobject_definition_id",
          value: ids.definition(types.lineOption),
        },
      ],
      access: storefront,
      // Shown on the product's page in the admin.
      pin: true,
    },
    {
      namespace,
      key: keys.minQuantity,
      ownerType: "PRODUCT",
      name: "Comandă minimă",
      description:
        "Cea mai mică cantitate pe care Jolene o primește la comandă.",
      type: "number_integer",
      validations: [{ name: "min", value: "1" }],
      access: storefront,
      pin: true,
    },
    {
      namespace,
      key: keys.fees,
      ownerType: "PRODUCT",
      name: "Taxe",
      description:
        "Taxele unice pe care le poate avea produsul, ca diacriticele.",
      type: "list.variant_reference",
      access: storefront,
      pin: true,
    },
  ];
}

/** A choice's handle: its option's, then its own label. */
export function choiceHandle(option: LineOption, label: string): string {
  return `${option.handle}-${slug(label)}`;
}

export function choiceUpserts(catalog: Catalog) {
  const upserts = catalog.lineOptions.flatMap((option) =>
    option.choices.map((choice) => ({
      handle: {
        type: types.choice,
        handle: choiceHandle(option, choice.label),
      },
      metaobject: {
        fields: [
          { key: "label", value: choice.label },
          { key: "price", value: money(choice.price) },
        ],
      },
    })),
  );
  const handles = upserts.map((upsert) => upsert.handle.handle);
  const twice = handles.find((handle, i) => handles.indexOf(handle) !== i);
  if (twice) throw new Error(`Two choices are "${twice}"`);
  return upserts;
}

export function lineOptionUpsert(option: LineOption, ids: Ids) {
  const fields: Field[] = [
    { key: "name", value: `${option.label} · ${option.handle}` },
    { key: "key", value: option.key },
    { key: "label", value: option.label },
    { key: "kind", value: option.kind },
    { key: "required", value: String(option.required) },
  ];
  if (option.hint) fields.push({ key: "hint", value: option.hint });
  if (option.choices.length > 0)
    fields.push({
      key: "choices",
      value: JSON.stringify(
        option.choices.map((choice) =>
          ids.metaobject(types.choice, choiceHandle(option, choice.label)),
        ),
      ),
    });
  return {
    handle: { type: types.lineOption, handle: option.handle },
    metaobject: { fields },
  };
}

export function collectionInput(category: Category) {
  return { handle: category.handle, title: category.title };
}

export type Status = "DRAFT" | "ACTIVE" | "UNLISTED";

/**
 * What `productSet` takes for a product. A product new to the store gets
 * its status and photos; one it has keeps them, as Jolene may have changed
 * them in the admin.
 */
export function productInput(
  product: Product,
  ids: Ids,
  creating?: { status: Status },
) {
  const metafields: (Field & { namespace: string; type: string })[] = [];
  if (product.lineOptions.length > 0)
    metafields.push({
      namespace,
      key: keys.lineOptions,
      type: "list.metaobject_reference",
      value: JSON.stringify(
        product.lineOptions.map((handle) =>
          ids.metaobject(types.lineOption, handle),
        ),
      ),
    });
  if (product.minQuantity)
    metafields.push({
      namespace,
      key: keys.minQuantity,
      type: "number_integer",
      value: String(product.minQuantity),
    });
  if (product.fees.length > 0)
    metafields.push({
      namespace,
      key: keys.fees,
      type: "list.variant_reference",
      value: JSON.stringify(product.fees.map((fee) => ids.feeVariant(fee))),
    });
  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: "Jolene",
    tags: product.tags,
    collections: product.categories.map((handle) => ids.collection(handle)),
    ...variantsOf(product),
    metafields,
    ...(creating && {
      status: creating.status,
      files: product.images.map((image) => ({
        originalSource: image.url,
        alt: image.alt,
        contentType: "IMAGE",
      })),
    }),
  };
}

/**
 * A product's Shopify options and a variant for each combination of their
 * values, priced with the values' surcharges. A product without options
 * has Shopify's one default variant.
 */
function variantsOf(product: Product) {
  if (product.options.length === 0)
    return {
      productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
      variants: [
        variant(product, [{ optionName: "Title", name: "Default Title" }], 0),
      ],
    };
  let combinations: {
    optionName: string;
    name: string;
    surcharge: number;
  }[][] = [[]];
  for (const option of product.options)
    combinations = combinations.flatMap((combination) =>
      option.values.map((value) => [
        ...combination,
        {
          optionName: option.name,
          name: value.name,
          surcharge: value.surcharge,
        },
      ]),
    );
  return {
    productOptions: product.options.map((option, index) => ({
      name: option.name,
      position: index + 1,
      values: option.values.map((value) => ({ name: value.name })),
    })),
    variants: combinations.map((combination) =>
      variant(
        product,
        combination.map(({ optionName, name }) => ({ optionName, name })),
        combination.reduce((sum, value) => sum + value.surcharge, 0),
      ),
    ),
  };
}

function variant(
  product: Product,
  optionValues: { optionName: string; name: string }[],
  surcharge: number,
) {
  return {
    optionValues,
    price: money(product.price + surcharge),
    ...(product.compareAtPrice !== undefined && {
      compareAtPrice: money(product.compareAtPrice + surcharge),
    }),
    // Jolene makes each order, so there's no stock to count.
    inventoryItem: { tracked: false },
  };
}

/** Jolene's fees, each a product the shop adds once to an order. */
const feeProducts: Record<string, { title: string; descriptionHtml: string }> =
  {
    diacritice: {
      title: "Diacritice",
      descriptionHtml:
        "<p>Textul tipărit cu diacritice, o dată pe comandă.</p>",
    },
    "comanda-urgenta": {
      title: "Comandă urgentă",
      descriptionHtml: "<p>Comanda lucrată în regim de urgență.</p>",
    },
  };

/** The option a fee product's variants are priced by. */
export const feeOption = "Taxă";

export const feeHandles = Object.keys(feeProducts);

export function feeProductInput(handle: string, creating?: { status: Status }) {
  const about = feeProducts[handle];
  if (!about) throw new Error(`No fee product "${handle}"`);
  const variants = Object.values(fees).filter((fee) => fee.product === handle);
  return {
    handle,
    ...about,
    vendor: "Jolene",
    productOptions: [
      {
        name: feeOption,
        values: variants.map((fee) => ({ name: fee.variant })),
      },
    ],
    variants: variants.map((fee) =>
      serviceVariant(feeOption, fee.variant, fee.price),
    ),
    ...(creating && { status: creating.status }),
  };
}

/**
 * The product the shop charges a line's paid options with, on a line of
 * its own beside it: a variant for each price they can add up to.
 */
export const extras = {
  handle: extrasHandle,
  title: "Opțiuni suplimentare",
  option: "Preț pe bucată",
  /** Lei: every choice costs a multiple of it. */
  step: 0.1,
  /** Lei: more than any product's paid options add up to. */
  most: 20,
};

export function extrasInput(creating?: { status: Status }) {
  const prices = Array.from(
    { length: Math.round(extras.most / extras.step) },
    (_, i) => Math.round((i + 1) * extras.step * 100) / 100,
  );
  return {
    handle: extras.handle,
    title: extras.title,
    descriptionHtml:
      "<p>Opțiunile alese pentru un produs, la prețul lor pe bucată.</p>",
    vendor: "Jolene",
    productOptions: [
      {
        name: extras.option,
        values: prices.map((price) => ({ name: extrasValue(price) })),
      },
    ],
    variants: prices.map((price) =>
      serviceVariant(extras.option, extrasValue(price), price),
    ),
    ...(creating && { status: creating.status }),
  };
}

/** "4,50 lei" */
export function extrasValue(price: number): string {
  return `${price.toFixed(2).replace(".", ",")} lei`;
}

/** A variant of something Jolene charges for that isn't shipped. */
function serviceVariant(optionName: string, name: string, price: number) {
  return {
    optionValues: [{ optionName, name }],
    price: money(price),
    inventoryItem: { tracked: false, requiresShipping: false },
  };
}

/**
 * The most a product's paid options add to each one ordered, so the
 * extras product can charge it.
 */
export function mostExtras(product: Product, catalog: Catalog): number {
  const options = new Map(catalog.lineOptions.map((o) => [o.handle, o]));
  return product.lineOptions.reduce((sum, handle) => {
    const prices = options.get(handle)?.choices.map((choice) => choice.price);
    return sum + Math.max(0, ...(prices ?? []));
  }, 0);
}

/** Lei as Shopify's Money takes them: "8.50". */
export function money(lei: number): string {
  return (Math.round(lei * 100) / 100).toFixed(2);
}
