import { fold } from "./text";

/**
 * Words jolene.ro's titles write in capitals, without diacritics or with a
 * typo, as a title writes them past its first word.
 */
const words: Record<string, string> = {
  abum: "album",
  album: "album",
  animalute: "animăluțe",
  asezare: "așezare",
  baiat: "băiat",
  bani: "bani",
  bebelusului: "bebelușului",
  bomboniera: "bombonieră",
  botez: "botez",
  bradut: "brăduț",
  carte: "carte",
  colorati: "colorați",
  craciun: "Crăciun",
  craicun: "Crăciun",
  cu: "cu",
  de: "de",
  dipahane: "Diaphane",
  eticheta: "etichetă",
  felicitare: "felicitare",
  flori: "flori",
  foto: "foto",
  greenary: "Greenery",
  guestbook: "guestbook",
  iepuras: "iepuraș",
  in: "în",
  inimioara: "inimioară",
  intampinare: "întâmpinare",
  inivtatie: "invitație",
  invitati: "invitați",
  invitatie: "invitație",
  lebada: "lebădă",
  lumanare: "lumânare",
  marturie: "mărturie",
  marturii: "mărturii",
  masa: "masă",
  meniu: "meniu",
  mos: "Moș",
  numar: "număr",
  nuna: "nuntă",
  nunta: "nuntă",
  panglica: "panglică",
  panou: "panou",
  pexiglass: "plexiglass",
  plic: "plic",
  poza: "poză",
  si: "și",
  tablou: "tablou",
  toamna: "toamnă",
  ursulet: "ursuleț",
};

/** Capitals that stay capitals. */
const acronyms = new Set(["HP", "RSVP"]);

/** Words that are never a name, so take no capital past a title's first. */
const small = new Set(["cu", "de", "din", "in", "la", "pe", "pentru", "si"]);

/** A word in capitals, allowing one slip: "NUNTă". */
function shouts(word: string): boolean {
  const letters = [...word].filter((char) => /\p{L}/u.test(char));
  const lower = letters.filter((char) => char !== char.toUpperCase()).length;
  return letters.length >= 2 && lower <= (letters.length >= 4 ? 1 : 0);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A product's title without jolene.ro's capitals and with its diacritics:
 * "MĂRTURIE BOTEZ LUMANARE Iepuraș" becomes "Mărturie botez lumânare
 * Iepuraș". Names in capitals keep a capital each ("Deep Forest"); words
 * written in lowercase or as names stay as they are.
 */
export function cleanTitle(title: string): string {
  const parts = title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(plic)\s+(?=bani\b)/iu, "$1 de ")
    .split(" ");
  return parts
    .map((part, index) => {
      const [, before = "", word = "", after = ""] =
        /^(\P{L}*)(\p{L}+)(\P{L}*)$/u.exec(part) ?? [];
      if (!word) return part;
      const known = words[fold(word)];
      let spelled = word;
      if (shouts(word)) {
        if (acronyms.has(word)) spelled = word;
        else if (known) spelled = known;
        else spelled = capitalize(word.toLowerCase());
      } else if (known) {
        // A missing diacritic or a typo: keep the word's own capital.
        spelled = word === capitalize(word) ? capitalize(known) : known;
      }
      if (index === 0) spelled = capitalize(spelled);
      else if (small.has(fold(word))) spelled = spelled.toLowerCase();
      return `${before}${spelled}${after}`;
    })
    .join(" ");
}
