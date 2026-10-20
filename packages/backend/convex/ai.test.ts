import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessageStreamParams,
  BetaStopReason,
  BetaToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages";
import {
  type DesignDocument,
  eucaliptInvitation,
  eucalyptusArtwork,
} from "@jolene/design";
import { Glob } from "bun";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ModelClient, setTestModelClient } from "./ai/model";
import { play } from "./ai/standIn";
import schema from "./schema";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

const sample = {
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
  templates: [{ slug: "sample-invitation", document: eucaliptInvitation }],
  art: [
    {
      key: eucalyptusArtwork.key,
      path: "/studio/art/sample/eucalyptus.svg",
      contentType: eucalyptusArtwork.contentType,
      recolorable: true,
      name: eucalyptusArtwork.name,
    },
  ],
};

const aiEnv = [
  "ANTHROPIC_API_KEY",
  "AI_MODEL",
  "AI_DAILY_LIMIT",
  "AI_DAILY_LIMIT_TOTAL",
  "AI_STAND_IN",
];

/** The deployment's AI settings for one test; none set means no key. */
function setEnv(values: Record<string, string>) {
  for (const name of aiEnv) Reflect.deleteProperty(process.env, name);
  Object.assign(process.env, values);
}

beforeEach(() => {
  setSystemTime();
  // Not a key: the fake model below answers every request.
  setEnv({ ANTHROPIC_API_KEY: "test-key" });
});

afterEach(() => {
  setTestModelClient(undefined);
  setEnv({});
});

async function setUp() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.save.suite, sample);
  const signIn = async () => {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const couple = await signIn();
  const designId = await couple.mutation(api.designs.start, {
    template: "sample-invitation",
  });
  return { t, couple, designId, signIn };
}

type Setup = Awaited<ReturnType<typeof setUp>>;

/** Sends the couple's words and lets the reply run to its end. */
async function talk({ t, couple, designId }: Setup, text: string) {
  const replyId = await couple.mutation(api.ai.send, {
    designId,
    text,
    locale: "ro",
  });
  await t.finishAllScheduledFunctions(() => {});
  return replyId;
}

const messagesOf = ({ couple, designId }: Setup) =>
  couple.query(api.ai.messages, { designId });

async function replyOf(setup: Setup) {
  const reply = (await messagesOf(setup)).at(-1);
  if (reply?.role !== "designer") throw new Error("No reply");
  return reply;
}

const designOf = async ({ couple, designId }: Setup) => {
  const data = await couple.query(api.designs.get, { designId });
  if (!data) throw new Error("No design");
  return {
    ...data,
    document: data.design.document as DesignDocument,
  };
};

// A model that answers from a script, one handler for each request.

type Handler = ModelClient["stream"];
interface Answer {
  content: BetaContentBlock[];
  stop?: BetaStopReason;
}

const usage = {
  input_tokens: 1000,
  output_tokens: 200,
  cache_read_input_tokens: 500,
  cache_creation_input_tokens: 300,
};

function answer(make: Answer | ((request: BetaMessageStreamParams) => Answer)) {
  const handler: Handler = async (request, onEvent, signal) => {
    const { content, stop = "end_turn" } =
      typeof make === "function" ? make(request) : make;
    const message = await play(content, stop, onEvent, signal, 0);
    return {
      ...message,
      model: "claude-opus-5-5",
      usage: { ...message.usage, ...usage },
    };
  };
  return handler;
}

function fakeModel(...handlers: Handler[]) {
  const requests: BetaMessageStreamParams[] = [];
  setTestModelClient({
    async stream(request, onEvent, signal) {
      requests.push(structuredClone(request));
      const handler = handlers[requests.length - 1];
      if (!handler) throw new Error(`No answer for request ${requests.length}`);
      return await handler(request, onEvent, signal);
    },
  });
  return requests;
}

const text = (value: string): BetaContentBlock => ({
  type: "text",
  text: value,
  citations: null,
});

const note = (value: string): BetaContentBlock => ({
  type: "thinking",
  thinking: value,
  signature: "signature",
});

