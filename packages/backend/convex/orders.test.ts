import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { testConvex } from "../test/convex";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { unopenedInvitations } from "./orders";
import { noticeEmail } from "./orders/emails";

const checkoutEnv = ["SITE_URL", "STRIPE_SECRET_KEY"] as const;

let stripe: ReturnType<typeof fakeStripe> | undefined;

beforeEach(() => {
  Object.assign(process.env, {
    SITE_URL: "http://localhost:3024/studio",
    STRIPE_SECRET_KEY: "sk_test_jolene",
  });
});

afterEach(() => {
  stripe?.restore();
  stripe = undefined;
  for (const name of checkoutEnv) Reflect.deleteProperty(process.env, name);
});

describe("a paid digital invitation that unlocked nothing", () => {
  type Setup = Awaited<ReturnType<typeof wedding>>;

  /** A couple's wedding, as the studio keeps it, and Stripe standing by. */
  async function wedding() {
    const t = testConvex();
    await t.action(internal.init.seed, {});
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        ownerId: await ctx.db.insert("users", { isAnonymous: true }),
        occasion: "wedding",
        fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
        updatedAt: Date.now(),
      }),
    );
    stripe = fakeStripe();
    return { t, stripe, eventId };
  }

  /** Puts the event's digital invitation in a cart. */
  const addInvitation = ({ t, eventId }: Setup, token: string) =>
    t.mutation(api.cart.add, {
      token,
      handle: digitalInvitation.handle,
      quantity: 1,
      options: [],
      answers: [],
      fees: [],
      eventId,
    });

  /** Opens Stripe's page for a cart, as its Pay button does. */
  async function open({ t, stripe }: Setup, token: string) {
    await t.action(api.checkout.start, { token, language: "ro" });
    return stripe.latest().id;
  }

  /** Pays on a Stripe page opened earlier, and returns the order recorded. */
  async function pay({ t, stripe }: Setup, session: string) {
    stripe.pay(session);
    await t.action(api.checkout.confirm, { session });
    return await t.run(
      async (ctx) =>
        (await ctx.db
          .query("orders")
          .withIndex("by_session", (q) => q.eq("session", session))
          .unique()) as Doc<"orders">,
    );
  }

  /** The order of the event's digital invitation alone, paid. */
  async function paidInvitation(setup: Setup) {
    await addInvitation(setup, "a".repeat(40));
    return await pay(setup, await open(setup, "a".repeat(40)));
  }

  test("says nothing of one the order unlocked", async () => {
    const setup = await wedding();
    const order = await paidInvitation(setup);
    const unopened = await setup.t.run((ctx) =>
      unopenedInvitations(ctx, order),
    );
    expect(unopened).toEqual([]);
    expect(noticeEmail(order, null, unopened).text).toContain(
      "Nimic de livrat: comanda deschide invitația digitală tuturor invitaților.",
    );
  });

  test("asks the team to refund one both of a couple paid for", async () => {
    const setup = await wedding();
    const { t, eventId } = setup;
    // Each of the couple opens Stripe's page from their own cart before
    // either pays.
    await addInvitation(setup, "a".repeat(40));
    await addInvitation(setup, "b".repeat(40));
    const sessions = [
      await open(setup, "a".repeat(40)),
      await open(setup, "b".repeat(40)),
    ];
    const first = await pay(setup, sessions[0] as string);
    const second = await pay(setup, sessions[1] as string);
    expect([first.number, second.number]).toEqual([1001, 1002]);

    expect(await t.run((ctx) => unopenedInvitations(ctx, first))).toEqual([]);
    const unopened = await t.run((ctx) => unopenedInvitations(ctx, second));
    expect(unopened).toMatchObject([
      { event: eventId, unlocked: { by: "order", order: "J1001" } },
    ]);
    const { text } = noticeEmail(second, null, unopened);
    expect(text).toContain(
      `  Pentru Ana și Mihai, evenimentul ${eventId}\n  Era deja deblocată de comanda J1001, deci plata de 249,00 lei n-a deblocat nimic: returnați-o.`,
    );
    expect(text).toContain("\n\nNimic de livrat.\n");
    expect(text).not.toContain("comanda deschide");
  });

  test("says how it was unlocked before: by hand or with printed invitations", async () => {
    const setup = await wedding();
    const order = await paidInvitation(setup);
    const notice = (unlocked: NonNullable<Doc<"invites">["unlocked"]>) =>
      noticeEmail(order, null, [{ event: setup.eventId, unlocked }]).text;
    expect(notice({ by: "hand", order: "Transfer 42", at: 0 })).toContain(
      "  Era deja deblocată de mână (Transfer 42), deci plata de 249,00 lei n-a deblocat nimic: returnați-o.",
    );
    expect(notice({ by: "print", order: "J1009", at: 0 })).toContain(
      "  Era deja deblocată de invitațiile tipărite din comanda J1009, deci plata de 249,00 lei n-a deblocat nimic: returnați-o.",
    );
  });

  test("asks the team to unlock one by hand when unlocking failed", async () => {
    const setup = await wedding();
    const { t, eventId } = setup;
    const order = await paidInvitation(setup);
    // As if the unlock had rolled back on its own.
    await t.run(async (ctx) => {
      const invite = await ctx.db
        .query("invites")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .unique();
      if (invite)
        await ctx.db.patch("invites", invite._id, { unlocked: undefined });
    });
    const unopened = await t.run((ctx) => unopenedInvitations(ctx, order));
    expect(unopened).toEqual([{ event: eventId, unlocked: null }]);
    expect(noticeEmail(order, null, unopened).text).toContain(
      "  N-a putut fi deblocată: deblocați-o de mână (invites/unlock:byHand) sau returnați plata de 249,00 lei.",
    );
  });

  test("has nothing to refund on one free with printed invitations", async () => {
    const setup = await wedding();
    const order = await paidInvitation(setup);
    const free = {
      ...order,
      lines: order.lines.map((line) => ({ ...line, price: 0, total: 0 })),
    };
    const notice = (unlocked: Doc<"invites">["unlocked"] | null) =>
      noticeEmail(free, null, [
        { event: setup.eventId, unlocked: unlocked ?? null },
      ]).text;
    expect(notice({ by: "order", order: "J1000", at: 0 })).not.toContain(
      "returnați",
    );
    expect(notice(null)).toContain(
      "  N-a putut fi deblocată: deblocați-o de mână (invites/unlock:byHand).",
    );
  });

  test("leaves the notice of an order without a digital invitation as it was", async () => {
    const setup = await wedding();
    const token = "a".repeat(40);
    await setup.t.mutation(api.cart.add, {
      token,
      handle: "invitatie-de-nunta-classic-roses",
      quantity: 30,
      options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
      answers: [
        { key: "culoare-sigiliu", value: "Alb" },
        { key: "panglica", value: "Panglică mătase" },
        { key: "text-personalizat", value: "Ana și Mihai" },
      ],
      fees: [],
    });
    const order = await pay(setup, await open(setup, token));
    const unopened = await setup.t.run((ctx) =>
      unopenedInvitations(ctx, order),
    );
    expect(unopened).toEqual([]);
    expect(noticeEmail(order, null, unopened).text).toBe(
      noticeEmail(order, null).text,
    );
  });
});
