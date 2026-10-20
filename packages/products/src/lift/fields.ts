import { fold, slug } from "./text";

/**
 * An option jolene.ro's products ask, known by the first words of its
 * label: its plugin spells each one several ways ("Panglica *", "panglica *",
 * "Panglică") and adds a hint after some.
 */
type Field = {
  /** What couples read. */
  label: string;
  /** The first words of the labels that ask it, folded. */
  starts: string[];
  /**
   * Part of what the product is made of, such as its paper: one of
   * Shopify's options, with a variant for each value.
   */
  variant?: true;
};

const known: Field[] = [
  { label: "Text personalizat", starts: ["text personalizat"] },
  // A glass bauble's "Text personalizat" asks yes or no.
  {
    label: "Nume pe verso",
    starts: ["text personalizat numele va fi pus pe verso."],
  },
  { label: "Carton", starts: ["carton"], variant: true },
  { label: "Culoare sigiliu", starts: ["culoare sigiliu"] },
  { label: "Margini invitație", starts: ["margini invitatie"] },
  { label: "Dantelă invitație", starts: ["dantela invitatie"] },
  { label: "Culoare plic", starts: ["culoare plic"] },
  { label: "Culoare panglică", starts: ["culoare panglica"] },
  { label: "Panglică", starts: ["panglica"] },
  { label: "Flori criogenate", starts: ["flori criogenate", "flori"] },
  { label: "Print interior plic", starts: ["print interior plic"] },
  { label: "Șnur", starts: ["snur"] },
  { label: "Etichetă cu nume", starts: ["eticheta cu nume"] },
  { label: "Personalizat", starts: ["personalizat"] },
  {
    label: "Auriu aplicat",
    starts: ["auriu aplicat pe invitatie", "auriu aplicat"],
  },
  { label: "Auriu pe clapetă", starts: ["auriu pe clapeta"] },
  {
    label: "Elemente sigiliu",
    starts: ["elemente sigiliu", "elemente sigliu"],
  },
  { label: "Număr de masă", starts: ["cu numar masa"] },
  { label: "Parfum", starts: ["parfum"] },
  { label: "Sigiliu", starts: ["sigiliu"] },
  { label: "Inserții aurii", starts: ["insertii aurii"] },
  { label: "Colțuri", starts: ["colturi"] },
  { label: "Culoare text", starts: ["culoare text"] },
  { label: "Dimensiune glob", starts: ["dimensiune glob"], variant: true },
  { label: "Culoare ursuleț", starts: ["culoare ursulet"], variant: true },
  { label: "Culoare mărturie", starts: ["culoare marturie"], variant: true },
  { label: "Culoare copertă", starts: ["culoare coperta"], variant: true },
  { label: "Culoare", starts: ["culoare"], variant: true },
  { label: "Împachetare cadou", starts: ["impachetare individuala cadou"] },
  { label: "Cutie acetofan", starts: ["cutie acetofan"] },
  { label: "Linguriță lemn", starts: ["lingurita lemn"] },
  { label: "Ciucure", starts: ["ciucure"] },
  { label: "Mențiuni", starts: ["mentiuni"] },
  { label: "Poză glob", starts: ["poza glob"] },
];

const starts = known
  .flatMap((field) => field.starts.map((start) => ({ start, field })))
  .sort((a, b) => b.start.length - a.start.length);

/** A field of jolene.ro's options plugin, read. */
export type ReadField = {
  /** The same for every field that asks the same, such as "culoare-sigiliu". */
  key: string;
  label: string;
  hint?: string;
  required: boolean;
  variant: boolean;
};

/**
 * Reads a field's label, or its name when it has none, such as
 * "Text personalizat * Textul ce va apărea pe plic.": an asterisk makes it
 * required, and the words after the known ones are its hint.
 */
export function readField(label: string | null, name: string): ReadField {
  const text = label ?? name.replaceAll("_", " ");
  const folded = fold(text);
  const match = starts.find(
    ({ start }) => folded === start || folded.startsWith(`${start} `),
  );
  if (!match) throw new Error(`jolene.ro asks an unknown option: "${text}"`);
  const words = text.replaceAll("*", " ").trim().split(/\s+/);
  const rest = words.slice(match.start.split(" ").length).join(" ");
  const hint = spellings[rest] ?? rest;
  return {
    key: slug(match.field.label),
    label: match.field.label,
    ...(hint ? { hint } : {}),
    required: text.includes("*"),
    variant: match.field.variant ?? false,
  };
}

/**
 * Choices and hints jolene.ro spells without diacritics or by mistake, as
 * the shop spells them.
 */
const spellings: Record<string, string> = {
  "Albastru inchis": "Albastru închis",
  "Auriu pe invitatie partea de jos": "Auriu pe invitație, partea de jos",
  Cappucino: "Cappuccino",
  "Cu numar masa": "Cu număr de masă",
  Fara: "Fără",
  "Fara cutie": "Fără cutie",
  "Fara parfum": "Fără parfum",
  "Fara sigiliu": "Fără sigiliu",
  "Flori naturate mici": "Flori naturale mici",
  "Parfum Floral": "Parfum floral",
  "Pentru o calitate mai buna a pozelor, acestea trebuie trimise pe email.":
    "Pentru o calitate mai bună a pozelor, acestea trebuie trimise pe email.",
  "Pictat cu rosu": "Pictat cu roșu",
  "Prin interior plic": "Cu print interior",
  Rosu: "Roșu",
  "Sigiliu blu": "Sigiliu blue",
  drepte: "Drepte",
  rotunjite: "Rotunjite",
};

/** The same, for one option's choices. */
const spellingsOf: Record<string, Record<string, string>> = {
  // An envelope's colour offered "no ribbon" for "no envelope".
  "culoare-plic": { "Fără panglică": "Fără plic" },
};

/** A choice of the option with `key`, spelled as the shop shows it. */
export function spellChoice(key: string, label: string): string {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return spellingsOf[key]?.[trimmed] ?? spellings[trimmed] ?? trimmed;
}
