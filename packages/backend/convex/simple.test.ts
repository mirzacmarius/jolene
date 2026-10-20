import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages";
import {
  type DesignDocument,
  type DesignDocumentInput,
  eucaliptInvitation,
  eucaliptMenu,
  eucaliptPlaceCard,
  eucaliptSaveTheDate,
  eucalyptusArtwork,
} from "@jolene/design";
import { Glob } from "bun";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { setTestModelClient } from "./ai/model";
import { play, standInTurn } from "./ai/standIn";
import schema from "./schema";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

const art = [
  {
    key: eucalyptusArtwork.key,
    path: "/studio/art/sample/eucalyptus.svg",
    contentType: eucalyptusArtwork.contentType,
    recolorable: true,
    name: eucalyptusArtwork.name,
  },
];

const wedding = {
  suite: {
    slug: "sample",
    name: { ro: "Eucalipt", en: "Eucalyptus" },
    description: { ro: "Ramuri de eucalipt.", en: "Eucalyptus sprigs." },
    occasion: "wedding" as const,
    styles: ["botanic"],
    published: true,
    sortOrder: 0,
    sampleFields: {},
  },
  // The invitation is listed after the save-the-date, so it goes first by
  // being the invitation, not by the collection's order.
  templates: [
    { slug: "sample-save-the-date", document: eucaliptSaveTheDate },
    { slug: "sample-invitation", document: eucaliptInvitation },
    { slug: "sample-menu", document: eucaliptMenu },
  ],
  art,
};

const christening = {
  suite: {
    ...wedding.suite,
    slug: "sample-christening",
    occasion: "christening" as const,
    sortOrder: 1,
  },
  templates: [
    {
      slug: "sample-christening-card",
      document: {
        ...eucaliptPlaceCard,
        occasion: "christening",
        kind: "invitation",
      } as DesignDocumentInput,
    },
    {
      slug: "sample-christening-menu",
      document: { ...eucaliptMenu, occasion: "christening" },
    },
  ],
  art,
};

const aiEnv = [
  "ANTHROPIC_API_KEY",
  "AI_MODEL",
  "AI_DAILY_LIMIT",
  "AI_DAILY_LIMIT_TOTAL",
  "AI_STAND_IN",
];

function setEnv(values: Record<string, string>) {
  for (const name of aiEnv) Reflect.deleteProperty(process.env, name);
  Object.assign(process.env, values);
}

/**
 * The stand-in answers for the model, at once: it writes a line in the
 * chosen tone into each item. The requests are kept to look at.
 */
function standInModel() {
  const requests: BetaMessageStreamParams[] = [];
  setTestModelClient({
    async stream(request, onEvent, signal) {
      requests.push(structuredClone(request));
      const turn = standInTurn(request);
      return await play(turn.content, turn.stop, onEvent, signal, 0);
    },
  });
  return requests;
}

beforeEach(() => {
  setEnv({ ANTHROPIC_API_KEY: "test-key" });
});

afterEach(() => {
  setTestModelClient(undefined);
  setEnv({});
});

async function setUp(template = "sample-invitation") {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.save.suite, wedding);
  await t.mutation(internal.catalog.save.suite, christening);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { isAnonymous: true }),
  );
  const couple = t.withIdentity({ subject: `${userId}|session` });
  const designId = await couple.mutation(api.designs.start, { template });
  return { t, couple, designId };
}

type Setup = Awaited<ReturnType<typeof setUp>>;

const request = (kind: string) => ({
  kind: kind as "invitation",
  request: `Scrieți textul: ${kind}`,
});

const progressOf = async ({ couple }: Setup, designIds: Id<"designs">[]) =>
  Object.fromEntries(
    (await couple.query(api.simple.progress, { designIds })).map((each) => [
      each.designId,
      each.status,
    ]),
  );

const documentOf = async ({ couple }: Setup, designId: Id<"designs">) => {
  const data = await couple.query(api.designs.get, { designId });
  if (!data) throw new Error("No design");
  return data.design.document as DesignDocument;
};

