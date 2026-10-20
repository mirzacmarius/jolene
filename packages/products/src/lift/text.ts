/** Text without diacritics, asterisks, case or extra spaces, to compare spellings. */
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replaceAll("*", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A handle made of lowercase letters, digits and hyphens. */
export function slug(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  bdquo: "„",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
};

/** Turns HTML's character references into the characters they stand for. */
export function decodeEntities(html: string): string {
  return html.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (reference, body: string) => {
      if (!body.startsWith("#")) return namedEntities[body] ?? reference;
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return String.fromCodePoint(code);
    },
  );
}

/** The words of an HTML fragment, a space between blocks. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
