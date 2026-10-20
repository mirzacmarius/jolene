import type { Tone } from "@jolene/backend/convex/simple/tones";
import type { Language, Occasion, ProductKind } from "@jolene/design";
import type { useI18n } from "@/locales/client";

/**
 * The words simple mode sends the AI designer for each item, in the
 * studio's language: what the couple would have asked themselves, so their
 * conversation with it reads as theirs.
 */

type Translate = ReturnType<typeof useI18n>;

const wordingKeys = {
  invitation: "simple.request.wording.invitation",
  "save-the-date": "simple.request.wording.saveTheDate",
  rsvp: "simple.request.wording.rsvp",
  menu: "simple.request.wording.menu",
  "place-card": "simple.request.wording.placeCard",
  "table-number": "simple.request.wording.tableNumber",
  "welcome-sign": "simple.request.wording.welcomeSign",
  "seating-chart": "simple.request.wording.seatingChart",
  "money-envelope": "simple.request.wording.moneyEnvelope",
  "favor-tag": "simple.request.wording.favorTag",
  "thank-you": "simple.request.wording.thankYou",
  "bridal-party": "simple.request.wording.bridalParty",
} as const satisfies Record<ProductKind, string>;

const languageKeys = {
  ro: "simple.request.languages.ro",
  en: "simple.request.languages.en",
} as const satisfies Record<Language, string>;

/** How each tone the occasion offers is asked for. */
const toneKeys = {
  wedding: {
    classic: "simple.request.tones.weddingClassic",
    romantic: "simple.request.tones.weddingRomantic",
    modern: "simple.request.tones.weddingModern",
  },
  christening: {
    classic: "simple.request.tones.christeningClassic",
    tender: "simple.request.tones.christeningTender",
    playful: "simple.request.tones.christeningPlayful",
  },
} as const satisfies Record<Occasion, Partial<Record<Tone, string>>>;

type ToneKey = {
  [O in Occasion]: (typeof toneKeys)[O][keyof (typeof toneKeys)[O]];
}[Occasion];

function toneKey(occasion: Occasion, tone: Tone): ToneKey | undefined {
  const keys: Partial<Record<Tone, ToneKey>> = toneKeys[occasion];
  return keys[tone];
}

/**
 * The request for one item. The item written first carries the tone and the
 * couple's own line; the others ask to follow it. The invitation also says
 * whether the civil ceremony goes on it, as the couple chose.
 */
export function itemRequest(
  t: Translate,
  {
    kind,
    first,
    occasion,
    tone,
    line,
    language,
    civil,
  }: {
    kind: ProductKind;
    first: boolean;
    occasion: Occasion;
    tone: Tone | undefined;
    line: string;
    language: Language;
    /** The couple asked for the civil ceremony on the invitation. */
    civil: boolean;
  },
): string {
  const wording = t(wordingKeys[kind]);
  const languageName = t(languageKeys[language]);
  const sentences: string[] = [];
  if (!first)
    sentences.push(
      t("simple.request.follow", { wording, language: languageName }),
    );
  else {
    const asked = tone && toneKey(occasion, tone);
    sentences.push(
      asked
        ? t("simple.request.lead", {
            wording,
            tone: t(asked),
            language: languageName,
          })
        : t("simple.request.leadPlain", { wording, language: languageName }),
    );
  }
  if (kind === "invitation" && occasion === "wedding" && civil)
    sentences.push(t("simple.request.civil"));
  const own = line.trim();
  if (first && own)
    sentences.push(
      // A line that ends a sentence of its own takes no second stop.
      /[.!?…]$/.test(own)
        ? t("simple.request.lineEnded", { line: own })
        : t("simple.request.line", { line: own }),
    );
  return sentences.join(" ");
}
