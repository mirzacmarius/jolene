import type { Fields, Occasion } from "@jolene/design";
import { env } from "../_generated/server";

/**
 * Letters and digits no one mistakes for another when reading a link aloud
 * or typing it from paper: no 0 or o, 1, i or l.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A random code of `length` letters and digits from the alphabet above. */
export function randomCode(length: number): string {
  // The largest multiple of the alphabet's length under 256, so every
  // letter is as likely as any other.
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && code.length < length)
        code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

/**
 * A family's code: 31 to the 8th, about 850 billion, so trying links at
 * random finds no one's.
 */
export const householdCode = () => randomCode(8);

/** The code of the link a partner joins an event by. */
export const partnerCode = () => randomCode(12);

/** The longest and shortest address a digital invitation can have. */
export const SLUG_LENGTH = { min: 3, max: 48 };

/**
 * Words an invitation's address can't be, as the paths beside invitations
 * on their own domain: the studio's files and pages.
 */
const RESERVED = new Set(["api", "studio", "invitatie", "invitatii", "www"]);

/** Lower-case words of letters and digits joined by hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Whether a digital invitation can have this address. */
export function isSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_LENGTH.min &&
    slug.length <= SLUG_LENGTH.max &&
    SLUG_PATTERN.test(slug) &&
    !RESERVED.has(slug) &&
    // The studio's files under the shop's domain (Vercel Microfrontends).
    !slug.startsWith("vc-ap-")
  );
}

/** "Ștefan Ionuț" → "stefan-ionut": diacritics dropped, words hyphenated. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_LENGTH.max)
    .replace(/-+$/, "");
}

/**
 * The address a couple's invitation starts with, from their names: the
 * first names, "ana-si-mihai", or the child's, "botez-sofia". The couple
 * can change it.
 */
export function suggestedSlug(occasion: Occasion, fields: Fields): string {
  const first = (name?: string) => slugify(name?.trim().split(/\s+/)[0] ?? "");
  const slug =
    occasion === "christening"
      ? ["botez", first(fields.child)].filter(Boolean).join("-")
      : [first(fields.partner1), first(fields.partner2)]
          .filter(Boolean)
          .join("-si-");
  return isSlug(slug) ? slug : occasion === "christening" ? "botez" : "nunta";
}

/**
 * Where guests open digital invitations, without a trailing slash: the
 * invitations' own domain once it's set (INVITE_URL), else the studio's
 * /invitatie, which serves them too.
 */
export function inviteBaseUrl(): string | null {
  const configured = env.INVITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const site = env.SITE_URL?.trim();
  if (!site) return null;
  try {
    return `${new URL(site).origin}/invitatie`;
  } catch {
    return null;
  }
}

/** The link a family opens their invitation by. */
export function householdLink(base: string, slug: string, code: string) {
  return `${base}/${slug}/${code}`;
}

/**
 * The calendar day in Romania at a moment, YYYY-MM-DD: reply dates end at
 * midnight there. Romania keeps Eastern European Time, UTC+2, and summer
 * time, UTC+3, from 01:00 UTC on March's last Sunday to 01:00 UTC on
 * October's.
 */
export function romanianDate(time: number): string {
  const year = new Date(time).getUTCFullYear();
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return Date.UTC(year, month, last.getUTCDate() - last.getUTCDay(), 1);
  };
  const summer = time >= lastSunday(2) && time < lastSunday(9);
  const local = new Date(time + (summer ? 3 : 2) * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
