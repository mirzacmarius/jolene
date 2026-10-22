"use client";

import { useSyncExternalStore } from "react";

const notTyped = new Set([
  "button",
  "checkbox",
  "color",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether a key press goes to a field the visitor is typing in. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !notTyped.has(target.type);
}

/**
 * Whether a key press belongs to something that keeps its keys to itself: a
 * dialog or sheet (the AI designer's, for one), or an open menu.
 */
export function isOwnedElsewhere(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]') !==
      null
  );
}

/** Whether the studio's own shortcuts should answer this key press. */
export function isShortcut(event: KeyboardEvent): boolean {
  return (
    !event.defaultPrevented &&
    !event.isComposing &&
    !isTyping(event.target) &&
    !isOwnedElsewhere(event.target)
  );
}

/** Cmd on a Mac, Ctrl elsewhere. */
export const isModifier = (event: { metaKey: boolean; ctrlKey: boolean }) =>
  event.metaKey || event.ctrlKey;

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** Whether the visitor types on a Mac; the server can't tell, so it says no. */
function useMac() {
  return useSyncExternalStore(
    () => () => {},
    isMac,
    () => false,
  );
}

/** How shortcuts are written here: "⌘Z" on a Mac, "Ctrl+Z" elsewhere. */
export function useShortcutLabel() {
  const mac = useMac();
  return (key: string, { shift = false, modifier = true } = {}) =>
    mac
      ? `${shift ? "⇧" : ""}${modifier ? "⌘" : ""}${key}`
      : [modifier && "Ctrl", shift && "Shift", key].filter(Boolean).join("+");
}

/** The key that deletes, as the keyboard shows it: ⌫ on a Mac, Delete elsewhere. */
export function useDeleteKeyLabel() {
  return useMac() ? "⌫" : "Delete";
}
