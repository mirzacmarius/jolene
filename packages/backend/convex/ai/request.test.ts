import { describe, expect, test } from "bun:test";
import type {
  BetaContentBlock,
  BetaMessage,
} from "@anthropic-ai/sdk/resources/beta/messages";
import type { AiConfig } from "./config";
import {
  addUsage,
  buildRequest,
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
  to: { model: "claude-standby" },
  trigger: { type: "refusal" },
} as unknown as BetaContentBlock;

describe("the request", () => {
  test("streams adaptive thinking at xhigh effort, with every tool", () => {
    const request = buildRequest(config, [], { userId: "u1", wrapUp: false });
    expect(request).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "xhigh" },
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
      model: "claude-standby",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 50,
        iterations: [
          attempt("message", "claude-opus-5-5", 1000),
          attempt("fallback_message", "claude-standby", 100),
        ],
      },
    } as unknown as BetaMessage;
    expect(usageOf(served)).toEqual({
      usage: { input: 1100, output: 110, cacheRead: 2200, cacheWrite: 550 },
      contextTokens: 350,
      servedBy: "claude-standby",
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