let calls = 0;
const call = (name: string, input: unknown): BetaContentBlock => ({
  type: "tool_use",
  id: `toolu_${++calls}`,
  name,
  input,
});

/** The tool results the request's last message carries. */
function resultsIn(request: BetaMessageStreamParams | undefined) {
  const last = request?.messages.at(-1);
  if (!last || typeof last.content === "string") return [];
  return last.content.filter(
    (block): block is BetaToolResultBlockParam => block.type === "tool_result",
  );
}

/** A result's content as JSON, when it is JSON. */
function parsed(
  result: BetaToolResultBlockParam | undefined,
): Record<string, unknown> {
  const content = result?.content;
  if (typeof content === "string") return JSON.parse(content);
  const first = content?.[0];
  return first?.type === "text" ? JSON.parse(first.text) : {};
}

/** The text blocks of the couple's latest message, context included. */
function wordsOf(request: BetaMessageStreamParams | undefined): string {
  const first = request?.messages.findLast(
    (message) =>
      message.role === "user" &&
      typeof message.content !== "string" &&
      message.content.some(
        (block) => block.type === "text" && block.text.startsWith("<context>"),
      ),
  );
  if (!first || typeof first.content === "string") return "";
  return first.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
}

const softerGreens = (revision: number) =>
  call("apply_operations", {
    revision,
    operations: [{ op: "setPalette", palette: { accent: "#4f6b5d" } }],
    note: "Verde mai blând",
  });

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

async function until(check: () => Promise<boolean>) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out");
}

