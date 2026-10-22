import { describe, expect, test } from "bun:test";
import {
  eucaliptInvitation,
  eucaliptMenu,
  parseDocument,
} from "@jolene/design";
import { guestCount, type OrderedProduct, orderOf } from "./finishes";

// A cotton card under a vellum band closed with a sage seal, in an envelope.
const invitation = parseDocument(eucaliptInvitation);
// One cotton card, with no seal and no envelope.
const menu = parseDocument(eucaliptMenu);

const product: OrderedProduct = {
  handle: "invitatie-test",
  title: "Invitație",
  price: 600,
  compareAtPrice: undefined,
  minQuantity: 30,
  options: [
    {
      name: "Carton",
      values: [
        {
          name: "Alb mat 300 gr",
          surcharge: 0,
          look: { kind: "paper", stock: "smooth-300", color: null },
        },
        {
          name: "Bumbac 350 gr",
          surcharge: 100,
          look: { kind: "paper", stock: "cotton-350", color: null },
        },
        // Looks like the one before.
        {
          name: "Bumbac natur",
          surcharge: 150,
          look: { kind: "paper", stock: "cotton-350", color: null },
        },
      ],
    },
  ],
  lineOptions: [
    {
      key: "culoare-sigiliu",
      label: "Culoare sigiliu",
      hint: undefined,
      kind: "select",
      required: false,
      shows: "seal",
      choices: [
        {
          label: "Fără sigiliu",
          price: 0,
          look: { kind: "seal", color: null },
        },
        {
          label: "Verde salvie",
          price: 150,
          look: { kind: "seal", color: "#8A9A7B" },
        },
        {
          label: "Auriu",
          price: 150,
          look: { kind: "seal", color: "#b8913a" },
        },
      ],
    },
    {
      key: "culoare-plic",
      label: "Culoare plic",
      hint: undefined,
      kind: "select",
      required: false,
      shows: "envelope",
      choices: [
        {
          label: "Alb",
          price: 150,
          look: { kind: "envelope", color: "#ffffff" },
        },
        {
          label: "Roz",
          price: 150,
          look: { kind: "envelope", color: "#ecd3d9" },
        },
      ],
    },
    {
      key: "flori-criogenate",
      label: "Flori criogenate",
      hint: undefined,
      kind: "select",
      required: false,
      shows: null,
      choices: [
        { label: "Nu doresc", price: 0, look: null },
        { label: "Flori criogenate", price: 150, look: null },
      ],
    },
    {
      key: "personalizat",
      label: "Personalizat",
      hint: undefined,
      kind: "select",
      required: true,
      shows: null,
      choices: [
        { label: "General", price: 0, look: null },
        { label: "Nominal", price: 100, look: null },
      ],
    },
    {
      key: "text-personalizat",
      label: "Text personalizat",
      hint: undefined,
      kind: "text",
      required: true,
      shows: null,
      choices: [],
    },
  ],
};

const labels = (order: ReturnType<typeof orderOf>) => ({
  values: Object.fromEntries(
    [...order.values].map(([name, value]) => [name, value?.name]),
  ),
  choices: Object.fromEntries(
    [...order.choices].map(([key, choice]) => [
      key,
      choice === null ? null : choice?.label,
    ]),
  ),
});

describe("orderOf", () => {
  test("the design answers what it shows, the shop's start the rest", () => {
    const order = orderOf(invitation, product, undefined);
    expect(labels(order)).toEqual({
      values: { Carton: "Bumbac 350 gr" },
      choices: {
        "culoare-sigiliu": "Verde salvie",
        // The envelope is none of the product's colours.
        "culoare-plic": undefined,
        "flori-criogenate": "Nu doresc",
        personalizat: undefined,
      },
    });
    expect(order.missing).toEqual(["Culoare plic", "Personalizat"]);
    expect(order.price).toBe(600 + 100 + 150);
    expect(order.quantity).toBe(30);
    expect(order.total).toBe(850 * 30);
  });

  test("keeps a pick while the design shows it, and gives way when it doesn't", () => {
    const order = orderOf(invitation, product, {
      options: [{ name: "Carton", value: "Bumbac natur" }],
      // The seal is still sage, as if the gold were undone.
      answers: [{ key: "culoare-sigiliu", value: "Auriu" }],
    });
    expect(labels(order).values).toEqual({ Carton: "Bumbac natur" });
    expect(labels(order).choices["culoare-sigiliu"]).toBe("Verde salvie");
    expect(order.price).toBe(600 + 150 + 150);
  });

  test("keeps the picks that change nothing, and leaves out what may be", () => {
    const order = orderOf(invitation, product, {
      quantity: 80,
      options: [],
      answers: [
        { key: "flori-criogenate", value: "Flori criogenate" },
        { key: "personalizat", value: "Nominal" },
        // No colour is free, so none of them can be ordered.
        { key: "culoare-plic", value: "" },
      ],
    });
    expect(labels(order).choices).toMatchObject({
      "culoare-plic": null,
      "flori-criogenate": "Flori criogenate",
      personalizat: "Nominal",
    });
    expect(order.missing).toEqual([]);
    expect(order.line.answers).toEqual([
      { key: "culoare-sigiliu", value: "Verde salvie" },
      { key: "flori-criogenate", value: "Flori criogenate" },
      { key: "personalizat", value: "Nominal" },
    ]);
    expect(order.price).toBe(600 + 100 + 150 + 150 + 100);
    expect(order.total).toBe(1100 * 80);
  });

  test("a choice no longer offered, or too few, gives way", () => {
    const order = orderOf(menu, product, {
      quantity: 10,
      options: [{ name: "Carton", value: "Carton vechi" }],
      answers: [
        { key: "flori-criogenate", value: "Flori uscate" },
        // Not one the couple may leave out: a free choice says none.
        { key: "culoare-sigiliu", value: "" },
      ],
    });
    expect(labels(order).values).toEqual({ Carton: "Bumbac 350 gr" });
    expect(labels(order).choices).toMatchObject({
      // The menu has no seal.
      "culoare-sigiliu": "Fără sigiliu",
      "flori-criogenate": "Nu doresc",
    });
    expect(order.quantity).toBe(30);
  });
});

describe("guestCount", () => {
  const list = { households: 74, seats: 180 };

  test("counts invitations by family and menus by person", () => {
    expect(guestCount("invitation", list)).toEqual({
      of: "families",
      count: 74,
    });
    expect(guestCount("menu", list)).toEqual({ of: "people", count: 180 });
    expect(guestCount("table-number", list)).toBeNull();
  });
});
