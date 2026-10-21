import { cn } from "cn";
import Image from "next/image";
import { Suspense } from "react";

import { StudioLink } from "@/components/studio/studio-link";
import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { PillArrow, pillVariants } from "@/components/ui/pill";
import { shopConfig } from "@/lib/config";
import type { MenuItem } from "@/lib/menu/types";

import { CartIcon, CartIconFallback } from "./cart";
import logo from "./jolene-logo.webp";
import { MobileMenu } from "./mobile-menu";
import { QuickLinks } from "./quick-links";
import { SearchModal } from "./search-modal";

export function Nav() {
  const items: MenuItem[] = [
    { id: "jolene-nav-story", items: [], title: "Povestea", url: "/#poveste" },
    { id: "jolene-nav-steps", items: [], title: "Cum funcționează", url: "/#cum-functioneaza" },
    { id: "jolene-nav-prices", items: [], title: "Prețuri", url: "/#preturi" },
    { id: "jolene-nav-christening", items: [], title: "Botez", url: "/#botez" },
    { id: "jolene-nav-questions", items: [], title: "Întrebări", url: "/#intrebari" },
  ];
  return (
    <nav
      className="sticky top-0 z-30 w-full bg-background pt-[env(safe-area-inset-top,0px)]"
      id="nav-outer"
    >
      <Container className="flex h-19 items-center justify-between gap-5">
        <Link className="flex shrink-0 items-center" href="/">
          {/* Unoptimized: images.deviceSizes would serve it 1320 px wide; brand/generate.py sizes it. */}
          <Image
            alt={shopConfig.site.name}
            className="h-10 w-auto"
            loading="eager"
            src={logo}
            unoptimized
          />
        </Link>

        <QuickLinks items={items} />

        <div className="flex items-center gap-4">
          {shopConfig.search.isEnabled && <SearchModal />}
          <Suspense fallback={<CartIconFallback />}>
            <CartIcon />
          </Suspense>
          <StudioLink
            className={cn(pillVariants(), "min-h-11 gap-5 px-5 py-2.5 text-xs max-sm:hidden")}
          >
            Creați-vă invitația <PillArrow />
          </StudioLink>
          <MobileMenu items={items} />
        </div>
      </Container>
    </nav>
  );
}
