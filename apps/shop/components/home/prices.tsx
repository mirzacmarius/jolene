// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
import { type ProductKind, productKindLabels } from "@jolene/design";
import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";

import { StudioLink } from "@/components/studio/studio-link";
import { Container } from "@/components/ui/container";
import { PillArrow, pillVariants } from "@/components/ui/pill";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shopConfig } from "@/lib/config";

import { PricePicker } from "./price-picker";
import { Accent, Eyebrow } from "./typography";

interface Price {
  amount: number;
  from: boolean;
  kind: ProductKind;
  meta: [string, string];
  note: string;
  text: string;
}

// Shopify doesn't sell Jolene's catalog yet: these are jolene.ro's prices in October 2026.
const PRICES: Price[] = [
  {
    amount: 5.5,
    from: true,
    kind: "invitation",
    meta: ["De la 30 de bucăți", "Plic inclus"],
    note: "133 × 184 mm · cu plic",
    text: "Pe carton de 300 g, tipărită pe față, cu plicul în culoarea aleasă. Sigiliul din ceară costă 1 leu în plus, iar cardul de confirmare, de la 0,80 lei.",
  },
  {
    amount: 2.8,
    from: true,
    kind: "menu",
    meta: ["9 × 20 cm", "Carton de 300 g"],
    note: "9 × 20 cm · față-verso",
    text: "Pe carton de 300 g, tipărit față-verso, cu tot ce ați pregătit pentru invitați. Cu sigiliu din ceară, 1 leu în plus.",
  },
  {
    amount: 3.5,
    from: true,
    kind: "table-number",
    meta: ["155 × 155 mm", "Carton de 300 g"],
    note: "155 × 155 mm",
    text: "Pe carton de 300 g, ca invitații să-și găsească masa dintr-o privire. Bețișorul pentru aranjamentul floral costă 1 leu în plus.",
  },
  {
    amount: 1.5,
    from: false,
    kind: "place-card",
    meta: ["Un nume pe fiecare", "În designul invitației"],
    note: "Cu numele fiecărui invitat",
    text: "Cu numele fiecărui invitat, ca fiecare să-și găsească locul la masă fără să întrebe.",
  },
  {
    amount: 2.5,
    from: false,
    kind: "money-envelope",
    meta: ["Plic și place card", "În designul invitației"],
    note: "Ține loc și de place card",
    text: "Plicul pentru darul invitaților, cu loc pentru numele lor, care ține loc și de place card pe masă.",
  },
  {
    amount: 1.5,
    from: true,
    kind: "favor-tag",
    meta: ["Aprox. 6 cm", "Carton gros"],
    note: "Aprox. 6 cm",
    text: "Pe carton gros, pentru mărturiile pe care le dăruiți invitaților. Panglica de prins costă de la 0,50 lei în plus.",
  },
  {
    amount: 60,
    from: true,
    kind: "welcome-sign",
    meta: ["Până la 70 × 50 cm", "Fără ramă"],
    note: "Până la 70 × 50 cm",
    text: "Panoul care vă întâmpină invitații la intrare, pe carton gros sau hârtie fotografică. Rama nu e inclusă.",
  },
  {
    amount: 80,
    from: true,
    kind: "seating-chart",
    meta: ["Pe mese sau alfabetic", "Fără ramă"],
    note: "Mesele și invitații, pe un panou",
    text: "Așezarea invitaților la mese, în ordinea meselor sau alfabetic, ca fiecare să-și găsească repede locul. Rama nu e inclusă.",
  },
];

const LEI = new Intl.NumberFormat(shopConfig.localization.locale, { minimumFractionDigits: 2 });

function formatLei(amount: number) {
  return `${LEI.format(amount)} lei`;
}

