import { describeCategory } from "@/lib/categories";
import type { BrowseResults, Category } from "@/lib/categories/types";
import { shopConfig } from "@/lib/config";
import { escapeMarkdown, markdownFrontmatter } from "@/lib/markdown";
import { formatPrice } from "@/lib/money";

export function categoryToMarkdown(category: Category, results: BrowseResults): string {
  const siteUrl = shopConfig.site.url;
  const description = describeCategory(category);
  const sections: string[] = [
    markdownFrontmatter({
      canonicalUrl: new URL(category.path, siteUrl).toString(),
      description,
      title: category.title,
    }),
    "",
    `# ${escapeMarkdown(category.title)}`,
    "",
    escapeMarkdown(description),
    "",
  ];

  if (results.products.length > 0) {
    sections.push("## Products", "");
    for (const product of results.products)
      sections.push(
        `- [${escapeMarkdown(product.title)}](${new URL(`/products/${product.handle}`, siteUrl)}): ${formatPrice(product.price)} / buc.`,
      );
    if (results.cursor) sections.push("", `More products: ${new URL(category.path, siteUrl)}`);
    sections.push("");
  }

  sections.push("## Browse", "", `- Shop: ${new URL(category.path, siteUrl)}`);
  return sections.join("\n");
}
