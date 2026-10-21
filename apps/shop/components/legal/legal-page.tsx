import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { formatUpdatedAt, LEGAL_PAGE_ORDER, LEGAL_PAGES } from "@/lib/legal";
import type { LegalLanguage, LegalPageKey } from "@/lib/legal/types";

const LABELS = {
  en: { others: "Other policies", switchTo: "Română", updated: "Last updated on" },
  ro: { others: "Alte politici", switchTo: "English", updated: "Actualizată la" },
} as const;

interface LegalPageProps {
  children: ReactNode;
  language: LegalLanguage;
  page: LegalPageKey;
}

export function LegalPage({ children, language, page }: LegalPageProps) {
  const other = language === "ro" ? "en" : "ro";
  const labels = LABELS[language];
  return (
    <Page>
      <Container>
        <Sections className="max-w-3xl" lang={language}>
          <article className="grid gap-10">
            <header className="grid gap-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl">
                {LEGAL_PAGES[page][language].title}
              </h1>
              <p className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
                <span>{`${labels.updated} ${formatUpdatedAt(language)}`}</span>
                <Link
                  className="text-foreground underline underline-offset-4"
                  href={LEGAL_PAGES[page][other].path}
                  hrefLang={other}
                  lang={other}
                >
                  {labels.switchTo}
                </Link>
              </p>
            </header>
            <div className="prose min-w-0 max-w-none prose-stone prose-headings:font-medium prose-a:underline-offset-4 prose-code:font-normal prose-code:break-all prose-code:before:content-none prose-code:after:content-none prose-li:my-1">
              {children}
            </div>
          </article>
          <nav aria-labelledby="legal-others" className="grid gap-4 border-t pt-10">
            <h2
              className="text-xxs leading-[1.6] font-medium tracking-[0.15em] text-muted-foreground uppercase"
              id="legal-others"
            >
              {labels.others}
            </h2>
            <ul className="grid gap-2.5 text-sm">
              {LEGAL_PAGE_ORDER.filter((key) => key !== page).map((key) => (
                <li key={key}>
                  <Link
                    className="underline-offset-4 hover:underline"
                    href={LEGAL_PAGES[key][language].path}
                  >
                    {LEGAL_PAGES[key][language].title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Sections>
      </Container>
    </Page>
  );
}

interface LegalLinkProps {
  children?: ReactNode;
  language: LegalLanguage;
  page: LegalPageKey;
}

export function LegalLink({ children, language, page }: LegalLinkProps) {
  const { path, title } = LEGAL_PAGES[page][language];
  return <Link href={path}>{children ?? title}</Link>;
}
