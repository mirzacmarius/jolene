import { describe, expect, test } from "bun:test";
import type {
  BetaContentBlock,
  BetaMessage,
} from "@anthropic-ai/sdk/resources/beta/messages";
import type { AiConfig } from "./config";
import {
  addUsage,
  buildRequest,
  droppedThinking,
  echoable,
  INTERRUPTED,
  progressNotes,
  promptVersion,
  replyText,
  toolCalls,
  usageOf,
} from "./request";

const config: AiConfig = {
  model: "claude-opus-5-5",
  effort: "medium",
  standIn: false,
  configured: true,
  dailyLimit: 20,
  totalDailyLimit: 200,
};

const text = (value: string) =>
  ({ type: "text", text: value, citations: null }) as BetaContentBlock;
const thinking = (value: string) =>
  ({ type: "thinking", thinking: value, signature: "s" }) as BetaContentBlock;
const toolUse = (id: string) =>
  ({
    type: "tool_use",
    id,
    name: "apply_operations",
    input: {},
  }) as BetaContentBlock;
const fallback = {
  type: "fallback",
  from: { model: "claude-opus-5-5" },
  to: { model: "standby-model" },
  trigger: { type: "refusal" },
} as unknown as BetaContentBlock;

describe("the request", () => {
  test("streams adaptive thinking at the deployment's effort, with every tool", () => {
    const request = buildRequest(config, [], { userId: "u1", wrapUp: false });
    expect(request).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tool_choice: { type: "auto" },
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      metadata: { user_id: "u1" },
    });
    expect(request.system).toEqual([
      expect.objectContaining({ cache_control: { type: "ephemeral" } }),
    ]);
    expect(request.tools?.map((tool) => "name" in tool && tool.name)).toEqual([
      "apply_operations",
      "set_details",
      "look_at_design",
    ]);
  });

  test("keeps its tools at the round limit, and asks for words only", () => {
    const going = buildRequest(config, [], { userId: "u1", wrapUp: false });
    const last = buildRequest(config, [], { userId: "u1", wrapUp: true });
    expect(last.tool_choice).toEqual({ type: "none" });
    expect(JSON.stringify(last.tools)).toBe(JSON.stringify(going.tools));
    expect(JSON.stringify(last.system)).toBe(JSON.stringify(going.system));
  });

  test("names a thread's prompt by what it is made of", () => {
    expect(promptVersion({ ...config })).toBe(promptVersion(config));
    expect(promptVersion({ ...config, model: "another" })).not.toBe(
      promptVersion(config),
    );
    expect(promptVersion({ ...config, standIn: true })).not.toBe(
      promptVersion(config),
    );
    expect(promptVersion({ ...config, effort: "high" })).not.toBe(
      promptVersion(config),
    );
  });

  test("thinks at the deployment's effort", () => {
    const request = buildRequest({ ...config, effort: "xhigh" }, [], {
      userId: "u1",
      wrapUp: false,
    });
    expect(request.output_config).toEqual({ effort: "xhigh" });
  });

  test("asks Opus and Sonnet for a fallback and progress updates, Haiku for neither", () => {
    for (const model of ["claude-opus-5-5", "claude-sonnet-5-5"]) {
      const request = buildRequest({ ...config, model }, [], {
        userId: "u1",
        wrapUp: false,
      });
      expect(request.fallbacks).toBe("default");
      expect(request.thinking).toMatchObject({ display: "updates" });
    }
    const haiku = buildRequest({ ...config, model: "claude-haiku-5-5" }, [], {
      userId: "u1",
      wrapUp: false,
    });
    expect(haiku).not.toHaveProperty("fallbacks");
    expect(haiku.thinking).toEqual({
      type: "adaptive",
      block_binding: { prefix_mismatch_behavior: "drop_block" },
    });
  });
});

describe("the answer", () => {
  test("goes back verbatim, but after a fallback only from where it served", () => {
    const content = [
      thinking("declined"),
      toolUse("toolu_a"),
      text("Încep"),
      fallback,
      thinking("served"),
      toolUse("toolu_b"),
      text("Gata"),
    ];
    expect(echoable(content)).toEqual([
      text("Încep"),
      fallback,
      thinking("served"),
      toolUse("toolu_b"),
      text("Gata"),
    ]);
    expect(toolCalls(content).map((call) => call.id)).toEqual(["toolu_b"]);
    const plain = [thinking("a"), toolUse("toolu_c"), text("b")];
    expect(echoable(plain)).toEqual(plain);
    expect(toolCalls(plain)).toHaveLength(1);
  });

  test("tells which thinking the API dropped from the thread", () => {
    const answer = (input_transformations?: unknown) =>
      ({ content: [], input_transformations }) as unknown as BetaMessage;
    expect(droppedThinking(answer(undefined))).toEqual([]);
    expect(droppedThinking(answer([]))).toEqual([]);
    expect(
      droppedThinking(
        answer([
          {
            type: "thinking_dropped",
            path: "messages[3].content[0]",
            reason: "prefix_binding_mismatch",
            extra: "not kept",
          },
        ]),
      ),
    ).toEqual([
      {
        type: "thinking_dropped",
        path: "messages[3].content[0]",
        reason: "prefix_binding_mismatch",
      },
    ]);
  });

  test("shows the couple its words and its notes", () => {
    const content = [
      thinking("Aleg culorile."),
      thinking(""),
      thinking(INTERRUPTED),
      text("Am schimbat"),
      text(" paleta. "),
    ];
    expect(replyText(content)).toBe("Am schimbat\n\npaleta.");
    expect(progressNotes(content)).toEqual(["Aleg culorile."]);
  });

  test("costs what every attempt used", () => {
    const attempt = (type: string, model: string, tokens: number) => ({
      type,
      model,
      input_tokens: tokens,
      output_tokens: tokens / 10,
      cache_read_input_tokens: tokens * 2,
      cache_creation_input_tokens: tokens / 2,
      cache_creation: null,
    });
    const served = {
      model: "standby-model",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 50,
        iterations: [
          attempt("message", "claude-opus-5-5", 1000),
          attempt("fallback_message", "standby-model", 100),
        ],
      },
    } as unknown as BetaMessage;
    expect(usageOf(served)).toEqual({
      usage: { input: 1100, output: 110, cacheRead: 2200, cacheWrite: 550 },
      contextTokens: 350,
      servedBy: "standby-model",
    });

    const plain = {
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 40,
        output_tokens: 5,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 60,
        iterations: null,
      },
    } as unknown as BetaMessage;
    expect(usageOf(plain)).toEqual({
      usage: { input: 40, output: 5, cacheRead: 900, cacheWrite: 60 },
      contextTokens: 1000,
    });
    expect(addUsage(undefined, usageOf(plain).usage)).toEqual(
      usageOf(plain).usage,
    );
  });
});
