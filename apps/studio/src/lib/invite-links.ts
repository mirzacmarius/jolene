/**
 * The links a couple sends their digital invitation by: a family's own, and
 * the taps that open WhatsApp or the phone's messages with it written in.
 * The couple sends from their own phone, so guests see a message from them.
 */

/** A family's link: the invitation's address and their code. */
export function householdLink(base: string, slug: string, code: string) {
  return `${base}/${slug}/${code}`;
}

/** The invitation's own address, its open link. */
export function inviteLink(base: string, slug: string) {
  return `${base}/${slug}`;
}

/**
 * A phone number as WhatsApp's links take it: digits only, with the
 * country's code. Romanian numbers written the local way, 07xx xxx xxx,
 * get Romania's, 40; 00 becomes the + it stands for. Null when it isn't a
 * number.
 */
export function internationalNumber(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) digits = `40${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/** Opens WhatsApp with the message to the number, or to anyone without one. */
export function whatsappLink(message: string, phone?: string) {
  const number = phone ? internationalNumber(phone) : null;
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens the phone's messages with the message to the number. iPhones and
 * Android read the body after "&" and "?" alike when it follows a number.
 */
export function smsLink(message: string, phone?: string) {
  const number = phone?.replace(/[^\d+]/g, "") ?? "";
  return `sms:${number}?&body=${encodeURIComponent(message)}`;
}

/** Fills {name}-style placeholders in a message. */
export function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? (values[key] as string) : match,
  );
}
