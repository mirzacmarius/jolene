import type { Admin } from "@jolene/products/admin";
import { attributes, proofNote } from "@jolene/products/order";
import type { Infer } from "convex/values";
import type {
  issueValidator,
  lineValidator,
  orderValidator,
  proofValidator,
} from "./validators";

/**
 * The workshop's order list, read from the store: the open orders, the
 * products and fees their lines name, and what each line's order options
 * cost today (ADR 0008).
 */

type Issue = Infer<typeof issueValidator>;
type Proof = Infer<typeof proofValidator>;
export type WorkshopOrder = Infer<typeof orderValidator>;
type WorkshopLine = Infer<typeof lineValidator>;

type Page<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

/** An order's line as the Admin API answers (documents.ts in products). */
export type StoreLine = {
  id: string;
  title: string;
  variantTitle: string | null;
  currentQuantity: number;
  customAttributes: { key: string; value: string | null }[];
  originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  variant: { id: string } | null;
  product: { id: string } | null;
};

type StoreOrderPage = {
  id: string;
  legacyResourceId: string;
  name: string;
  processedAt: string;
  test: boolean;
  note: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string;
  lineItems: Page<StoreLine>;
};

/** An order with all its lines. */
export type StoreOrder = Omit<StoreOrderPage, "lineItems"> & {
  lines: StoreLine[];
};

/** A line option, as the workshop checks a line's answers against it. */
export type StoreLineOption = {
  label: string;
  kind: string;
  required: boolean;
  choices: { label: string; price: string }[];
};

/** What the store says today of the products and fees orders name. */
export type StoreData = {
  products: Map<
    string,
    { lineOptions: StoreLineOption[]; minQuantity: number }
  >;
  /** Each fee variant's name, such as "Diacritice · 50 lei". */
  fees: Map<string, string>;
};

/** Pages of open orders the list reads at most: 40 orders, oldest first. */
const MAX_PAGES = 5;

/** The open orders, oldest first, with all their lines. */
export async function readOrders(admin: Admin) {
  const orders: StoreOrder[] = [];
  let after: string | null = null;
  for (let page = 1; ; page++) {
    const { orders: found }: { orders: Page<StoreOrderPage> } =
      await admin.request("orders", { after });
    for (const { lineItems, ...order } of found.nodes) {
      const lines = [...lineItems.nodes];
      let { pageInfo } = lineItems;
      while (pageInfo.hasNextPage) {
        const { order: rest } = await admin.request<{
          order: { lineItems: Page<StoreLine> } | null;
        }>("orderLines", { id: order.id, after: pageInfo.endCursor });
        if (!rest) break;
        lines.push(...rest.lineItems.nodes);
        pageInfo = rest.lineItems.pageInfo;
      }
      orders.push({ ...order, lines });
    }
    if (!found.pageInfo.hasNextPage) return { orders, more: false };
    if (page === MAX_PAGES) return { orders, more: true };
    after = found.pageInfo.endCursor;
  }
}

type StoreNode = {
  id: string;
  lineOptions?: { value: string } | null;
  minQuantity?: { value: string } | null;
  title?: string;
  product?: { title: string };
  fields?: { key: string; value: string | null }[];
} | null;

const gidPatterns = {
  metaobject: /^gid:\/\/shopify\/Metaobject\/\d+$/,
  variant: /^gid:\/\/shopify\/ProductVariant\/\d+$/,
};

/**
 * Nodes by ID, a hundred a call (the API takes up to 250). One malformed
 * ID fails a whole call, so IDs from metafields and attributes are checked
 * against `gidPatterns` before they're asked for.
 */
async function readNodes(admin: Admin, ids: string[]) {
  const nodes = new Map<string, NonNullable<StoreNode>>();
  const unique = [...new Set(ids)];
  for (let start = 0; start < unique.length; start += 100) {
    const { nodes: found } = await admin.request<{ nodes: StoreNode[] }>(
      "orderNodes",
      { ids: unique.slice(start, start + 100) },
    );
    for (const node of found) if (node) nodes.set(node.id, node);
  }
  return nodes;
}

/** The IDs a list reference's value holds, such as a metafield's. */
function referenced(json: string | null | undefined, pattern: RegExp) {
  try {
    const value: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (id): id is string => typeof id === "string" && pattern.test(id),
        )
      : [];
  } catch {
    return [];
  }
}

