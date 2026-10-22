"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { withPick } from "@jolene/backend/convex/designs/finishes";
import {
  applyOperations,
  type DesignDocument,
  fieldProblem,
  type Occasion,
  type Operation,
} from "@jolene/design";
import { toast } from "@jolene/ui/toaster";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

/** How many changes are on their way to the backend, to show "Saving…". */
export function useSaving() {
  const [pending, setPending] = useState(0);
  const track = useCallback(<T>(promise: Promise<T>) => {
    setPending((count) => count + 1);
    return promise.finally(() => setPending((count) => count - 1));
  }, []);
  return { saving: pending > 0, track };
}

export type Track = ReturnType<typeof useSaving>["track"];

/**
 * Changes the design by operations. The change shows at once: the same
 * operations run here on the cached design while the backend applies them.
 */
export function useApply(designId: Id<"designs">, track: Track) {
  const t = useI18n();
  const apply = useMutation(api.designs.apply).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.designs.get, { designId });
      if (!current) return;
      const result = applyOperations(
        current.design.document as DesignDocument,
        args.operations as Operation[],
      );
      if (!result.ok) return;
      store.setQuery(
        api.designs.get,
        { designId },
        {
          ...current,
          design: {
            ...current.design,
            document: result.document,
            revision: current.design.revision + 1,
          },
        },
      );
    },
  );
  return useCallback(
    (operations: Operation[]) =>
      track(apply({ designId, operations })).then(
        (result) => {
          if (!result.ok) toast.error(t("design.invalid"));
        },
        () => toast.error(t("common.error")),
      ),
    [apply, designId, track, t],
  );
}

/** One of the couple's picks to order the design: how many, a paper, a choice. */
export type FinishesPick = Parameters<typeof withPick>[1];

/**
 * Keeps the couple's picks to order the design. Each shows at once: the
 * cached design takes it while the backend keeps it.
 */
export function useSetFinishes(designId: Id<"designs">, track: Track) {
  const t = useI18n();
  const setFinishes = useMutation(api.designs.setFinishes).withOptimisticUpdate(
    (store, { designId: _, ...pick }) => {
      const current = store.getQuery(api.designs.get, { designId });
      if (!current) return;
      store.setQuery(
        api.designs.get,
        { designId },
        {
          ...current,
          design: {
            ...current.design,
            finishes: withPick(current.design.finishes, pick),
          },
        },
      );
    },
  );
  return useCallback(
    (pick: FinishesPick) =>
      track(setFinishes({ designId, ...pick })).catch(() =>
        toast.error(t("common.error")),
      ),
    [setFinishes, designId, track, t],
  );
}

/** How long typing pauses before the details are saved. */
const SAVE_DELAY_MS = 400;

/**
 * The couple's details as they type them. Inputs and the preview follow every
 * keystroke; the backend gets them in batches once typing pauses, and on
 * leaving the page.
 */
export function useFieldDrafts({
  eventId,
  occasion,
  saved,
  track,
}: {
  eventId: Id<"events">;
  occasion: Occasion;
  saved: Record<string, string>;
  track: Track;
}) {
  const t = useI18n();
  const setFields = useMutation(api.events.setFields);
  const [values, setValues] = useState(saved);
  const unsent = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Details saved elsewhere (by the AI designer, or in another tab) show
  // here too, except the ones typed here and not sent yet.
  const known = useRef(saved);
  useEffect(() => {
    const before = known.current;
    known.current = saved;
    const changed = Object.keys({ ...before, ...saved }).filter(
      (key) =>
        (before[key] ?? "") !== (saved[key] ?? "") && !(key in unsent.current),
    );
    if (changed.length > 0)
      setValues((current) => ({
        ...current,
        ...Object.fromEntries(changed.map((key) => [key, saved[key] ?? ""])),
      }));
  }, [saved]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const batch = Object.fromEntries(
      Object.entries(unsent.current).filter(
        ([key, value]) => !fieldProblem(occasion, key, value),
      ),
    );
    unsent.current = {};
    if (Object.keys(batch).length === 0) return;
    track(setFields({ eventId, fields: batch })).catch(() =>
      toast.error(t("common.error")),
    );
  }, [eventId, occasion, setFields, track, t]);

  // The latest flush, for the timer and the page-leaving listener.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  const update = useCallback((key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    unsent.current[key] = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    const onLeave = () => flushRef.current();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, []);

  return { values, update };
}
