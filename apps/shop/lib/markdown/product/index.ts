import { shopConfig } from "@/lib/config";
import { summarizeText } from "@/lib/content";
import { escapeMarkdown, markdownFrontmatter } from "@/lib/markdown";
import { formatPrice } from "@/lib/money";
import { isMarkedDown } from "@/lib/product";
import type { ProductDetails } from "@/lib/product/types";

function priceLine(product: ProductDetails): string {
  const parts = [`**${formatPrice(product.price)}** / buc.`];
  if (isMarkedDown(product.price, product.compareAtPrice))
    parts.push(`Was ${formatPrice(product.compareAtPrice)}`);
  if (product.minQuantity && product.minQuantity > 1)
    parts.push(`Minimum order ${product.minQuantity} buc.`);
  return parts.join(" · ");
}

// Agents read this, and the studio asks for it to learn whether the shop sells a product.
export function productToMarkdown(product: ProductDetails): string {
  const siteUrl = shopConfig.site.url;
  const summary = summarizeText(product.description);
  const sections: string[] = [
    markdownFrontmatter({
      canonicalUrl: new URL(`/products/${product.handle}`, siteUrl).toString(),
      description: summary,
      title: product.title,
    }),
    "",
    `# ${escapeMarkdown(product.title)}`,
    "",
  ];

  if (product.categories.length > 0)
    sections.push(product.categories.map(({ title }) => escapeMarkdown(title)).join(" · "), "");
  sections.push(priceLine(product), "");
  if (product.description) sections.push("## About", "", escapeMarkdown(product.description), "");

  if (product.options.length > 0) {
    sections.push("## Options", "");
    for (const option of product.options) {
      const values = option.values
        .map(({ name, surcharge }) =>
          surcharge ? `${escapeMarkdown(name)} (+${formatPrice(surcharge)})` : escapeMarkdown(name),
        )
        .join(", ");
      sections.push(`- **${escapeMarkdown(option.name)}**: ${values}`);
    }
    sections.push("");
  }

  if (product.images.length > 0) {
    sections.push("## Images", "");
    for (const image of product.images)
      sections.push(`- ![${escapeMarkdown(image.altText)}](${image.url})`);
    sections.push("");
  }

  sections.push(
    "## Buy",
    "",
    `- Shop: ${new URL(`/products/${product.handle}`, siteUrl)}`,
    "",
    "---",
    "",
    "*Prices in RON*",
  );
  return sections.join("\n");
}
