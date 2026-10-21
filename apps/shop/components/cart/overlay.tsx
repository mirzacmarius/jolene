"use client";

import { Loader2, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart, useCartDrawer } from "@/lib/cart/client";

import { CartLineItems } from "./line-item";
import { CartSummary } from "./summary";

interface CartOverlayProps {
  description: string;
  title: string;
}

export function CartOverlay({ description, title }: CartOverlayProps) {
  const { cart } = useCart();
  const drawer = useCartDrawer();
  const count = cart?.count ?? 0;

  return (
    <Sheet onOpenChange={drawer.setOpen} open={drawer.isOpen}>
      <SheetContent className="gap-0 p-0" closeButton={false} overlay={false} side="right">
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-2.5">
          <div className="flex items-center gap-1.5">
            <SheetTitle className="font-normal text-xl leading-4">{title}</SheetTitle>
            {count > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-xs text-background">
                {count}
              </span>
            ) : null}
          </div>
          <SheetClose
            aria-label="Închide coșul"
            className="flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-5" />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">{description}</SheetDescription>
        <OverlayContent />
      </SheetContent>
    </Sheet>
  );
}

function OverlayContent() {
  const { cart, isLoading } = useCart();
  const drawer = useCartDrawer();
  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center gap-2.5" role="status">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Se încarcă coșul…
      </div>
    );
  if (!cart?.lines.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-2.5 text-center">
        <h3 className="text-2xl">Coșul e gol</h3>
        <Button
          className="h-12 px-8"
          onClick={() => drawer.setOpen(false)}
          render={<Link href="/collections/all" />}
        >
          Vezi produsele
        </Button>
      </div>
    );
  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 content-start gap-5 overflow-y-auto px-2.5 py-5">
        <CartLineItems lines={cart.lines} />
      </div>
      <footer className="px-2.5 pt-5 pb-2.5">
        <CartSummary cart={cart} />
      </footer>
    </div>
  );
}
