import type { Occasion } from "@jolene/design";
import { v } from "convex/values";

/**
 * How a collection's wording sounds, chosen in simple mode's questions and
 * kept on the event, so items written later sound the same. The studio words
 * each tone for the couple; the briefs here are what the AI designer reads.
 */

export const tones = [
  "classic",
  "romantic",
  "modern",
  "tender",
  "playful",
] as const;
export type Tone = (typeof tones)[number];

export const toneValidator = v.union(...tones.map((tone) => v.literal(tone)));

/** The longest line of their own a couple can add to their wording. */
export const MAX_LINE_LENGTH = 300;

/** The tones each occasion offers, the one most couples choose first. */
export const occasionTones = {
  wedding: ["classic", "romantic", "modern"],
  christening: ["classic", "tender", "playful"],
} as const satisfies Record<Occasion, readonly Tone[]>;

export function offersTone(occasion: Occasion, tone: Tone): boolean {
  return (occasionTones[occasion] as readonly Tone[]).includes(tone);
}

/** What the tone asks of the words, for the AI designer. */
export function toneBrief(tone: Tone, occasion: Occasion): string {
  switch (tone) {
    case "classic":
      return occasion === "christening"
        ? 'classic and formal, in the traditional order, naming the holy christening ("Taina Sfântului Botez", "the holy christening")'
        : 'classic and formal, in the traditional order, opening with the parents\' blessing ("Cu binecuvântarea părinților", "Together with their parents")';
    case "romantic":
      return "romantic and warm: a lyrical opening about the two of them, the invitation itself kept gentle";
    case "modern":
      return 'modern and short: few, direct words ("Ne căsătorim!", "We\'re getting married!") and only the essential details';
    case "tender":
      return "tender and gentle, about the child as a small miracle and the family's joy";
    case "playful":
      return 'playful and light, often in the child\'s own voice ("Vă aștept la botezul meu!", "Come to my christening!")';
  }
}
