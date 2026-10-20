"use client";

import { useSyncExternalStore } from "react";

/**
 * How the workspace shows a design: lifelike, as a photograph of the printed
 * item on a table, or flat, exactly as it prints.
 */
export type PreviewMode = "lifelike" | "flat";

/** Where the browser keeps the last choice. */
const STORAGE_KEY = "jolene.preview";

let chosen: PreviewMode | undefined;
const listeners = new Set<() => void>();

/**
 * The mode last chosen in this browser. Storage can be blocked or full, so
 * every read and write may fail: the preview is lifelike until chosen
 * otherwise, and a choice it can't store lasts until the page closes.
 */
function current(): PreviewMode {
  if (chosen) return chosen;
  try {
    chosen =
      window.localStorage.getItem(STORAGE_KEY) === "flat" ? "flat" : "lifelike";
  } catch {
    chosen = "lifelike";
  }
  return chosen;
}

function choose(mode: PreviewMode) {
  chosen = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Remembered for this visit only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The preview's mode and a way to change it, shared by every preview on the
 * page and remembered in this browser. Lifelike on the server and while the
 * page hydrates.
 */
export function usePreviewMode() {
  const mode = useSyncExternalStore(
    subscribe,
    current,
    (): PreviewMode => "lifelike",
  );
  return [mode, choose] as const;
}
