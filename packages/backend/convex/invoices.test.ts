import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { testConvex } from "../test/convex";
import { fakeSmartBill } from "../test/smartbill";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { creditInvoice } from "./invoices";
import {
  invoiceOf,
  ManualInvoice,
  romanianDay,
  standardTax,
} from "./invoices/document";
import { invoiceEmail, invoiceNotice } from "./orders/emails";
import { errors } from "./utils/errors";

const token = "c".repeat(40);

/** Classic Roses' invitation, 30 of them with paid choices and a fee. */
const roses = {
  token,
  handle: "invitatie-de-nunta-classic-roses",
  quantity: 30,
  options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
  answers: [
    { key: "culoare-sigiliu", value: "Alb" },
    { key: "panglica", value: "Panglică mătase" },
    { key: "text-personalizat", value: "Ana și Mihai" },
  ],
  fees: ["diacritice-50"],
};

const invoiceEnv = [
  "SITE_URL",
  "SHOP_URL",
  "STRIPE_SECRET_KEY",
  "SMARTBILL_USERNAME",
  "SMARTBILL_TOKEN",
  "SMARTBILL_SERIES",
  "SMARTBILL_CIF",
  "WORKSHOP_EMAILS",
] as const;

let stripe: ReturnType<typeof fakeStripe> | undefined;
let smartbill: ReturnType<typeof fakeSmartBill> | undefined;
let log: Mock<typeof console.log>;
let warn: Mock<typeof console.warn>;

beforeEach(() => {
  Object.assign(process.env, {
    SITE_URL: "http://localhost:3024/studio",
    SHOP_URL: "https://jolene.ro",
    STRIPE_SECRET_KEY: "sk_test_jolene",
    SMARTBILL_USERNAME: "facturi@jolene.ro",
    SMARTBILL_TOKEN: "smartbill-token",
    SMARTBILL_SERIES: "JOL",
    WORKSHOP_EMAILS: "atelier@jolene.ro",
  });
  log = spyOn(console, "log").mockImplementation(() => {});
  warn = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // SmartBill's fake stands in front of Stripe's: it goes first.
  smartbill?.restore();
  smartbill = undefined;
  stripe?.restore();
  stripe = undefined;
  log.mockRestore();
  warn.mockRestore();
  setSystemTime();
  for (const name of invoiceEnv) Reflect.deleteProperty(process.env, name);
});

type Payment = Parameters<ReturnType<typeof fakeStripe>["pay"]>[1];

/** The shop's catalog with `lines` in the cart, and Stripe and SmartBill standing by. */
async function shop(lines: "roses" | "invitation" = "roses") {
  const t = testConvex();
  await t.action(internal.init.seed, {});
  if (lines === "roses") await t.mutation(api.cart.add, roses);
  else {
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        ownerId: await ctx.db.insert("users", { isAnonymous: true }),
        occasion: "wedding",
        fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
        updatedAt: Date.now(),
      }),
    );
    await t.mutation(api.cart.add, {
      token,
      handle: digitalInvitation.handle,
      quantity: 1,
      options: [],
      answers: [],
      fees: [],
      eventId,
    });
  }
  stripe = fakeStripe();
  smartbill = fakeSmartBill();
  return { t, stripe, smartbill };
}

type Shop = Awaited<ReturnType<typeof shop>>;

async function theOrder(t: Shop["t"]) {
  const order = await t.run((ctx) => ctx.db.query("orders").first());
  if (!order) throw new Error("No order recorded");
  return order;
}

/**
 * Pays for the cart on Stripe's page, in live mode unless `test`, and lets
 * everything the order sets off run: its invoice among it.
 */
async function pay(
  { t, stripe }: Shop,
  { test = false, ...payment }: Payment & { test?: boolean } = {},
) {
  await t.action(api.checkout.start, {
    token,
    language: "ro",
    unlockNow: true,
  });
  const session = stripe.pay(stripe.latest().id, payment);
  session.livemode = !test;
  await t.action(api.checkout.confirm, { session: session.id });
  await t.finishAllScheduledFunctions(() => {});
  return await theOrder(t);
}