describe("the AI designer", () => {
  test("changes the design by operations, as a version of its own", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({
        content: [note("Înmoi verdele accentului."), softerGreens(1)],
        stop: "tool_use",
      }),
      answer({ content: [text("Am făcut verdele mai blând.")] }),
    );
    await talk(setup, "Verde mai blând, vă rog");

    const { design, document } = await designOf(setup);
    expect(design.revision).toBe(2);
    expect(document.theme.palette.accent).toBe("#4f6b5d");
    const versions = await setup.couple.query(api.designs.versions, {
      designId: setup.designId,
    });
    expect(versions[0]).toMatchObject({
      revision: 2,
      author: "ai",
      note: "Verde mai blând",
    });

    const shown = await messagesOf(setup);
    expect(shown.map((message) => [message.role, message.status])).toEqual([
      ["couple", "done"],
      ["designer", "done"],
    ]);
    expect(shown[1]).toMatchObject({
      text: "Am făcut verdele mai blând.",
      notes: ["Înmoi verdele accentului."],
      changes: [{ kind: "design", revision: 2, note: "Verde mai blând" }],
      canRetry: false,
    });
    const usageKept = await setup.t.run(async (ctx) => {
      const reply = await ctx.db.get(
        "aiMessages",
        shown[1]?._id as Id<"aiMessages">,
      );
      return reply?.usage;
    });
    expect(usageKept).toEqual({
      input: 2000,
      output: 400,
      cacheRead: 1000,
      cacheWrite: 600,
    });

    // The request, as the API reads it.
    const [first, second] = requests;
    expect(first).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      thinking: { type: "adaptive", display: "updates" },
      output_config: { effort: "xhigh" },
      tool_choice: { type: "auto" },
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
    });
    expect(
      first?.tools?.map(
        (tool) => "eager_input_streaming" in tool && tool.eager_input_streaming,
      ),
    ).toEqual([true, true, true]);
    const context = wordsOf(first);
    expect(context).toContain('<design revision="1" language="ro">');
    expect(context).toContain('<studio language="ro"');
    expect(context).toContain("Verde mai blând, vă rog");

    // Each round sends the thread back as it was, thinking included.
    expect(JSON.stringify(second?.system)).toBe(JSON.stringify(first?.system));
    expect(JSON.stringify(second?.tools)).toBe(JSON.stringify(first?.tools));
    expect(second?.messages.slice(0, 1)).toEqual(first?.messages ?? []);
    expect(second?.messages[1]).toEqual({
      role: "assistant",
      content: [
        note("Înmoi verdele accentului."),
        expect.objectContaining({ type: "tool_use", name: "apply_operations" }),
      ],
    });
    const result = resultsIn(second)[0];
    expect(result?.is_error).toBeUndefined();
    expect(parsed(result)).toMatchObject({
      revision: 2,
      measuredWith: "estimate",
    });
  });

  test("goes on in the same thread, told only what changed", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({ content: [softerGreens(1)], stop: "tool_use" }),
      answer({ content: [text("Gata.")] }),
      answer({ content: [text("Cu plăcere.")] }),
    );
    await talk(setup, "Verde mai blând");
    await talk(setup, "Mulțumim!");

    const third = requests[2];
    expect(third?.messages.slice(0, 3)).toEqual(requests[1]?.messages ?? []);
    const context = wordsOf(third);
    expect(context).toContain('<design revision="2" unchanged="true">');
    expect(context).toContain('<details unchanged="true">');
  });

  test("is told the design changed since, and tries again on the current revision", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      async (request, onEvent, signal) => {
        // The couple changes the design while the AI designer works on it.
        await setup.couple.mutation(api.designs.apply, {
          designId: setup.designId,
          operations: [{ op: "setPalette", palette: { muted: "#777777" } }],
        });
        return await answer({ content: [softerGreens(1)], stop: "tool_use" })(
          request,
          onEvent,
          signal,
        );
      },
      answer((request) => ({
        content: [softerGreens(Number(parsed(resultsIn(request)[0]).revision))],
        stop: "tool_use",
      })),
      answer({ content: [text("Gata.")] }),
    );
    await talk(setup, "Verde mai blând");

    const stale = resultsIn(requests[1])[0];
    expect(stale?.is_error).toBe(true);
    expect(parsed(stale)).toMatchObject({ error: "stale", revision: 2 });
    expect(parsed(stale).design).toHaveProperty("pieces");
    const { design, document } = await designOf(setup);
    expect(design.revision).toBe(3);
    expect(document.theme.palette).toMatchObject({
      accent: "#4f6b5d",
      muted: "#777777",
    });
    expect((await replyOf(setup)).changes).toEqual([
      { kind: "design", revision: 3, note: "Verde mai blând" },
    ]);
  });

  test("gets invalid operations back as errors, and nothing changes", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({
        content: [
          call("apply_operations", {
            revision: 1,
            operations: [{ op: "setPalette", palette: { accent: "green" } }],
            note: "Verde",
          }),
          call("apply_operations", {
            revision: 1,
            operations: [
              {
                op: "removeLayer",
                piece: "card",
                face: "front",
                layer: "nope",
              },
            ],
            note: "Fără strat",
          }),
          call("make_coffee", {}),
        ],
        stop: "tool_use",
      }),
      answer({ content: [text("Nu am putut face schimbarea.")] }),
    );
    await talk(setup, "Verde");

    const [unreadable, refused, unknown] = resultsIn(requests[1]);
    expect(unreadable?.is_error).toBe(true);
    expect(parsed(unreadable)).toHaveProperty("INVALID_JSON");
    expect(parsed(unreadable)).toHaveProperty("problems");
    expect(refused?.is_error).toBe(true);
    expect(parsed(refused)).toMatchObject({ error: "invalid", revision: 1 });
    expect(unknown?.is_error).toBe(true);
    expect((await designOf(setup)).design.revision).toBe(1);
    expect((await replyOf(setup)).changes).toEqual([]);
  });

  test("wraps up cleanly after its last round", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      ...Array.from({ length: 12 }, () =>
        answer({ content: [call("make_coffee", {})], stop: "tool_use" }),
      ),
      answer({ content: [text("Atât am putut face acum.")] }),
    );
    await talk(setup, "Încercați tot");
    expect(requests).toHaveLength(13);
    expect(requests[11]?.tool_choice).toEqual({ type: "auto" });
    expect(requests[12]?.tool_choice).toEqual({ type: "none" });
    expect(JSON.stringify(requests[12]?.tools)).toBe(
      JSON.stringify(requests[0]?.tools),
    );
    const last = requests[12]?.messages.at(-1);
    expect(JSON.stringify(last)).toContain(
      "as many requests as one reply allows",
    );
    expect(await replyOf(setup)).toMatchObject({
      status: "done",
      text: "Atât am putut face acum.",
    });
  });

  test("saves the couple's details only as they gave them", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({
        content: [
          call("set_details", {
            fields: { partner1: "Ana", date: "2027-13-40" },
            note: "Numele și data",
          }),
        ],
        stop: "tool_use",
      }),
      answer({
        content: [
          call("set_details", {
            fields: { partner1: "Ana" },
            note: "Numele miresei",
          }),
        ],
        stop: "tool_use",
      }),
      answer({ content: [text("Am trecut numele.")] }),
    );
    await talk(setup, "Mireasa e Ana");

    const refused = resultsIn(requests[1])[0];
    expect(refused?.is_error).toBe(true);
    expect(parsed(refused).problems).toEqual({ date: "date" });
    const { event } = await designOf(setup);
    expect(event.fields).toEqual({ partner1: "Ana" });
    const reply = await replyOf(setup);
    expect(reply.changes).toEqual([
      { kind: "details", previous: { partner1: "" }, note: "Numele miresei" },
    ]);

    await setup.couple.mutation(api.ai.undo, {
      messageId: reply._id,
      change: 0,
    });
    expect((await designOf(setup)).event.fields).toEqual({});
  });

  test("undoes a change by bringing back the version before it", async () => {
    const setup = await setUp();
    const original = (await designOf(setup)).document;
    const requests = fakeModel(
      answer({ content: [softerGreens(1)], stop: "tool_use" }),
      answer({ content: [text("Gata.")] }),
      answer({
        content: [
          call("apply_operations", {
            revision: 2,
            operations: [{ op: "setPalette", palette: { art: "#7d9486" } }],
            note: "Ilustrații mai reci",
          }),
        ],
        stop: "tool_use",
      }),
      answer({ content: [text("Gata.")] }),
      answer({ content: [text("Am înțeles.")] }),
    );
    await talk(setup, "Verde mai blând");
    await talk(setup, "Și ilustrațiile");
    const first = (await messagesOf(setup))[1];
    if (!first) throw new Error("No reply");

    await setup.couple.mutation(api.ai.undo, {
      messageId: first._id,
      change: 0,
    });
    const { design, document } = await designOf(setup);
    expect(design.revision).toBe(4);
    expect(document).toEqual(original);
    const versions = await setup.couple.query(api.designs.versions, {
      designId: setup.designId,
    });
    expect(versions[0]).toMatchObject({ author: "person", restoredFrom: 1 });
    // The later change went with it.
    const shown = await messagesOf(setup);
    expect(
      shown.flatMap((message) =>
        message.changes.map((change) => change.undoneAt !== undefined),
      ),
    ).toEqual([true, true]);

    // A stranger can't undo it, and the next message tells the model.
    await talk(setup, "Așa e bine");
    expect(wordsOf(requests[4])).toContain(
      "The couple undid these changes of yours since your last reply: Verde mai blând; Ilustrații mai reci.",
    );
    const stranger = await setup.signIn();
    await expectError(
      stranger.mutation(api.ai.undo, { messageId: first._id, change: 0 }),
      "not-found",
    );
  });

  test("keeps to the day's limits, the visitor's and everyone's", async () => {
    setEnv({ ANTHROPIC_API_KEY: "test-key", AI_DAILY_LIMIT: "2" });
    const setup = await setUp();
    fakeModel(
      answer({ content: [text("Unu.")] }),
      answer({ content: [text("Doi.")] }),
      answer({ content: [text("Trei.")] }),
    );
    const since = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    await talk(setup, "Unu");
    await talk(setup, "Doi");
    expect(await setup.couple.query(api.ai.availability, { since })).toEqual({
      configured: true,
      limit: 2,
      used: 2,
    });
    await expectError(
      setup.couple.mutation(api.ai.send, {
        designId: setup.designId,
        text: "Trei",
        locale: "ro",
      }),
      "ai-limit",
    );

    // A new day, a new count.
    setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
    await talk(setup, "Trei");
    expect((await replyOf(setup)).text).toBe("Trei.");

    // Everyone's messages together have a limit too.
    setEnv({ ANTHROPIC_API_KEY: "test-key", AI_DAILY_LIMIT_TOTAL: "1" });
    const other = await setup.signIn();
    const otherDesign = await other.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    await expectError(
      other.mutation(api.ai.send, {
        designId: otherDesign,
        text: "Bună",
        locale: "ro",
      }),
      "ai-limit-total",
    );
  });

  test("answers one message of a design at a time", async () => {
    const setup = await setUp();
    fakeModel(answer({ content: [text("Gata.")] }));
    await setup.couple.mutation(api.ai.send, {
      designId: setup.designId,
      text: "Unu",
      locale: "ro",
    });
    await expectError(
      setup.couple.mutation(api.ai.send, {
        designId: setup.designId,
        text: "Doi",
        locale: "ro",
      }),
      "ai-busy",
    );
    await setup.t.finishAllScheduledFunctions(() => {});
    expect((await replyOf(setup)).status).toBe("done");
  });

  test("stops a reply while it is written", async () => {
    const setup = await setUp();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let aborted = false;
    const requests = fakeModel(async (_request, onEvent, signal) => {
      onEvent({
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "", citations: null },
      });
      onEvent({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Încep cu verdele" },
      });
      await gate;
      onEvent({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " și apoi" },
      });
      // The API would go on writing; the stopped reply cuts it off.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 2000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          aborted = true;
          reject(new Error("Aborted"));
        });
      });
      return await play(
        [text("Încep cu verdele și apoi"), softerGreens(1)],
        "tool_use",
        () => {},
        signal,
        0,
      );
    });
    await setup.couple.mutation(api.ai.send, {
      designId: setup.designId,
      text: "Verde mai blând",
      locale: "ro",
    });
    await until(async () => (await replyOf(setup)).text === "Încep cu verdele");

    const reply = await replyOf(setup);
    await setup.couple.mutation(api.ai.stop, { messageId: reply._id });
    release();
    await setup.t.finishAllScheduledFunctions(() => {});

    expect(aborted).toBe(true);
    expect(requests).toHaveLength(1);
    expect(await replyOf(setup)).toMatchObject({
      status: "stopped",
      text: "Încep cu verdele",
      changes: [],
    });
    expect((await designOf(setup)).design.revision).toBe(1);
  });

  test("has a stand-in for local development, set by AI_STAND_IN", async () => {
    setEnv({ AI_STAND_IN: "1" });
    const setup = await setUp();
    expect(
      await setup.couple.query(api.ai.availability, { since: 0 }),
    ).toMatchObject({ configured: true });
    await talk(setup, "Culori mai calde");
    const { design, document } = await designOf(setup);
    expect(design.revision).toBe(2);
    expect(document.theme.palette.accent).toBe("#9a5b3f");
    const reply = await replyOf(setup);
    expect(reply.status).toBe("done");
    expect(reply.notes).toHaveLength(1);
    expect(reply.changes).toEqual([
      { kind: "design", revision: 2, note: "Culori mai calde" },
    ]);
    expect(reply.text).toContain("Anulează");
  });

  test("is not available without a key", async () => {
    setEnv({});
    const setup = await setUp();
    expect(
      await setup.couple.query(api.ai.availability, { since: 0 }),
    ).toMatchObject({ configured: false });
    await expectError(
      setup.couple.mutation(api.ai.send, {
        designId: setup.designId,
        text: "Bună",
        locale: "ro",
      }),
      "ai-unavailable",
    );
    await expectError(
      setup.couple.mutation(api.ai.generateUploadUrl, {}),
      "ai-unavailable",
    );
  });

  test("fails a request the API turns away, and runs it again on retry", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      async () => {
        throw new Anthropic.InternalServerError(
          529,
          {
            type: "error",
            error: { type: "overloaded_error", message: "Overloaded" },
          },
          "Overloaded",
          new Headers(),
        );
      },
      answer({ content: [text("Gata.")] }),
    );
    await talk(setup, "Verde");
    const failed = await replyOf(setup);
    expect(failed).toMatchObject({
      status: "failed",
      error: "busy",
      canRetry: true,
    });

    await setup.couple.mutation(api.ai.retry, { messageId: failed._id });
    await setup.t.finishAllScheduledFunctions(() => {});
    expect(await replyOf(setup)).toMatchObject({
      status: "done",
      text: "Gata.",
    });
    expect(requests[1]?.messages).toEqual(requests[0]?.messages ?? []);
  });

  test("starts a new thread after a refusal, without the declined request", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({ content: [text("Nu pot")], stop: "refusal" }),
      answer({ content: [text("Bună ziua!")] }),
    );
    await talk(setup, "O cerere nepotrivită");
    expect(await replyOf(setup)).toMatchObject({
      status: "failed",
      error: "refused",
      text: "",
      canRetry: false,
    });

    await talk(setup, "Bună ziua");
    expect(requests[1]?.messages).toHaveLength(1);
    expect(wordsOf(requests[1])).not.toContain("O cerere nepotrivită");
  });
});

