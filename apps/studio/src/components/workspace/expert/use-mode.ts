"use client";

import { useSyncExternalStore } from "react";

export type DesignMode = "simple" | "expert";

const STORAGE_KEY = "jolene.studio.designMode";
/** Tailwind's lg breakpoint: expert mode needs the room. */
const LARGE_SCREEN = "(min-width: 1024px)";

/** The choice for this visit, when the browser keeps no storage. */
let remembered: DesignMode = "simple";
const listeners = new Set<() => void>();

function storedMode(): DesignMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "simple" || stored === "expert") return stored;
  } catch {
    // Storage is off, as in some private windows: keep the visit's choice.
  }
  return remembered;
}

function subscribeStored(onChange: () => void) {
  listeners.add(onChange);
  // Another tab's choice follows here too.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function subscribeScreen(onChange: () => void) {
  const query = window.matchMedia(LARGE_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function chooseDesignMode(mode: DesignMode) {
  remembered = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Kept for this visit only.
  }
  for (const listener of listeners) listener();
}

/**
 * Simple or expert mode, as the visitor last chose it in this browser.
 * Expert mode needs a large screen: below it the choice is hidden and
 * simple mode shows. The server and the first render know neither, so they
 * draw simple mode.
 */
export function useDesignMode() {
  const preferred = useSyncExternalStore(
    subscribeStored,
    storedMode,
    () => "simple" as const,
  );
  const large = useSyncExternalStore(
    subscribeScreen,
    () => window.matchMedia(LARGE_SCREEN).matches,
    () => false,
  );
  return {
    mode: large ? preferred : ("simple" as DesignMode),
    /** Whether the screen has room for expert mode. */
    available: large,
    choose: chooseDesignMode,
  };
}
