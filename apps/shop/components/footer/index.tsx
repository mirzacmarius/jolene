// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";

import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { shopConfig } from "@/lib/config";

import anpcSal from "./anpc-sal.webp";
import { type SocialLink, SocialLinks } from "./social-links";

// These pages and articles still live on jolene.ro: they must move here before jolene.ro points at this shop.
const JOLENE_RO = "https://jolene.ro";

const PAGES = [
  { href: `${JOLENE_RO}/intrebari-utile/`, label: "Întrebări utile" },
  { href: `${JOLENE_RO}/politica-de-comanda-si-livrare/`, label: "Politica de comandă și livrare" },
  { href: `${JOLENE_RO}/politica-de-retur/`, label: "Politica de retur" },
];

const ARTICLES = [
  {
    href: `${JOLENE_RO}/prima-regula-a-unei-invitatii-de-nunta-reusite-pasiune/`,
    label: "Prima regulă a unei invitații de nuntă reușite: pasiune.",
  },
  {
    href: `${JOLENE_RO}/cum-sa-alegi-invitatiile-de-nunta/`,
    label: "Cum să alegi invitațiile de nuntă?",
  },
  {
    href: `${JOLENE_RO}/20-idei-cadouri-de-logodna-18-e-chiar-interesant/`,
    label: "20+ idei cadouri de logodnă. 18 e chiar interesant!",
  },
];

const LEGAL = [
  { href: `${JOLENE_RO}/termeni-si-conditii/`, label: "Termeni și condiții" },
  { href: `${JOLENE_RO}/politica-de-confidentialitate/`, label: "Politica de confidențialitate" },
  { href: `${JOLENE_RO}/politica-de-cookies/`, label: "Politica de cookies" },
  { href: "https://anpc.ro/", label: "ANPC" },
];

const SOCIAL_LINKS: SocialLink[] = [
  { platform: "facebook", url: "https://www.facebook.com/jolene.wedding/" },
  { platform: "instagram", url: "https://www.instagram.com/jolene_wedding/" },
  { platform: "pinterest", url: "https://pin.it/HuF5K6u" },
  { platform: "tiktok", url: "https://vm.tiktok.com/ZSgkymwd/" },
];

const LINK_CLASS = "underline-offset-5 hover:underline";

export function Footer() {
  return (
    <footer className="pt-20">
      <div className="bg-primary text-primary-foreground">
        <Container>
          {/* pb-22 clears the fixed agent ActionBar pill when it renders */}
          <div className={cn("grid gap-5 pt-16 pb-6", shopConfig.agent.isEnabled && "pb-22")}>
            <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
              <Link
                className="flex items-center gap-5 self-start text-[5rem] leading-none tracking-[-0.075em] sm:col-span-2 lg:col-span-1"
                href="/"
              >
                {shopConfig.site.name}
                <ArrowUpRightIcon aria-hidden="true" className="size-11 shrink-0 stroke-1" />
              </Link>
              <div className="grid content-start gap-4 text-[0.8125rem] leading-[1.8]">
                <p className="opacity-80">
                  Jolene s-a născut din dragoste pentru nunți și pentru decorațiuni inspirate din
                  bucuria unor astfel de evenimente.
                </p>
                <address className="grid not-italic">
                  <a className={LINK_CLASS} href="mailto:invitatii.jolene@gmail.com">
                    invitatii.jolene@gmail.com
                  </a>
                  <a className={LINK_CLASS} href="tel:+40754536366">
                    0754 536 366
                  </a>
                  <span className="opacity-80">Iași, România</span>
                </address>
              </div>
              <FooterLinks links={PAGES} title="Pagini importante" />
              <FooterLinks links={ARTICLES} title="Din blog" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-5">
              {/* ANPC's Order 270/2026 asks for one SAL pictogram, 250 × 50 px, linking to its SAL platform. */}
              {/* Unoptimized: images.deviceSizes would serve it 1320 px wide; it is saved at twice its size. */}
              <a href="https://reclamatiisal.anpc.ro/" rel="noopener noreferrer" target="_blank">
                <Image
                  alt="Soluționarea alternativă a litigiilor"
                  className="h-12.5 w-auto"
                  src={anpcSal}
                  unoptimized
                />
              </a>
              <SocialLinks links={SOCIAL_LINKS} />
            </div>
            <div className="flex flex-col gap-4 border-t border-primary-foreground/20 pt-5 text-xxs leading-[1.65] tracking-[0.035em] sm:flex-row sm:justify-between">
              <p>{`© ${shopConfig.site.name}. Toate drepturile rezervate.`}</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                {LEGAL.map(({ href, label }) => (
                  <li key={href}>
                    <a className={LINK_CLASS} href={href}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}

interface FooterLinksProps {
  links: { href: string; label: string }[];
  title: string;
}

function FooterLinks({ links, title }: FooterLinksProps) {
  return (
    <div className="grid content-start gap-4">
      <h2 className="text-xxs leading-[1.6] font-medium tracking-[0.15em] uppercase opacity-80">
        {title}
      </h2>
      <ul className="grid gap-2.5 text-[0.8125rem] leading-normal">
        {links.map(({ href, label }) => (
          <li key={href}>
            <a className={LINK_CLASS} href={href}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
