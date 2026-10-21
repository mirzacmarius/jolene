import { shopConfig } from "@/lib/config";
import { CURRENCY_CODE, toAmount } from "@/lib/money";
import type { ProductDetails } from "@/lib/product/types";

// One offer at the price before papers and paid choices, which is what the page shows first.
export function ProductSchema({ product }: { product: ProductDetails }) {
  const url = `${shopConfig.site.url}/products/${product.handle}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    brand: { "@type": "Brand", name: shopConfig.site.name },
    description: product.description,
    image: product.images.map((image) => image.url),
    name: product.title,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      price: toAmount(product.price),
      priceCurrency: CURRENCY_CODE,
      url,
    },
  };
  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
