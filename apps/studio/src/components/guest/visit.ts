/**
 * What a tab remembers of a guest's visit, so a reload or the move to a
 * family's own link doesn't start over: that the envelope was opened, and
 * the reply just sent through the open link, to thank them for it there.
 * Without storage, each visit starts over, which is only less smooth.
 */

type Memory = "opened" | "replied";

const key = (memory: Memory, slug: string, code: string | undefined) =>
  `jolene-invitation-${memory}:${slug}/${code ?? ""}`;

export function remember(
  memory: Memory,
  slug: string,
  code: string | undefined,
  value = "1",
) {
  try {
    sessionStorage.setItem(key(memory, slug, code), value);
  } catch {
    // Remembering is a nicety.
  }
}

export function recall(
  memory: Memory,
  slug: string,
  code: string | undefined,
): string | null {
  try {
    return sessionStorage.getItem(key(memory, slug, code));
  } catch {
    return null;
  }
}

export function forget(memory: Memory, slug: string, code: string | undefined) {
  try {
    sessionStorage.removeItem(key(memory, slug, code));
  } catch {
    // Nothing was remembered.
  }
}
