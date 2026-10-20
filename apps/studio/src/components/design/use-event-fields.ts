"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Fields, Occasion } from "@jolene/design";
import { useConvexAuth, useQuery } from "convex/react";
import { useMemo } from "react";

/**
 * The details the visitor has given for their wedding and their christening,
 * by occasion: every collection previews with them, since a design started
 * from any of them belongs to the same event. None until they've given some.
 */
export function useEventFields(): Partial<Record<Occasion, Fields>> {
  const { isLoading } = useConvexAuth();
  const latest = useQuery(api.events.latestFields, isLoading ? "skip" : {});
  return useMemo(
    () =>
      Object.fromEntries(
        (latest ?? []).map(({ occasion, fields }) => [occasion, fields]),
      ),
    [latest],
  );
}