function field(node: NonNullable<StoreNode>, key: string) {
  return node.fields?.find((entry) => entry.key === key)?.value ?? undefined;
}

/** A line's attribute, if it has one with a value. */
function attribute(line: StoreLine, key: string) {
  const value = line.customAttributes.find((entry) => entry.key === key)?.value;
  return value?.trim() || undefined;
}

/** The fee variants a product line was ordered with. */
function feesOf(line: StoreLine) {
  return (attribute(line, attributes.fees)?.split(",") ?? []).filter((id) =>
    gidPatterns.variant.test(id),
  );
}

/** What a line is to the cart: a product, or a line kept beside one. */
function roleOf(line: StoreLine) {
  if (attribute(line, attributes.extrasFor)) return "extras";
  if (attribute(line, attributes.fee)) return "fee";
  return "product";
}

/** The products and fees the orders' lines name, as the store has them. */
export async function readStoreData(
  admin: Admin,
  orders: StoreOrder[],
): Promise<StoreData> {
  const lines = orders
    .flatMap((order) => order.lines)
    .filter((line) => roleOf(line) === "product");
  const productIds = lines.flatMap((line) => line.product?.id ?? []);
  const feeIds = lines.flatMap(feesOf);
  const first = await readNodes(admin, [...productIds, ...feeIds]);
  const options = await readNodes(
    admin,
    productIds.flatMap((id) =>
      referenced(first.get(id)?.lineOptions?.value, gidPatterns.metaobject),
    ),
  );
  const choices = await readNodes(
    admin,
    [...options.values()].flatMap((option) =>
      referenced(field(option, "choices"), gidPatterns.metaobject),
    ),
  );

  const lineOption = (id: string): StoreLineOption[] => {
    const option = options.get(id);
    const label = option && field(option, "label");
    if (!option || !label) return [];
    return [
      {
        label,
        kind: field(option, "kind") ?? "text",
        required: field(option, "required") === "true",
        choices: referenced(
          field(option, "choices"),
          gidPatterns.metaobject,
        ).flatMap((choiceId) => {
          const choice = choices.get(choiceId);
          const choiceLabel = choice && field(choice, "label");
          return choice && choiceLabel
            ? [{ label: choiceLabel, price: field(choice, "price") ?? "0" }]
            : [];
        }),
      },
    ];
  };

  return {
    products: new Map(
      productIds.flatMap((id) => {
        const product = first.get(id);
        if (!product) return [];
        return [
          [
            id,
            {
              lineOptions: referenced(
                product.lineOptions?.value,
                gidPatterns.metaobject,
              ).flatMap(lineOption),
              minQuantity: Math.max(1, Number(product.minQuantity?.value) || 1),
            },
          ] as const,
        ];
      }),
    ),
    fees: new Map(
      feeIds.flatMap((id) => {
        const fee = first.get(id);
        return fee?.product
          ? [[id, nameOf(fee.product.title, fee.title ?? null)] as const]
          : [];
      }),
    ),
  };
}

/** The proofs the orders' lines name. */
export function proofIdsOf(orders: StoreOrder[]) {
  return [
    ...new Set(
      orders.flatMap((order) =>
        order.lines.flatMap((line) => attribute(line, attributes.proof) ?? []),
      ),
    ),
  ];
}

const toBani = (amount: string) => Math.round(Number(amount) * 100);
const fromBani = (bani: number) => (bani / 100).toFixed(2);

/** What a line charged in all, in bani. */
function charged(line: StoreLine) {
  return (
    toBani(line.originalUnitPriceSet.shopMoney.amount) * line.currentQuantity
  );
}

/** Payment statuses of an order Shopify has been paid for. */
const paid = new Set(["PAID", "PARTIALLY_REFUNDED"]);

/**
 * An order as the workshop's list shows it: the products ordered, each
 * with its proof, answers and extras, and anything that doesn't add up.
 */
