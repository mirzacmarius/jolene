import Link from "next/link";

import { Price } from "@/components/product/price";
import { StudioLink } from "@/components/studio/studio-link";
import { PillArrow, pillVariants } from "@/components/ui/pill";
import type { ProductDetails } from "@/lib/product/types";

const STEPS = [
  {
    title: "Personalizați designul.",
    body: "Scrieți detaliile o dată; apar la fel pe toate piesele colecției.",
  },
  {
    title: "Alegeți finisajele și cantitatea.",
    body: "Le vedeți pe design imediat ce le alegeți.",
  },
  {
    title: "Aprobați bunul de tipar și plătiți.",
    body: "Îl tipărim în cel mult 7 zile lucrătoare.",
  },
];

interface StudioOrderProps {
  product: ProductDetails;
  /** The studio's template the product is designed from. */
  template: string;
}

// A product the studio designs is ordered from there, with the couple's own details (ADR 0021): its paper, order
// options and quantity are asked beside the design, and approving the proof puts it in the cart.
export function StudioOrder({ product, template }: StudioOrderProps) {
  const minQuantity = product.minQuantity ?? 1;
  const varies =
    product.options.some((option) => option.values.some((value) => value.surcharge > 0)) ||
    product.lineOptions.some((option) => option.choices.some((choice) => choice.price > 0));
  return (
    <div className="grid gap-8">
      <p className="text-sm text-muted-foreground">
        {varies ? "de la " : null}
        <Price amount={product.price} className="text-foreground" /> / buc.
        {minQuantity > 1 ? ` · comandă minimă ${minQuantity} buc.` : null}
      </p>
      <div className="grid gap-3.5">
        <StudioLink
          className={pillVariants({ className: "sm:justify-self-start sm:min-w-80" })}
          path={`/design/nou/${template}`}
        >
          Personalizează în studio <PillArrow />
        </StudioLink>
        <p className="text-sm text-muted-foreground">
          Îl vedeți pe loc cu detaliile voastre, iar hârtia și finisajele le alegeți tot acolo, cu
          prețul la vedere.
        </p>
      </div>
      <ol className="grid gap-4 border-y border-border py-5.5">
        {STEPS.map((step, index) => (
          <li className="flex items-baseline gap-3.5 text-sm" key={step.title}>
            <span aria-hidden="true" className="font-mono text-base text-muted-foreground">
              {index + 1}
            </span>
            <span>
              <span className="font-medium text-foreground">{step.title}</span>{" "}
              <span className="text-foreground/80">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        O cerere deosebită?{" "}
        <Link
          className="text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
          href="/contact"
        >
          Scrieți-ne
        </Link>
        .
      </p>
    </div>
  );
}
