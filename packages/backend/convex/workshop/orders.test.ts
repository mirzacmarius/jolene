import { describe, expect, test } from "bun:test";
import type { Admin } from "@jolene/products/admin";
import { attributes, proofNote } from "@jolene/products/order";
import {
  checkOrder,
  proofIdsOf,
  readStoreData,
  type StoreData,
  type StoreLine,
  type StoreOrder,
} from "./orders";

let next = 1;

/** A line as the Admin API answers it. */
function line(
  title: string,
  quantity: number,
  price: string,
  pairs: Record<string, string>,
  ids: { product?: string; variant?: string; variantTitle?: string } = {},
): StoreLine {
  return {
    id: `gid://shopify/LineItem/${next++}`,
    title,
    variantTitle: ids.variantTitle ?? null,
    currentQuantity: quantity,
    customAttributes: Object.entries(pairs).map(([key, value]) => ({
      key,
      value,
    })),
    originalUnitPriceSet: { shopMoney: { amount: price, currencyCode: "RON" } },
    variant: ids.variant ? { id: ids.variant } : null,
    product: ids.product ? { id: ids.product } : null,
  };
}

function order(lines: StoreLine[], status: string | null = "PAID"): StoreOrder {
  return {
    id: "gid://shopify/Order/7",
    legacyResourceId: "7",
    name: "#1001",
    processedAt: "2026-10-20T10:00:00Z",
    test: false,
    note: null,
    displayFinancialStatus: status,
    displayFulfillmentStatus: "UNFULFILLED",
    lines,
  };
}

const invitation = "gid://shopify/Product/1";
const diacritics = "gid://shopify/ProductVariant/901";

const store: StoreData = {
  products: new Map([
    [
      invitation,
      {
        minQuantity: 30,
        lineOptions: [
          {
            label: "Culoare sigiliu",
            kind: "select",
            required: true,
            choices: [
              { label: "Auriu", price: "2.50" },
              { label: "Fără sigiliu", price: "0.00" },
            ],
          },
          {
            label: "Panglică",
            kind: "select",
            required: false,
            choices: [
              { label: "Bej", price: "2.00" },
              { label: "Fără", price: "0.00" },
            ],
          },
          { label: "Text", kind: "textarea", required: true, choices: [] },
        ],
      },
    ],
  ]),
  fees: new Map([[diacritics, "Diacritice · 50 lei"]]),
};

/** An invitation line with a seal and a ribbon, and its extras line. */
function invitationLines(quantity = 100, extrasPrice = "4.50") {
  return [
    line(
      "Invitație Olive & Goldy",
      quantity,
      "9.00",
      {
        "Culoare sigiliu": "Auriu",
        Panglică: "Bej",
        Text: "Ana și Mihai",
        Diacritice: "Da",
        [attributes.extras]: "gid://shopify/ProductVariant/545",
        [attributes.fees]: diacritics,
        [attributes.line]: "k3x9",
      },
      { product: invitation, variantTitle: "Carton perlat 300 g" },
    ),
    line(
      "Opțiuni suplimentare",
      quantity,
      extrasPrice,
      {
        Pentru: "Invitație Olive & Goldy (Carton perlat 300 g)",
        [attributes.extrasFor]: "k3x9",
      },
      { variant: "gid://shopify/ProductVariant/545" },
    ),
  ];
}

const feeLine = () =>
  line(
    "Diacritice",
    1,
    "50.00",
    { [attributes.fee]: "1" },
    { variant: diacritics, variantTitle: "50 lei" },
  );