export function checkOrder(
  order: StoreOrder,
  store: StoreData,
  proofs: Map<string, Proof>,
  domain: string,
): WorkshopOrder {
  const products = order.lines.filter((line) => roleOf(line) === "product");
  const extras = order.lines.filter((line) => roleOf(line) === "extras");
  const fees = order.lines.filter((line) => roleOf(line) === "fee");
  const issues: Issue[] = [];
  if (!paid.has(order.displayFinancialStatus ?? ""))
    issues.push({ kind: "not-paid", status: order.displayFinancialStatus });

  const lineIds = new Set(
    products.flatMap((line) => attribute(line, attributes.line) ?? []),
  );
  for (const line of extras)
    if (!lineIds.has(attribute(line, attributes.extrasFor) ?? ""))
      issues.push({ kind: "extras-alone", paid: fromBani(charged(line)) });

  const charges = new Set(fees.flatMap((line) => line.variant?.id ?? []));
  for (const fee of new Set(products.flatMap(feesOf)))
    if (!charges.has(fee))
      issues.push({ kind: "fee-missing", fee: store.fees.get(fee) ?? fee });

  return {
    id: order.id,
    name: order.name,
    processedAt: order.processedAt,
    url: `https://${domain}/admin/orders/${order.legacyResourceId}`,
    test: order.test,
    note: order.note?.trim() || null,
    payment: order.displayFinancialStatus,
    fulfillment: order.displayFulfillmentStatus,
    currency:
      order.lines[0]?.originalUnitPriceSet.shopMoney.currencyCode ?? "RON",
    lines: products.map((line) => checkLine(line, extras, store, proofs)),
    fees: fees.map((line) => ({
      title: nameOf(line.title, line.variantTitle),
      quantity: line.currentQuantity,
    })),
    issues,
  };
}

/** Shopify names the one variant of a product without options so. */
function variantOf(title: string | null) {
  return title && title !== "Default Title" ? title : null;
}

/** A product and its variant, as the list names fees: "Diacritice · 50 lei". */
function nameOf(product: string, variant: string | null) {
  return [product, variantOf(variant)].filter(Boolean).join(" · ");
}

function checkLine(
  line: StoreLine,
  extrasLines: StoreLine[],
  store: StoreData,
  proofs: Map<string, Proof>,
): WorkshopLine {
  const issues: Issue[] = [];
  const lineId = attribute(line, attributes.line);
  const extras = lineId
    ? extrasLines.filter(
        (extra) => attribute(extra, attributes.extrasFor) === lineId,
      )
    : [];
  const paidExtras = extras.reduce((sum, extra) => sum + charged(extra), 0);

  const product = line.product && store.products.get(line.product.id);
  if (!product) issues.push({ kind: "product-gone" });
  else {
    if (line.currentQuantity < product.minQuantity)
      issues.push({ kind: "below-minimum", minQuantity: product.minQuantity });
    // What each one costs today with its choices, unless a choice is unknown.
    let perItem: number | null = 0;
    for (const option of product.lineOptions) {
      const answer = attribute(line, option.label);
      if (!answer) {
        if (option.required)
          issues.push({ kind: "missing-answer", option: option.label });
        continue;
      }
      if (option.kind !== "select") continue;
      const choice = option.choices.find((choice) => choice.label === answer);
      if (!choice) {
        issues.push({ kind: "unknown-choice", option: option.label, answer });
        perItem = null;
      } else if (perItem !== null) perItem += toBani(choice.price);
    }
    if (perItem !== null && perItem * line.currentQuantity !== paidExtras)
      issues.push({
        kind: "extras",
        paid: fromBani(paidExtras),
        expected: fromBani(perItem * line.currentQuantity),
      });
  }

  const proofId = attribute(line, attributes.proof);
  const proof = proofId ? proofs.get(proofId) : undefined;
  if (proofId && !proof) issues.push({ kind: "proof-missing", proof: proofId });
  // The proof shows when it was approved; the cart's note of it is for the
  // customer, unless the studio no longer has the proof.
  const shown = (key: string) =>
    !key.startsWith("_") && !(proof && key === proofNote);

  return {
    id: line.id,
    title: line.title,
    variant: variantOf(line.variantTitle),
    quantity: line.currentQuantity,
    answers: line.customAttributes.flatMap(({ key, value }) =>
      shown(key) && value?.trim() ? [{ label: key, value: value.trim() }] : [],
    ),
    extras: extras.length > 0 ? fromBani(paidExtras) : null,
    proof: proof ?? null,
    issues,
  };
}
