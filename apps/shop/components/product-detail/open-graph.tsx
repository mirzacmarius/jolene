import { CURRENCY_CODE, toAmount } from "@/lib/money";

// Next Metadata cannot emit product `property=` tags, so React hoists these raw meta elements.
export function ProductOpenGraph({ price }: { price: number }) {
  return (
    <>
      <meta content="product" property="og:type" />
      <meta content={toAmount(price)} property="og:price:amount" />
      <meta content={CURRENCY_CODE} property="og:price:currency" />
      <meta content="instock" property="og:availability" />
      <meta content={toAmount(price)} property="product:price:amount" />
      <meta content={CURRENCY_CODE} property="product:price:currency" />
      <meta content="in stock" property="product:availability" />
    </>
  );
}
