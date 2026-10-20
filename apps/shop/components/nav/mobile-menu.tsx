// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { StudioLink } from "@/components/studio/studio-link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PillArrow, pillVariants } from "@/components/ui/pill";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MenuItem } from "@/lib/menu/types";

import logo from "./jolene-logo.webp";
import { MenuLink } from "./menu-link";

export function MobileMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            aria-label="Deschideți meniul"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-foreground/20 lg:hidden"
            type="button"
          />
        }
      >
        <span className="h-1.75 w-4.25 border-y border-foreground" />
      </SheetTrigger>
      <SheetContent
        className="w-full max-w-120 gap-10 overflow-y-auto border-0 bg-background p-6 shadow-none"
        closeButton={false}
        side="right"
      >
        <div className="flex items-center justify-between">
          <SheetTitle>
            <Image alt="Jolene" className="h-10 w-auto" src={logo} unoptimized />
          </SheetTitle>
          <SheetClose
            aria-label="Închideți meniul"
            className="flex size-11 cursor-pointer items-center justify-center text-[2.375rem] leading-none"
          >
            ×
          </SheetClose>
        </div>
        <nav aria-label="Meniu">
          <MobileMenuList items={items} onLinkClick={close} />
        </nav>
        <StudioLink className={pillVariants()} onClick={close}>
          Creați-vă invitația <PillArrow />
        </StudioLink>
        <SheetDescription className="text-xxs tracking-[0.035em] text-foreground">
          Papetărie de nuntă și botez · Iași
        </SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

function MobileMenuList({ items, onLinkClick }: { items: MenuItem[]; onLinkClick: () => void }) {
  const hasAnyChildren = items.some((item) => item.items.length > 0);

  if (!hasAnyChildren) {
    return (
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li key={item.id}>
            <MenuLink
              url={item.url}
              onClick={onLinkClick}
              className="flex items-center gap-4 border-b py-4.5 text-xl"
            >
              <small className="w-4 shrink-0 text-[0.6875rem] opacity-55">
                {String(index + 1).padStart(2, "0")}
              </small>
              {item.title}
              <ArrowUpRightIcon aria-hidden="true" className="ml-auto size-5 stroke-[1.25]" />
            </MenuLink>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Accordion multiple className="w-full">
      {items.map((item) =>
        item.items.length > 0 ? (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="py-3 text-base">{item.title}</AccordionTrigger>
            <AccordionContent>
              <NestedItems items={item.items} onLinkClick={onLinkClick} />
              {item.url ? (
                <MenuLink
                  url={item.url}
                  onClick={onLinkClick}
                  className="mt-3 block text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                  {`Show all ${item.title}`}
                </MenuLink>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ) : (
          <div key={item.id} className="border-b last:border-b-0">
            <MenuLink
              url={item.url}
              onClick={onLinkClick}
              className="flex py-3 text-base transition-colors hover:text-muted-foreground"
            >
              {item.title}
            </MenuLink>
          </div>
        ),
      )}
    </Accordion>
  );
}

function NestedItems({ items, onLinkClick }: { items: MenuItem[]; onLinkClick: () => void }) {
  return (
    <ul className="flex flex-col gap-3 pl-3">
      {items.map((item) => (
        <li key={item.id} className="space-y-2">
          <MenuLink
            url={item.url}
            onClick={onLinkClick}
            className="block text-sm font-medium hover:opacity-70 transition-opacity"
          >
            {item.title}
          </MenuLink>
          {item.items.length > 0 && (
            <ul className="flex flex-col gap-2 pl-3">
              {item.items.map((leaf) => (
                <li key={leaf.id}>
                  <MenuLink
                    url={leaf.url}
                    onClick={onLinkClick}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {leaf.title}
                  </MenuLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