/** Who the workshop's account is, signed in. */
async function workshop(t: Shop["t"]) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session` });
}

/** What the team was told, as the logs have it while no email goes out. */
const told = () => warn.mock.calls.map((call) => String(call[0]));

describe("a paid order's invoice", () => {
  test("is issued in SmartBill once the order is paid, for what the couple paid", async () => {
    // Half past midnight in Romania, on the 22nd.
    setSystemTime(new Date("2026-10-21T21:30:00Z"));
    const setup = await shop();
    const order = await pay(setup);
    const { smartbill } = setup;

    expect(order.invoice).toMatchObject({
      status: "issued",
      series: "JOL",
      number: "0042",
    });
    expect(order.invoice?.draft).toBeUndefined();
    expect(order.invoice?.warning).toBeUndefined();

    const [request, ...others] = smartbill.calls("invoice");
    expect(others).toEqual([]);
    expect(request?.method).toBe("POST");
    expect(request?.headers.get("authorization")).toBe(
      `Basic ${btoa("facturi@jolene.ro:smartbill-token")}`,
    );
    expect(smartbill.calls("tax")[0]?.query.get("cif")).toBe("RO49475720");
    const vat = { isTaxIncluded: true, taxName: "Normala", taxPercentage: 21 };
    const item = { measuringUnitName: "buc", currency: "RON", saveToDb: false };
    expect(request?.body).toEqual({
      companyVatCode: "RO49475720",
      client: {
        name: "ANA POPESCU",
        address: "Strada Florilor 1, Ap. 2",
        city: "Cluj-Napoca",
        county: "Cluj",
        country: "Romania",
        email: "ana@example.com",
        saveToDb: false,
      },
      issueDate: "2026-10-22",
      seriesName: "JOL",
      isDraft: false,
      currency: "RON",
      precision: 2,
      useStock: false,
      mentions: "Comanda J1001, plătită cu cardul.",
      products: [
        {
          name: "Invitație de nuntă Classic Roses",
          productDescription: "Carton: Ivory texturat 300 gr",
          quantity: 30,
          price: 10.5,
          ...vat,
          ...item,
          isService: false,
        },
        {
          name: "Diacritice",
          quantity: 1,
          price: 50,
          ...vat,
          ...item,
          isService: true,
        },
        {
          name: "Livrare prin curier",
          quantity: 1,
          price: 25,
          ...vat,
          ...item,
          isService: true,
        },
      ],
      payment: { value: 390, type: "Card online", isCash: false },
    });

    // Its PDF is kept, and the order's page links to it.
    const file = order.invoice?.file;
    if (!file) throw new Error("No PDF kept");
    const pdf = await setup.t.run(async (ctx) =>
      (await ctx.storage.get(file))?.text(),
    );
    expect(pdf).toBe("%PDF-1.4 JOL 0042");
    expect(smartbill.calls("invoice/pdf")[0]?.query.toString()).toBe(
      "cif=RO49475720&seriesname=JOL&number=0042",
    );
    const view = await setup.t.query(api.orders.byToken, {
      token: order.token,
    });
    expect(view?.invoice).toEqual({
      name: "JOL 0042",
      url: expect.any(String),
    });
    expect(view?.creditNote).toBeUndefined();
    expect(told()).toEqual([]);
  });

  test("is made out to the company the couple bought as", async () => {
    const setup = await shop();
    await pay(setup, {
      company: { name: "Foto Studio SRL", taxId: "ro 12345678" },
    });
    expect(setup.smartbill.calls("invoice")[0]?.body?.client).toMatchObject({
      name: "Foto Studio SRL",
      vatCode: "RO12345678",
      isTaxPayer: true,
    });
  });

  test("names a Bucharest buyer's sector as their town, as e-Factura asks", async () => {
    const setup = await shop("invitation");
    const order = await pay(setup);
    const [request] = setup.smartbill.calls("invoice");
    expect(request?.body?.client).toMatchObject({
      address: "Bulevardul Unirii 1",
      city: "Sector 3",
      county: "București",
    });
    // The digital invitation is a service, with nothing to deliver.
    expect(request?.body?.products).toEqual([
      expect.objectContaining({
        name: order.lines[0]?.title,
        quantity: 1,
        price: 249,
        isService: true,
      }),
    ]);
  });

  test("takes a promotion code's discount off what was bought", async () => {
    const setup = await shop();
    const order = await pay(setup, { discount: 5000 });
    const products = setup.smartbill.calls("invoice")[0]?.body
      ?.products as Record<string, unknown>[];
    expect(products.map((product) => product.name)).toEqual([
      "Invitație de nuntă Classic Roses",
      "Diacritice",
      "Reducere",
      "Livrare prin curier",
    ]);
    expect(products[2]).toEqual({
      name: "Reducere",
      isDiscount: true,
      numberOfItems: 2,
      discountType: 1,
      discountValue: -50,
      measuringUnitName: "buc",
      currency: "RON",
      isTaxIncluded: true,
      taxName: "Normala",
      taxPercentage: 21,
    });
    expect(setup.smartbill.calls("invoice")[0]?.body?.payment).toEqual({
      value: 340,
      type: "Card online",
      isCash: false,
    });
    // What SmartBill came to is what Stripe charged: nothing to look at.
    expect(order.invoice?.warning).toBeUndefined();
  });

  test("is a draft for a test order: no payment, PDF or email", async () => {
    const setup = await shop();
    const order = await pay(setup, { test: true });
    const [request] = setup.smartbill.calls("invoice");
    expect(request?.body).toMatchObject({ isDraft: true });
    expect(request?.body?.payment).toBeUndefined();
    expect(order.invoice).toMatchObject({ status: "issued", draft: true });
    expect(setup.smartbill.calls("invoice/pdf")).toEqual([]);
    const view = await setup.t.query(api.orders.byToken, {
      token: order.token,
    });
    expect(view?.invoice).toBeUndefined();
  });

  test("is issued once, however often it's asked for", async () => {
    const setup = await shop();
    const order = await pay(setup);
    await setup.t.action(internal.invoices.issue, { orderId: order._id });
    expect(
      await setup.t.mutation(internal.invoices.claim, {
        orderId: order._id,
        document: "invoice",
      }),
    ).toBeNull();
    expect(
      await (await workshop(setup.t)).mutation(api.invoices.retry, {
        number: 1001,
      }),
    ).toBe(false);
    expect(setup.smartbill.calls("invoice")).toHaveLength(1);
  });

  test("tells the team when SmartBill comes to another total than Stripe charged", async () => {
    const setup = await shop();
    setup.smartbill.misprice(0.01);
    const order = await pay(setup);
    expect(order.invoice).toMatchObject({
      status: "issued",
      warning:
        "în SmartBill are 390,01 lei, iar Stripe a încasat 390,00 lei: verificați-o.",
    });
    expect(told()).toContain(
      "Order J1001's invoice JOL 0042: în SmartBill are 390,01 lei, iar Stripe a încasat 390,00 lei: verificați-o.",
    );
  });

  test("stays issued when its PDF can't be fetched, and the team hears of it", async () => {
    const setup = await shop();
    setup.smartbill.fail("invoice/pdf", {
      status: 400,
      errorText: "Documentul nu poate fi descarcat.",
    });
    const order = await pay(setup);
    expect(order.invoice).toMatchObject({
      status: "issued",
      number: "0042",
      warning:
        "PDF-ul n-a putut fi luat din SmartBill (Documentul nu poate fi descarcat.).",
    });
    expect(order.invoice?.file).toBeUndefined();
    expect(setup.smartbill.calls("invoice")).toHaveLength(1);
  });

  test("is left to the team when SmartBill refuses it, until the workshop asks again", async () => {
    const setup = await shop();
    setup.smartbill.fail("invoice", {
      status: 400,
      errorText: "Clientul nu are completat judetul.",
    });
    const order = await pay(setup);
    expect(order.invoice).toMatchObject({
      status: "failed",
      error: "Clientul nu are completat judetul.",
    });
    const notice = invoiceNotice(
      order,
      { document: "invoice", problem: "Clientul nu are completat judetul." },
      `https://jolene.ro/orders/${order.token}`,
    );
    expect(notice.subject).toBe("Factura comenzii J1001 · de verificat");
    expect(notice.text).toBe(
      [
        "SmartBill n-a emis factura comenzii J1001: Clientul nu are completat judetul.",
        "",
        "Emiteți-o de mână în SmartBill, sau din nou din atelier.",
        "",
        "Client: ANA POPESCU · ana@example.com",
        "Total: 390,00 lei",
        `Pagina comenzii: https://jolene.ro/orders/${order.token}`,
      ].join("\n"),
    );
    expect(told()).toContain(notice.text);

    // Only the workshop asks again.
    await expect(
      setup.t.mutation(api.invoices.retry, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.workshopOnly });
    setup.smartbill.recover("invoice");
    const staff = await workshop(setup.t);
    expect(await staff.mutation(api.invoices.retry, { number: 1001 })).toBe(
      true,
    );
    await setup.t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(setup.t)).invoice).toMatchObject({
      status: "issued",
      number: "0042",
    });
    expect(await staff.mutation(api.invoices.retry, { number: 1009 })).toBe(
      false,
    );
  });

  test("warns the team to look in SmartBill first when it didn't answer", async () => {
    const setup = await shop();
    // The gateway gave up, though SmartBill went ahead.
    setup.smartbill.fail("invoice", { status: 504, issued: true });
    const order = await pay(setup);
    expect(order.invoice).toMatchObject({
      status: "failed",
      error:
        "SmartBill a răspuns 504: Bad Gateway. SmartBill poate s-o fi emis totuși: verificați în SmartBill înainte s-o emiteți din nou.",
    });
    expect(setup.smartbill.documents.size).toBe(1);

    setup.smartbill.fail("invoice", "unreachable");
    const staff = await workshop(setup.t);
    await staff.mutation(api.invoices.retry, { number: 1001 });
    await setup.t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(setup.t)).invoice?.error).toBe(
      "SmartBill n-a răspuns (TypeError: fetch failed). SmartBill poate s-o fi emis totuși: verificați în SmartBill înainte s-o emiteți din nou.",
    );
  });

  test("is left to the team when SmartBill has no VAT rate", async () => {
    const setup = await shop();
    setup.smartbill.taxes([]);
    const order = await pay(setup);
    expect(order.invoice).toMatchObject({
      status: "failed",
      error: "SmartBill n-are nicio cotă de TVA a firmei.",
    });
    expect(setup.smartbill.calls("invoice")).toEqual([]);
  });

  test("isn't asked for until SmartBill is set up", async () => {
    Reflect.deleteProperty(process.env, "SMARTBILL_SERIES");
    const setup = await shop();
    const order = await pay(setup);
    expect(order.invoice).toBeUndefined();
    expect(setup.smartbill.requests).toEqual([]);
    expect(log.mock.calls.map((call) => String(call[0]))).toContain(
      "Order J1001 gets no invoice from SmartBill: SMARTBILL_USERNAME, SMARTBILL_TOKEN or SMARTBILL_SERIES isn't set",
    );
    // Nor can the workshop ask for it.
    expect(
      await (await workshop(setup.t)).mutation(api.invoices.retry, {
        number: 1001,
      }),
    ).toBe(false);
  });

  test("goes to the couple by email, in the language they paid in", async () => {
    const setup = await shop();
    const order = await pay(setup);
    const download = `https://jolene.ro/orders/${order.token}/invoice`;
    const page = `https://jolene.ro/orders/${order.token}`;
    const email = invoiceEmail(order, "JOL 0042", download, page);
    expect(email.subject).toBe("Factura comenzii J1001 · Jolene");
    expect(email.text).toBe(
      [
        "Factura comenzii J1001 e gata: JOL 0042.",
        "",
        `Descărcați factura: ${download}`,
        `O găsiți oricând și pe pagina comenzii: ${page}`,
        "",
        "Jolene · jolene.ro",
      ].join("\n"),
    );
    expect(email.html).toContain(`href="${download}"`);
    const english = invoiceEmail(
      { ...order, language: "en", test: true },
      "JOL 0042",
      download,
      page,
    );
    expect(english.subject).toBe("[Test] Invoice for order J1001 · Jolene");
    expect(english.text).toContain(
      "The invoice for order J1001 is ready: JOL 0042.",
    );
    // Without Resend, the logs say it went by no email.
    expect(log.mock.calls.map((call) => String(call[0]))).toContain(
      "Order J1001's invoice JOL 0042 went by no email: RESEND_API_KEY isn't set",
    );
  });
});

