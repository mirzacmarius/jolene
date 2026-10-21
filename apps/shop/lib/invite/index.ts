import { formatDate } from "@jolene/design";

import type { InviteEvent } from "./types";

export function describeEvent(event: Pick<InviteEvent, "date" | "hosts">): string {
  return [event.hosts.ro, event.date ? formatDate(event.date, "long", "ro") : null]
    .filter(Boolean)
    .join(" · ");
}
