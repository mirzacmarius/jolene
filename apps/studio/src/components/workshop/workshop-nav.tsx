import Link from "next/link";
import { getI18n } from "@/locales/server";

/** The workshop's sections. */
const SECTIONS = [
  { key: "orders", href: "/studio/atelier" },
  { key: "products", href: "/studio/atelier/produse" },
  { key: "settings", href: "/studio/atelier/setari" },
] as const;

/** Links between the workshop's sections, the open one marked. */
export async function WorkshopNav({
  current,
}: {
  current: (typeof SECTIONS)[number]["key"];
}) {
  const t = await getI18n();
  return (
    <nav aria-label={t("workshop.nav.label")} className="flex flex-wrap gap-2">
      {SECTIONS.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === current ? "page" : undefined}
          className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
        >
          {t(`workshop.nav.${key}`)}
        </Link>
      ))}
    </nav>
  );
}
