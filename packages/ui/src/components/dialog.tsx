"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../utils";

/**
 * A panel over the page that keeps the focus until it's closed, by its
 * close button, Escape or a click beside it, such as the proof to approve.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

/**
 * The panel, in the middle of the screen and as tall as it needs, scrolling
 * past the screen's height; a phone's whole screen.
 */
export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-foreground/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed inset-0 z-50 m-auto h-fit max-h-dvh w-full overflow-y-auto overscroll-contain bg-background text-foreground shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-sm:min-h-dvh sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100%-2rem)] sm:rounded-[28px]",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
