/** The look the dropdown and context menus share: the panel and its rows. */

export const menuPanel =
  "z-50 min-w-44 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

export const menuRow =
  "relative flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