const textsOf = (document: DesignDocument) =>
  document.pieces.flatMap((piece) =>
    (piece.front?.layers ?? []).flatMap((layer) =>
      layer.type === "text" ? [layer.text] : [],
    ),
  );

/** The context of the request that began a design's reply. */
function contextOf(requests: BetaMessageStreamParams[], item: string) {
  for (const each of requests) {
    const first = each.messages[0];
    if (!first || typeof first.content === "string") continue;
    const context = first.content.find(
      (block) => block.type === "text" && block.text.startsWith("<context>"),
    );
    if (
      context?.type === "text" &&
      context.text.includes(`<composition item="${item}"`)
    )
      return context.text;
  }
  throw new Error(`No request for the ${item}`);
}

async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<string>).data).toBe(code);
    return;
  }
  throw new Error(`Expected the error ${code}`);
}

describe("simple mode", () => {
  test("writes the invitation first, then the other items in its voice", async () => {
    const setup = await setUp("sample-save-the-date");
    const requests = standInModel();
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("menu"), request("save-the-date"), request("invitation")],
      tone: "classic",
      language: "ro",
      locale: "ro",
    });

    // The invitation first, then the collection's order; the open design
    // is its item's, and the others start from their templates.
    expect(items.map((item) => [item.kind, item.written])).toEqual([
      ["invitation", true],
      ["save-the-date", true],
      ["menu", true],
    ]);
    expect(items[1]?.designId).toBe(setup.designId);
    const ids = items.map((item) => item.designId);
    const [invitation, saveTheDate, menu] = ids as [
      Id<"designs">,
      Id<"designs">,
      Id<"designs">,
    ];
    expect(await progressOf(setup, ids)).toEqual({
      [invitation]: "pending",
      [saveTheDate]: "waiting",
      [menu]: "waiting",
    });
    // A waiting item's design takes no other message meanwhile.
    await expectError(
      setup.couple.mutation(api.ai.send, {
        designId: menu,
        text: "Altceva",
        locale: "ro",
      }),
      "ai-busy",
    );

    await setup.t.finishAllScheduledFunctions(() => {});
    expect(await progressOf(setup, ids)).toEqual({
      [invitation]: "done",
      [saveTheDate]: "done",
      [menu]: "done",
    });

    // Each item is written in its own conversation, from the couple's words.
    const conversation = await setup.couple.query(api.ai.messages, {
      designId: menu,
    });
    expect(conversation.map((message) => message.role)).toEqual([
      "couple",
      "designer",
    ]);
    expect(conversation[0]?.text).toBe("Scrieți textul: menu");
    expect(conversation[1]?.changes).toHaveLength(1);

    // The invitation sets the voice; the others are told its wording.
    const first = contextOf(requests, "Invitation");
    expect(first).toContain('<composition item="Invitation" first="true">');
    expect(first).toContain("in this order: Invitation, Save the date, Menu");
    expect(first).toContain('<wording language="ro" tone="classic">');
    const later = contextOf(requests, "Menu");
    expect(later).toContain('<composition item="Menu" first="false">');
    expect(later).toContain("Cu binecuvântarea părinților");
    expect(textsOf(await documentOf(setup, invitation))).toContain(
      "Cu binecuvântarea părinților,\n{{partner1}} și {{partner2}} vă invită la cununia lor",
    );
    expect(textsOf(await documentOf(setup, menu))).toContain(
      "Vă mulțumim că ne sunteți alături,\n{{partner1}} și {{partner2}}",
    );

    // The event keeps how the wording should read, for what comes later.
    const data = await setup.couple.query(api.designs.get, {
      designId: setup.designId,
    });
    expect(data?.event.wording).toEqual({ tone: "classic", language: "ro" });
  });

  test("keeps the couple's designs of an item and their own line", async () => {
    const setup = await setUp();
    const menu = await setup.couple.mutation(api.designs.start, {
      template: "sample-menu",
    });
    const requests = standInModel();
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("menu")],
      tone: "romantic",
      line: "  Iubirea nu cere nimic.  ",
      language: "en",
      locale: "ro",
    });
    expect(items.map((item) => item.designId)).toEqual([setup.designId, menu]);
    await setup.t.finishAllScheduledFunctions(() => {});

    const first = contextOf(requests, "Invitation");
    expect(first).toContain('<wording language="en" tone="romantic">');
    expect(first).toContain('as they wrote it: "Iubirea nu cere nimic."');
    // The cards are in English now, as the couple chose.
    const invitation = await documentOf(setup, setup.designId);
    expect(invitation.language).toBe("en");
    expect(textsOf(invitation)).toContain(
      "Iubirea nu cere nimic.\nOne glance began a story:\n{{partner1}} and {{partner2}} invite you to celebrate it",
    );
    expect((await documentOf(setup, menu)).language).toBe("en");

    const collection = await setup.couple.query(api.simple.collection, {
      designId: setup.designId,
    });
    expect(collection?.suite.slug).toBe("sample");
    expect(collection?.designs.map((design) => design._id)).toEqual([
      setup.designId,
      menu,
    ]);
  });

  test("writes what the day's messages allow, the invitation first", async () => {
    setEnv({ ANTHROPIC_API_KEY: "test-key", AI_DAILY_LIMIT: "2" });
    const setup = await setUp();
    standInModel();
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("save-the-date"), request("menu")],
      language: "ro",
      locale: "ro",
    });
    expect(items.map((item) => [item.kind, item.written])).toEqual([
      ["invitation", true],
      ["save-the-date", true],
      ["menu", false],
    ]);
    await setup.t.finishAllScheduledFunctions(() => {});
    const progress = await setup.couple.query(api.simple.progress, {
      designIds: items.map((item) => item.designId),
    });
    expect(progress.map((each) => each.status)).toEqual(["done", "done"]);
    // The menu is started all the same, in Jolene's wording.
    expect(textsOf(await documentOf(setup, items[2]!.designId))).toEqual(
      textsOf(
        await documentOf(
          setup,
          await setup.couple.mutation(api.designs.start, {
            template: "sample-menu",
          }),
        ),
      ),
    );
    await expectError(
      setup.couple.mutation(api.ai.send, {
        designId: setup.designId,
        text: "Încă ceva",
        locale: "ro",
      }),
      "ai-limit",
    );
  });

  test("starts the items without the AI designer, in Jolene's wording", async () => {
    setEnv({});
    const setup = await setUp();
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("menu")],
      tone: "classic",
      language: "en",
      locale: "en",
    });
    expect(items.map((item) => [item.kind, item.written])).toEqual([
      ["invitation", false],
      ["menu", false],
    ]);
    expect(
      await setup.couple.query(api.simple.progress, {
        designIds: items.map((item) => item.designId),
      }),
    ).toEqual([]);
    const data = await setup.couple.query(api.designs.get, {
      designId: setup.designId,
    });
    expect(data?.event.wording).toBeUndefined();
    expect((await documentOf(setup, items[1]!.designId)).language).toBe("ro");
  });

  test("begins the other items when the first one is stopped", async () => {
    const setup = await setUp();
    const requests = standInModel();
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("save-the-date"), request("menu")],
      tone: "modern",
      language: "ro",
      locale: "ro",
    });
    const progress = await setup.couple.query(api.simple.progress, {
      designIds: items.map((item) => item.designId),
    });
    // The couple stops the menu while it waits, then the invitation.
    await setup.couple.mutation(api.ai.stop, {
      messageId: progress[2]!.replyId,
    });
    await setup.couple.mutation(api.ai.stop, {
      messageId: progress[0]!.replyId,
    });
    expect(
      (
        await setup.couple.query(api.simple.progress, {
          designIds: items.map((item) => item.designId),
        })
      ).map((each) => each.status),
    ).toEqual(["stopped", "pending", "stopped"]);
    await setup.t.finishAllScheduledFunctions(() => {});

    // The save-the-date is written on its own, without wording to echo.
    expect(requests).toHaveLength(2);
    const later = contextOf(requests, "Save the date");
    expect(later).toContain('first="false"');
    expect(later).toContain("its wording wasn't finished");

    // The stopped menu takes a message again, in a thread of its own.
    const menu = items[2]!.designId;
    await setup.couple.mutation(api.ai.send, {
      designId: menu,
      text: "Culori mai calde",
      locale: "ro",
    });
    await setup.t.finishAllScheduledFunctions(() => {});
    const messages = await setup.couple.query(api.ai.messages, {
      designId: menu,
    });
    expect(messages.map((message) => message.status)).toEqual([
      "done",
      "stopped",
      "done",
      "done",
    ]);
  });

  test("leaves out items whose design is still busy", async () => {
    const setup = await setUp();
    standInModel();
    await setup.couple.mutation(api.ai.send, {
      designId: setup.designId,
      text: "Culori mai calde",
      locale: "ro",
    });
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("menu")],
      language: "ro",
      locale: "ro",
    });
    expect(items.map((item) => [item.kind, item.written])).toEqual([
      ["invitation", false],
      ["menu", true],
    ]);
    await setup.t.finishAllScheduledFunctions(() => {});
    const progress = await setup.couple.query(api.simple.progress, {
      designIds: items.map((item) => item.designId),
    });
    expect(progress.map((each) => [each.status, each.composed])).toEqual([
      ["done", false],
      ["done", true],
    ]);
  });

  test("writes a christening in its own tones", async () => {
    const setup = await setUp("sample-christening-card");
    const requests = standInModel();
    await expectError(
      setup.couple.mutation(api.simple.compose, {
        designId: setup.designId,
        items: [request("invitation")],
        tone: "romantic",
        language: "ro",
        locale: "ro",
      }),
      "not-found",
    );
    const { items } = await setup.couple.mutation(api.simple.compose, {
      designId: setup.designId,
      items: [request("invitation"), request("menu")],
      tone: "playful",
      language: "en",
      locale: "en",
    });
    await setup.t.finishAllScheduledFunctions(() => {});
    expect(contextOf(requests, "Invitation")).toContain(
      "in the child's own voice",
    );
    const card = await documentOf(setup, setup.designId);
    expect(card.language).toBe("en");
    expect(textsOf(card).join("\n")).toContain("{{child}}");
    const reply = (
      await setup.couple.query(api.ai.messages, {
        designId: items[1]!.designId,
      })
    ).at(-1);
    expect(reply?.text).toContain("menu");
    expect(reply?.text).toContain("Undo");
  });

  test("refuses what the collection or the occasion doesn't offer", async () => {
    const setup = await setUp();
    const compose = (
      items: { kind: "invitation"; request: string }[],
      more: { line?: string } = {},
    ) =>
      setup.couple.mutation(api.simple.compose, {
        designId: setup.designId,
        items,
        language: "ro",
        locale: "ro",
        ...more,
      });
    await expectError(compose([]), "not-found");
    await expectError(
      compose([request("invitation"), request("invitation")]),
      "not-found",
    );
    await expectError(compose([request("seating-chart")]), "not-found");
    await expectError(
      compose([{ kind: "invitation", request: "  " }]),
      "ai-invalid-message",
    );
    await expectError(
      compose([request("invitation")], { line: "a".repeat(301) }),
      "ai-invalid-message",
    );
    // Someone else's design reads as not there.
    const userId = await setup.t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    const other = setup.t.withIdentity({ subject: `${userId}|session` });
    await expectError(
      other.mutation(api.simple.compose, {
        designId: setup.designId,
        items: [request("invitation")],
        language: "ro",
        locale: "ro",
      }),
      "not-found",
    );
    expect(
      await other.query(api.simple.collection, { designId: setup.designId }),
    ).toBeNull();
  });
});
