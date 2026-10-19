import { Logo } from "@jolene/ui/logo";
import { FolderHeart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { env } from "@/env";
import { getI18n } from "@/locales/server";
import { LanguageMenu } from "./language-menu";

/** The studio's bar: home, the visitor's designs, their language, the shop. */
export async function SiteHeader() {
  const t = await getI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-baseline gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Logo />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:inline">
            Studio
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            {t("common.collections")}
          </Link>
          <Link
            href="/designurile-mele"
            className="transition-colors hover:text-foreground"
          >
            {t("common.myDesigns")}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            href="/designurile-mele"
            aria-label={t("common.myDesigns")}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <FolderHeart className="size-4" strokeWidth={1.6} aria-hidden />
          </Link>
          <LanguageMenu />
          <a
            href={env.NEXT_PUBLIC_SHOP_URL}
            className="inline-flex items-center gap-2 rounded-full p-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3 sm:py-2"
          >
            <ShoppingBag className="size-4" strokeWidth={1.6} aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("common.shop")}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