export function HomePrices() {
  const [first] = PRICES;
  if (!first) return null;

  return (
    <Container aria-labelledby="prices-title" className="scroll-mt-20" id="preturi">
      <div className="grid gap-10 py-24 md:py-28">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="grid justify-items-start gap-5">
            <Eyebrow className="reveal" data-reveal>
              Prețuri clare, pe bucată
            </Eyebrow>
            <h2
              className="reveal reveal-blur text-[clamp(2.75rem,5.5vw,5.3125rem)] leading-[1.07] font-normal tracking-[-0.06em]"
              data-reveal
              id="prices-title"
            >
              Cât costă
              <br />
              <Accent>fiecare detaliu?</Accent>
            </h2>
          </div>
          <p className="reveal max-w-xs text-[0.8125rem] leading-[1.9]" data-reveal>
            Alegeți doar ce vă trebuie,
            <br />
            în designul aceleiași colecții.
          </p>
        </div>
        <PricePicker
          className="reveal grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center"
          defaultValue={first.kind}
        >
          <TabsList aria-label="Prețurile papetăriei" className="flex-col">
            {PRICES.map((item, index) => (
              <TabsTrigger
                className="group/row flex w-full items-center gap-5 border-t px-1 py-4 text-left opacity-50 transition-[opacity,padding] duration-300 last:border-b hover:opacity-80 data-active:pl-4 data-active:opacity-100 md:py-5 motion-reduce:transition-none"
                key={item.kind}
                value={item.kind}
              >
                <span className="w-4 shrink-0 self-start pt-2 text-xxs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid min-w-0 gap-2.5">
                  <span className="text-2xl leading-[1.2] tracking-[-0.045em] md:text-[1.75rem]">
                    {productKindLabels[item.kind].ro}
                  </span>
                  <span className="text-xxs">{item.note}</span>
                </span>
                <span className="ml-auto grid shrink-0 justify-items-end text-right">
                  {item.from && <span className="text-xxs">de la</span>}
                  <span className="text-xl tracking-[-0.03em] md:text-[1.3125rem]">
                    {formatLei(item.amount)}
                  </span>
                </span>
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="size-7 shrink-0 stroke-1 opacity-0 transition-[opacity,rotate] duration-300 group-data-active/row:rotate-45 group-data-active/row:opacity-100 max-sm:hidden motion-reduce:transition-none"
                />
              </TabsTrigger>
            ))}
          </TabsList>
          {PRICES.map((item) => (
            <TabsContent
              className="grid w-full max-w-lg scroll-mt-20 justify-items-center gap-5 justify-self-center overflow-hidden rounded-t-[10rem] rounded-b-lg bg-sage px-6 pt-11 pb-10 text-center md:px-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
              keepMounted
              key={item.kind}
              value={item.kind}
            >
              <div
                aria-hidden="true"
                className="relative grid size-29 place-items-center rounded-full border border-primary/40 before:absolute before:inset-2 before:rounded-full before:border before:border-primary/25 after:absolute after:inset-4 after:rounded-full after:border after:border-primary/25"
              >
                <i className="absolute -top-1.25 left-[calc(50%_-_0.3125rem)] size-2.5 origin-[0.3125rem_3.9375rem] rounded-full bg-primary motion-safe:animate-sundial" />
                <span className="font-display text-[1.625rem] leading-none italic">
                  pe
                  <br />
                  hârtie.
                </span>
              </div>
              <Eyebrow className="text-[0.5625rem]">În designul colecției alese</Eyebrow>
              <h3 className="font-display text-[2.8125rem] leading-[1.1] italic">
                {productKindLabels[item.kind].ro}
              </h3>
              <p className="max-w-xs text-[0.8125rem] leading-[1.85]">{item.text}</p>
              <ul className="flex flex-wrap justify-center text-[0.5625rem] tracking-[0.12em] uppercase">
                {item.meta.map((meta, index) => (
                  <li className={cn("px-4", index > 0 && "border-l border-primary/25")} key={meta}>
                    {meta}
                  </li>
                ))}
              </ul>
              <StudioLink className={cn(pillVariants(), "text-xs")}>
                Începeți în studio <PillArrow />
              </StudioLink>
              <p className="text-[0.5625rem] tracking-[0.035em]">
                {`${item.from ? "De la " : ""}${formatLei(item.amount)} pe bucată`}
              </p>
            </TabsContent>
          ))}
        </PricePicker>
      </div>
    </Container>
  );
}
