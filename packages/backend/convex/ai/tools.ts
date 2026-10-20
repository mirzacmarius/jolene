import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages";
import { operationSchema } from "@jolene/design";
import { z } from "zod";

/**
 * The tools the AI designer works with. Their inputs stream as the model
 * writes them (eager_input_streaming), so the API doesn't check them: each
 * input is checked against its schema here before it runs.
 */

export const applyOperationsInput = z.object({
  revision: z
    .number()
    .int()
    .positive()
    .describe("The design's revision these operations are based on."),
  operations: z
    .array(operationSchema)
    .min(1)
    .max(80)
    .describe("Applied in order, all or none."),
  note: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .describe(
      "What the change does, in a few words in the studio's language, for the couple's list of changes: 'Softer greens', 'Date under the names'.",
    ),
});

export const setDetailsInput = z.object({
  fields: z
    .record(z.string(), z.string().max(1200))
    .describe(
      'Details by key, such as {"partner1": "Ana", "date": "2027-06-12"}. Dates are YYYY-MM-DD and times HH:MM; an empty string clears a detail.',
    ),
  note: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .describe("What changed, in a few words in the studio's language."),
});

export const lookAtDesignInput = z.object({
  view: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'What to see: "assembly" for the whole item as it arrives, or one face as "piece:face", such as "card:back". Left out, the view the couple is looking at.',
    ),
});

export const toolNames = {
  applyOperations: "apply_operations",
  setDetails: "set_details",
  lookAtDesign: "look_at_design",
} as const;

/** A tool's input as a JSON Schema the API reads, from its zod schema. */
function inputSchema(schema: z.ZodType): BetaTool["input_schema"] {
  const { $schema: _, ...json } = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  });
  return json as BetaTool["input_schema"];
}

/**
 * Declared in full from a thread's first request and never changed within
 * it, so the API caches them with the system prompt.
 */
export const tools: BetaTool[] = [
  {
    name: toolNames.applyOperations,
    description:
      "Changes the design by operations, the way the editor does, all or nothing. Call it whenever the couple asks for a change to the design: colours, type, wording, layout, paper, finishes. Each call becomes one version of the design that the couple can undo, so group the operations of one change into one call. Returns the new revision and the text layers that overflow their frame or shrink to fit, or, when nothing was applied, why.",
    input_schema: inputSchema(applyOperationsInput),
    eager_input_streaming: true,
  },
  {
    name: toolNames.setDetails,
    description:
      "Saves the couple's details (names, date, venues, parents, godparents, RSVP) on their event, which every design of the event shows through its {{tokens}}. Call it only with details the couple stated themselves, exactly as they gave them; never invent one.",
    input_schema: inputSchema(setDetailsInput),
    eager_input_streaming: true,
  },
  {
    name: toolNames.lookAtDesign,
    description:
      "Shows you the design as the couple's studio draws it now, with each text layer measured in the real fonts: the view the couple is looking at, or the one you name, such as the face your change is on. Call it after a change whose result depends on how it looks, or when the couple asks how it looks; one view at a time. It waits for the studio for up to 20 seconds; when no studio answers, carry on without it.",
    input_schema: inputSchema(lookAtDesignInput),
    eager_input_streaming: true,
  },
];