describe("the workshop's order check", () => {
  test("folds extras into their line and finds nothing amiss", () => {
    const checked = checkOrder(
      order([...invitationLines(), feeLine()]),
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(checked.issues).toEqual([]);
    expect(checked.url).toBe("https://jolene.myshopify.com/admin/orders/7");
    expect(checked.fees).toEqual([
      { title: "Diacritice · 50 lei", quantity: 1 },
    ]);
    expect(checked.lines).toHaveLength(1);
    const [invitationLine] = checked.lines;
    expect(invitationLine?.issues).toEqual([]);
    expect(invitationLine?.extras).toBe("450.00");
    expect(invitationLine?.variant).toBe("Carton perlat 300 g");
    // What the couple saw in the cart, without the cart's own attributes.
    expect(invitationLine?.answers.map((answer) => answer.label)).toEqual([
      "Culoare sigiliu",
      "Panglică",
      "Text",
      "Diacritice",
    ]);
  });

  test("catches a crafted cart: no extras line, no fee, too few", () => {
    const [invitationLine] = invitationLines(20);
    const checked = checkOrder(
      order(invitationLine ? [invitationLine] : []),
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(checked.issues).toEqual([
      { kind: "fee-missing", fee: "Diacritice · 50 lei" },
    ]);
    expect(checked.lines[0]?.issues).toEqual([
      { kind: "below-minimum", minQuantity: 30 },
      { kind: "extras", paid: "0.00", expected: "90.00" },
    ]);
    expect(checked.lines[0]?.extras).toBeNull();
  });

  test("compares extras with what the choices cost today", () => {
    const checked = checkOrder(
      order([...invitationLines(100, "2.00"), feeLine()]),
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(checked.lines[0]?.issues).toEqual([
      { kind: "extras", paid: "200.00", expected: "450.00" },
    ]);
  });

  test("names answers that aren't choices, and skips the sum then", () => {
    const [invitationLine, extras] = invitationLines();
    if (!invitationLine || !extras) throw new Error("no lines");
    invitationLine.customAttributes = invitationLine.customAttributes.map(
      (attribute) =>
        attribute.key === "Culoare sigiliu"
          ? { ...attribute, value: "Roșu" }
          : attribute.key === "Text"
            ? { ...attribute, value: " " }
            : attribute,
    );
    const checked = checkOrder(
      order([invitationLine, extras, feeLine()]),
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(checked.lines[0]?.issues).toEqual([
      { kind: "unknown-choice", option: "Culoare sigiliu", answer: "Roșu" },
      { kind: "missing-answer", option: "Text" },
    ]);
  });

  test("flags an unpaid order, extras on their own and a product gone", () => {
    const [, extras] = invitationLines();
    const gone = line(
      "Meniu",
      50,
      "6.00",
      {},
      { variantTitle: "Default Title" },
    );
    const checked = checkOrder(
      order(extras ? [extras, gone] : [gone], "PENDING"),
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(checked.issues).toEqual([
      { kind: "not-paid", status: "PENDING" },
      { kind: "extras-alone", paid: "450.00" },
    ]);
    expect(checked.lines).toEqual([
      expect.objectContaining({
        title: "Meniu",
        variant: null,
        issues: [{ kind: "product-gone" }],
      }),
    ]);
  });

  test("shows a line's proof, and says when the studio lacks it", () => {
    const proof = {
      id: "kd7proof" as never,
      kind: "invitation" as const,
      suite: { ro: "Olive & Goldy", en: "Olive & Goldy" },
      image: "https://example.test/proof.jpg",
      approvedAt: 1,
    };
    const lines = invitationLines();
    const [invitationLine] = lines;
    invitationLine?.customAttributes.push(
      { key: attributes.proof, value: "kd7proof" },
      { key: proofNote, value: "aprobat pe 20 octombrie 2026" },
    );
    const designed = order([...lines, feeLine()]);
    expect(proofIdsOf([designed])).toEqual(["kd7proof"]);
    const found = checkOrder(
      designed,
      store,
      new Map([["kd7proof", proof]]),
      "jolene.myshopify.com",
    );
    expect(found.lines[0]?.proof).toEqual(proof);
    // The proof shows when it was approved, unless the studio lacks it.
    const notes = (checked: typeof found) =>
      checked.lines[0]?.answers.filter((answer) => answer.label === proofNote);
    expect(notes(found)).toEqual([]);
    const missing = checkOrder(
      designed,
      store,
      new Map(),
      "jolene.myshopify.com",
    );
    expect(missing.lines[0]?.issues).toEqual([
      { kind: "proof-missing", proof: "kd7proof" },
    ]);
    expect(notes(missing)).toEqual([
      { label: proofNote, value: "aprobat pe 20 octombrie 2026" },
    ]);
  });

  test("reads options, their choices and fee names from the store", async () => {
    const nodes: Record<string, unknown> = {
      [invitation]: {
        id: invitation,
        lineOptions: {
          value: JSON.stringify([
            "gid://shopify/Metaobject/11",
            "not an ID",
            "gid://shopify/Metaobject/12",
          ]),
        },
        minQuantity: { value: "30" },
      },
      [diacritics]: {
        id: diacritics,
        title: "50 lei",
        product: { title: "Diacritice" },
      },
      "gid://shopify/Metaobject/11": {
        id: "gid://shopify/Metaobject/11",
        fields: [
          { key: "label", value: "Culoare sigiliu" },
          { key: "kind", value: "select" },
          { key: "required", value: "true" },
          { key: "choices", value: '["gid://shopify/Metaobject/21"]' },
        ],
      },
      "gid://shopify/Metaobject/12": {
        id: "gid://shopify/Metaobject/12",
        fields: [{ key: "label", value: "Text" }],
      },
      "gid://shopify/Metaobject/21": {
        id: "gid://shopify/Metaobject/21",
        fields: [
          { key: "label", value: "Auriu" },
          { key: "price", value: "2.50" },
        ],
      },
    };
    const asked: string[][] = [];
    const admin = {
      request: async (_: string, { ids }: { ids: string[] }) => {
        asked.push(ids);
        return { nodes: ids.map((id) => nodes[id] ?? null) };
      },
    } as unknown as Admin;
    const [invitationLine, extras] = invitationLines();
    if (!invitationLine || !extras) throw new Error("no lines");
    invitationLine.customAttributes.push({
      key: attributes.fees,
      value: `${diacritics},gid://shopify/ProductVariant/x`,
    });
    const read = await readStoreData(admin, [order([invitationLine, extras])]);
    // Products and fees, then their options, then the options' choices;
    // IDs that aren't Shopify's are left out rather than fail a call.
    expect(asked).toEqual([
      [invitation, diacritics],
      ["gid://shopify/Metaobject/11", "gid://shopify/Metaobject/12"],
      ["gid://shopify/Metaobject/21"],
    ]);
    expect(read.fees).toEqual(new Map([[diacritics, "Diacritice · 50 lei"]]));
    expect(read.products.get(invitation)).toEqual({
      minQuantity: 30,
      lineOptions: [
        {
          label: "Culoare sigiliu",
          kind: "select",
          required: true,
          choices: [{ label: "Auriu", price: "2.50" }],
        },
        { label: "Text", kind: "text", required: false, choices: [] },
      ],
    });
  });
});
