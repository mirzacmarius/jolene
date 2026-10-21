import {
  type Fields,
  formatDate,
  type Language,
  type Occasion,
} from "@jolene/design";
import { escapeHtml } from "../emails";

/**
 * Words of the digital invitation that Convex writes itself, in Romanian and
 * English: the names guests see it from and its email. Romanian addresses
 * guests in the polite plural, as invitations do.
 */

/**
 * Who the invitation is from: the couple's first names on a wedding's, the
 * parents (or the child) on a christening's.
 */
export function hostNames(
  occasion: Occasion,
  fields: Fields,
  language: Language,
): string {
  if (occasion === "christening")
    return fields.parents?.trim() || fields.child?.trim() || "";
  const names = [fields.partner1, fields.partner2]
    .map((name) => name?.trim())
    .filter(Boolean);
  return names.join(language === "ro" ? " și " : " and ");
}

const words = {
  ro: {
    subject: {
      wedding: (names: string) =>
        names ? `Invitație la nuntă · ${names}` : "Invitație la nuntă",
      christening: (child: string) =>
        child ? `Invitație la botez · ${child}` : "Invitație la botez",
    },
    from: (names: string) =>
      names
        ? `Ați primit o invitație de la ${names}.`
        : "Ați primit o invitație.",
    open: "Deschideți invitația pentru program și ca să confirmați dacă veniți.",
    replyBy: (date: string) => `Vă rugăm să confirmați până ${date}.`,
    button: "Deschideți invitația",
    footer: (names: string) =>
      `Ați primit acest email pentru că ${names || "cineva"} v-a trimis o invitație digitală, făcută cu Jolene · jolene.ro`,
  },
  en: {
    subject: {
      wedding: (names: string) =>
        names ? `Wedding invitation · ${names}` : "Wedding invitation",
      christening: (child: string) =>
        child ? `Christening invitation · ${child}` : "Christening invitation",
    },
    from: (names: string) =>
      names
        ? `You've received an invitation from ${names}.`
        : "You've received an invitation.",
    open: "Open it for the programme and to let them know if you're coming.",
    replyBy: (date: string) => `Please reply by ${date}.`,
    button: "Open the invitation",
    footer: (names: string) =>
      `You received this email because ${names || "someone"} sent you a digital invitation, made with Jolene · jolene.ro`,
  },
} as const;

/** "până sâmbătă, 15 mai 2027" reads better with "pe": "până pe 15 mai". */
function replyDate(date: string, language: Language) {
  const long = formatDate(date, "long", language);
  return language === "ro" ? `pe ${long.replace(/^[^,]+, /, "")}` : long;
}

/** A family's email of their invitation, in their language. */
export function invitationEmail({
  occasion,
  fields,
  language,
  household,
  link,
  image,
}: {
  occasion: Occasion;
  fields: Fields;
  language: Language;
  household: string;
  link: string;
  image: string | null;
}) {
  const w = words[language];
  const names = hostNames(occasion, fields, language);
  const subject =
    occasion === "christening"
      ? w.subject.christening(fields.child?.trim() ?? "")
      : w.subject.wedding(names);
  const by = fields.rsvpBy?.trim();
  const lines = [
    `${household},`,
    w.from(names),
    w.open,
    ...(by ? [w.replyBy(replyDate(by, language))] : []),
  ];
  const text = [...lines, "", link, "", w.footer(names)].join("\n");
  const paragraph = (line: string) =>
    `<tr><td style="padding-bottom:12px;font-size:17px;line-height:26px;">${escapeHtml(line)}</td></tr>`;
  const html = `${
    image
      ? `<tr><td style="padding-bottom:24px;"><a href="${escapeHtml(link)}"><img src="${escapeHtml(image)}" width="520" alt="" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>`
      : ""
  }${lines.map(paragraph).join("")}
<tr><td style="padding-top:12px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2b2622;color:#fbf8f3;font-family:Helvetica,Arial,sans-serif;font-size:15px;text-decoration:none;padding:14px 26px;border-radius:999px;">${escapeHtml(w.button)}</a></td></tr>`;
  return { subject, text, html, footer: escapeHtml(w.footer(names)), names };
}
