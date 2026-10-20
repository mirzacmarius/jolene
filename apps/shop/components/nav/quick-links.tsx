import { cn } from "cn";
import { ChevronDown } from "lucide-react";

import type { MenuItem } from "@/lib/menu/types";

import { MenuLink } from "./menu-link";

const MAX_COLUMNS = 5;

export function QuickLinks({ items }: { items: MenuItem[] }) {
  return (
    <ul className="hidden h-full items-center gap-10 lg:flex">
      {items.map((item) => (
        <NavItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

const TRIGGER_CLASS =
  "relative flex items-center gap-1 text-xs after:absolute after:inset-x-0 after:-bottom-1.25 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:after:scale-x-100";

function NavItem({ item }: { item: MenuItem }) {
  if (item.items.length === 0) {
    return (
      <li className="flex h-full items-center">
        <MenuLink url={item.url} className={TRIGGER_CLASS}>
          {item.title}
        </MenuLink>
      </li>
    );
  }

  const columns = item.items.slice(0, MAX_COLUMNS);

  return (
    <li className="group flex h-full items-center">
      <MenuLink url={item.url} className={TRIGGER_CLASS}>
        {item.title}
        <ChevronDown className="size-3" aria-hidden="true" />
      </MenuLink>
      <div
        className={cn(
          "absolute inset-x-0 top-full z-40",
          "invisible opacity-0",
          "group-hover:visible group-hover:opacity-100",
          // :focus-visible (not :focus-within) so post-click mouse focus doesn't pin the menu open.
          "group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100",
          "transition-opacity duration-150",
          "bg-background border-b shadow-md",
        )}
      >
        <div className="px-5 lg:px-10 pb-5">
          <div className="grid grid-cols-5 gap-5">
            {columns.map((column) => (
              <div key={column.id}>
                {column.url ? (
                  <MenuLink
                    url={column.url}
                    className="block text-sm font-semibold mb-3 hover:opacity-70 transition-opacity"
                  >
                    {column.title}
                  </MenuLink>
                ) : (
                  <h3 className="text-sm font-semibold mb-3">{column.title}</h3>
                )}
                {column.items.length > 0 && (
                  <ul className="space-y-2">
                    {column.items.map((leaf) => (
                      <li key={leaf.id}>
                        <MenuLink
                          url={leaf.url}
                          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {leaf.title}
                        </MenuLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
