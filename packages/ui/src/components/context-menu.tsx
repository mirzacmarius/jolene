"use client";

import { ContextMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../utils";
import { menuPanel, menuRow } from "./menu";

/**
 * A list of actions that opens where the visitor right-clicks, or holds a
 * finger down, such as what can be done to a layer.
 */
export const ContextMenu = MenuPrimitive.Root;
export const ContextMenuTrigger = MenuPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          menuPanel,
          "max-h-(--radix-context-menu-content-available-height)",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(menuRow, className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/** The key that does the same, at the end of an item. */
export function ContextMenuShortcut({
  className,
  ...props
}: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="context-menu-shortcut"
      className={cn(
        "ml-auto pl-4 font-sans text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