/** A PNG of one transparent pixel. */
const pixel = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

describe("looking at the design", () => {
  test("waits for the studio's rendering and shows it to the model", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({
        content: [note("Mă uit la design."), call("look_at_design", {})],
        stop: "tool_use",
      }),
      answer({ content: [text("Arată bine.")] }),
    );
    await talk(setup, "Cum arată?");
    const waiting = await replyOf(setup);
    expect(waiting).toMatchObject({
      status: "rendering",
      rendering: { revision: 1 },
    });
    const toolUseId = waiting.rendering?.toolUseId ?? "";

    const snapshot = await setup.t.run((ctx) =>
      ctx.storage.store(new Blob([pixel], { type: "image/png" })),
    );
    const answered = await setup.couple.mutation(api.ai.answerRendering, {
      messageId: waiting._id,
      toolUseId,
      revision: 1,
      view: "card:front",
      snapshot,
      layers: [
        {
          piece: "card",
          face: "front",
          layer: "names",
          size: 20,
          styleSize: 24,
          overflows: false,
          outsideSafeArea: false,
        },
      ],
    });
    expect(answered).toBe(true);
    await setup.t.finishAllScheduledFunctions(() => {});

    const result = resultsIn(requests[1])[0];
    expect(result?.is_error).toBeUndefined();
    expect(parsed(result)).toMatchObject({
      revision: 1,
      showing: "the front of the piece 'card'",
      measuredWith: "fonts",
      textFit: [{ layer: "names", size: 20 }],
    });
    expect(Array.isArray(result?.content) && result.content[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png" },
    });
    expect(await replyOf(setup)).toMatchObject({
      status: "done",
      text: "Arată bine.",
    });

    // The reply no longer waits, so a late answer is turned down.
    expect(
      await setup.couple.mutation(api.ai.answerRendering, {
        messageId: waiting._id,
        toolUseId,
        revision: 1,
        view: "assembly",
      }),
    ).toBe(false);
  });

  test("goes on without it when no studio answers", async () => {
    const setup = await setUp();
    const requests = fakeModel(
      answer({ content: [call("look_at_design", {})], stop: "tool_use" }),
      answer({
        content: [text("Nu am putut vedea designul, dar am terminat.")],
      }),
    );
    await talk(setup, "Cum arată?");
    const waiting = await replyOf(setup);
    expect(waiting.status).toBe("rendering");
    const timeout = await setup.t.run((ctx) =>
      ctx.db.system
        .query("_scheduled_functions")
        .filter((q) => q.eq(q.field("name"), "ai/run:renderingTimedOut"))
        .first(),
    );
    expect(timeout?.state.kind).toBe("pending");
    expect((timeout?.scheduledTime ?? 0) - Date.now()).toBeGreaterThan(15_000);

    // What the scheduler runs twenty seconds on.
    await setup.t.mutation(internal.ai.run.renderingTimedOut, {
      messageId: waiting._id,
      toolUseId: waiting.rendering?.toolUseId ?? "",
    });
    await setup.t.finishAllScheduledFunctions(() => {});
    const result = resultsIn(requests[1])[0];
    expect(result?.is_error).toBe(true);
    expect(result?.content).toContain("No studio answered");
    expect((await replyOf(setup)).status).toBe("done");
  });
});