describe("a refunded order's credit note", () => {
  test("reverses the invoice in full, in its series", async () => {
    setSystemTime(new Date("2026-11-02T10:00:00Z"));
    const setup = await shop();
    const order = await pay(setup);
    expect(await setup.t.run((ctx) => creditInvoice(ctx, order._id))).toBe(
      true,
    );
    await setup.t.finishAllScheduledFunctions(() => {});

    const [request] = setup.smartbill.calls("invoice/reverse");
    expect(request?.body).toEqual({
      companyVatCode: "RO49475720",
      seriesName: "JOL",
      number: "0042",
      issueDate: "2026-11-02",
    });
    const refunded = await theOrder(setup.t);
    expect(refunded.creditNote).toMatchObject({
      status: "issued",
      series: "JOL",
      number: "0043",
      file: expect.any(String),
    });
    expect(refunded.invoice).toEqual(order.invoice);
    const view = await setup.t.query(api.orders.byToken, {
      token: order.token,
    });
    expect(view?.creditNote).toEqual({
      name: "JOL 0043",
      url: expect.any(String),
    });

    // Once is all.
    expect(await setup.t.run((ctx) => creditInvoice(ctx, order._id))).toBe(
      false,
    );
    await setup.t.finishAllScheduledFunctions(() => {});
    expect(setup.smartbill.calls("invoice/reverse")).toHaveLength(1);
  });

  test("isn't issued for a draft, or an invoice SmartBill never issued", async () => {
    const draft = await shop();
    const tested = await pay(draft, { test: true });
    expect(await draft.t.run((ctx) => creditInvoice(ctx, tested._id))).toBe(
      false,
    );
    smartbill?.restore();
    stripe?.restore();

    const refused = await shop();
    refused.smartbill.fail("invoice", { status: 400, errorText: "Eroare." });
    const order = await pay(refused);
    expect(await refused.t.run((ctx) => creditInvoice(ctx, order._id))).toBe(
      false,
    );
  });

  test("tells the team when SmartBill refuses it, and can be asked for again", async () => {
    const setup = await shop();
    const order = await pay(setup);
    setup.smartbill.fail("invoice/reverse", {
      status: 400,
      errorText: "Factura este incasata.",
    });
    await setup.t.run((ctx) => creditInvoice(ctx, order._id));
    await setup.t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(setup.t)).creditNote).toMatchObject({
      status: "failed",
      error: "Factura este incasata.",
    });
    expect(told()).toContain(
      [
        "SmartBill n-a emis factura de stornare comenzii J1001: Factura este incasata.",
        "",
        "Emiteți-o de mână în SmartBill, sau din nou din atelier.",
        "",
        "Client: ANA POPESCU · ana@example.com",
        "Total: 390,00 lei",
        `Pagina comenzii: https://jolene.ro/orders/${order.token}`,
      ].join("\n"),
    );

    setup.smartbill.recover("invoice/reverse");
    expect(await setup.t.run((ctx) => creditInvoice(ctx, order._id))).toBe(
      true,
    );
    await setup.t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(setup.t)).creditNote).toMatchObject({
      status: "issued",
      number: "0043",
    });
  });
});

