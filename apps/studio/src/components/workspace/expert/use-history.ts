"use client";

import {
  applyOperations,
  type DesignDocument,
  invertOperations,
  type Operation,
  touchedState,
} from "@jolene/design";
import { toast } from "@jolene/ui/toaster";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/locales/client";
import { isModifier, isShortcut } from "./keyboard";

/** A change made in this tab, with what undoes it. */
interface Step {
  forward: Operation[];
  inverse: Operation[];
  /** Everything either touches, to tell whether the design moved on since. */
  scope: Operation[];
  /** touchedState over `scope` as the step last left the design. */
  state: string;
}

/** Steps kept to go back through, oldest dropped first. */
const LIMIT = 200;

export interface History {
  /** Changes the design and remembers how to undo it. */
  apply: (operations: Operation[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo and redo for what the visitor changes in this tab: every batch
 * `apply` sends is remembered with its inverse. The AI designer's changes
 * reach the design from the backend, with their own undo, and stay out of
 * it; when one of them (or another tab) has changed what a step touches, the
 * step no longer undoes cleanly, so the history is dropped with a word
 * rather than undoing something else.
 *
 * Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z or Ctrl+Y redoes, in both modes,
 * unless the visitor is typing.
 */
export function useHistory(
  document: DesignDocument,
  send: (operations: Operation[]) => void,
): History {
  const t = useI18n();
  // The design as the backend last gave it, or as this tab's latest change
  // left it, whichever is newer: changes in quick succession build on each
  // other before the cached design catches up.
  const latest = useRef(document);
  useLayoutEffect(() => {
    latest.current = document;
  }, [document]);

  const stacks = useRef<{ undo: Step[]; redo: Step[] }>({ undo: [], redo: [] });
  const [sizes, setSizes] = useState({ undo: 0, redo: 0 });
  const recount = useCallback(
    () =>
      setSizes({
        undo: stacks.current.undo.length,
        redo: stacks.current.redo.length,
      }),
    [],
  );

  const apply = useCallback(
    (operations: Operation[]) => {
      if (operations.length === 0) return;
      const base = latest.current;
      let inverse: Operation[];
      try {
        inverse = invertOperations(base, operations);
      } catch {
        // The backend says why it doesn't apply, or the change can't be
        // undone: it goes through, unremembered.
        send(operations);
        return;
      }
      const result = applyOperations(base, operations);
      if (!result.ok) {
        send(operations);
        return;
      }
      const scope = [...operations, ...inverse];
      const state = touchedState(result.document, scope);
      // A change that changes nothing isn't worth a step, nor a save.
      if (state === touchedState(base, scope)) return;
      const { undo } = stacks.current;
      undo.push({ forward: operations, inverse, scope, state });
      if (undo.length > LIMIT) undo.shift();
      stacks.current.redo = [];
      latest.current = result.document;
      send(operations);
      recount();
    },
    [send, recount],
  );

  /** Takes a step back (from undo to redo) or forward again. */
  const travel = useCallback(
    (from: "undo" | "redo") => {
      const step = stacks.current[from].at(-1);
      if (!step) return;
      const current = latest.current;
      const operations = from === "undo" ? step.inverse : step.forward;
      const result =
        touchedState(current, step.scope) === step.state
          ? applyOperations(current, operations)
          : null;
      if (!result?.ok) {
        stacks.current = { undo: [], redo: [] };
        recount();
        toast(t("expert.history.changed"));
        return;
      }
      stacks.current[from].pop();
      stacks.current[from === "undo" ? "redo" : "undo"].push({
        ...step,
        state: touchedState(result.document, step.scope),
      });
      latest.current = result.document;
      send(operations);
      recount();
    },
    [send, recount, t],
  );
  const undo = useCallback(() => travel("undo"), [travel]);
  const redo = useCallback(() => travel("redo"), [travel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event) || !isModifier(event) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return useMemo(
    () => ({
      apply,
      undo,
      redo,
      canUndo: sizes.undo > 0,
      canRedo: sizes.redo > 0,
    }),
    [apply, undo, redo, sizes],
  );
}