describe("romanianDay", () => {
  test("is the day in Romania: three hours ahead of UTC in summer, two in winter", () => {
    const day = (time: string) => romanianDay(Date.parse(time));
    expect(day("2026-10-21T20:59:00Z")).toBe("2026-10-21");
    expect(day("2026-10-21T21:00:00Z")).toBe("2026-10-22");
    // Clocks go back at 01:00 UTC on the last Sunday of October.
    expect(day("2026-10-25T00:59:00Z")).toBe("2026-10-25");
    expect(day("2026-10-25T21:59:00Z")).toBe("2026-10-25");
    expect(day("2026-10-25T22:00:00Z")).toBe("2026-10-26");
    expect(day("2026-12-31T21:59:00Z")).toBe("2026-12-31");
    expect(day("2026-12-31T22:00:00Z")).toBe("2027-01-01");
    // And forward at 01:00 UTC on the last Sunday of March.
    expect(day("2027-03-27T21:59:00Z")).toBe("2027-03-27");
    expect(day("2027-03-28T21:00:00Z")).toBe("2027-03-29");
  });
});

describe("standardTax", () => {
  test("is SmartBill's Normala rate, else the highest", () => {
    expect(
      standardTax([
        { name: "Redusa", percentage: 11 },
        { name: "Normală", percentage: 21 },
      ]),
    ).toEqual({ name: "Normală", percentage: 21 });
    expect(
      standardTax([
        { name: "TVA 11%", percentage: 11 },
        { name: "TVA 21%", percentage: 21 },
      ]),
    ).toEqual({ name: "TVA 21%", percentage: 21 });
    expect(standardTax([])).toBeNull();
  });
});

describe("invoiceOf", () => {
  const account = {
    username: "facturi@jolene.ro",
    token: "smartbill-token",
    cif: "RO49475720",
    series: "JOL",
  };
  const tax = { name: "Normala", percentage: 21 };

  /** A paid order, as one recorded from Stripe's page. */
  async function recorded() {
    const setup = await shop();
    Reflect.deleteProperty(process.env, "SMARTBILL_SERIES");
    return await pay(setup);
  }

  test("leaves an order from abroad bought as a company to the team", async () => {
    const order = await recorded();
    const abroad: Doc<"orders"> = {
      ...order,
      billing: {
        company: "Studio GmbH",
        taxId: "DE123456789",
        address: {
          name: "Anna Weber",
          line1: "Hauptstraße 1",
          city: "Berlin",
          postalCode: "10115",
          country: "DE",
        },
      },
    };
    expect(() => invoiceOf(abroad, account, tax, "2026-10-21")).toThrow(
      new ManualInvoice(
        "Firmă din afara României (DE): emiteți factura de mână, cu taxare inversă dacă se aplică.",
      ),
    );
  });

  test("leaves an order without billing details to the team", async () => {
    const { billing: _, ...order } = await recorded();
    expect(() => invoiceOf(order, account, tax, "2026-10-21")).toThrow(
      ManualInvoice,
    );
  });

  test("has no delivery line for an order picked up from the workshop", async () => {
    const setup = await shop();
    const order = await pay(setup, { delivery: 1 });
    const products = setup.smartbill.calls("invoice")[0]?.body
      ?.products as Record<string, unknown>[];
    expect(products.map((product) => product.name)).toEqual([
      "Invitație de nuntă Classic Roses",
      "Diacritice",
    ]);
    expect(invoiceOf(order, account, tax, "2026-10-21").payment?.value).toBe(
      365,
    );
  });
});
