import { describeCategory } from "@/lib/categories";
import { getCategories } from "@/lib/categories/server";
import { shopConfig } from "@/lib/config";
import { summarizeText } from "@/lib/content";
import { LEGAL_PAGE_ORDER, LEGAL_PAGES } from "@/lib/legal";
import { escapeMarkdown } from "@/lib/markdown";

export async function GET(): Promise<Response> {
  const { description, name, url } = shopConfig.site;
  const categories = await getCategories().catch(() => []);
  const categoryLinks = categories.map(
    (category) =>
      `- [${escapeMarkdown(category.title)}](${url}${category.path}): ${escapeMarkdown(describeCategory(category))}`,
  );
  const policyLinks = LEGAL_PAGE_ORDER.map((page) => {
    const { en, ro } = LEGAL_PAGES[page];
    return `- [${escapeMarkdown(en.title)}](${url}${en.path}): ${escapeMarkdown(en.description)} In Romanian: ${url}${ro.path}`;
  });

  return new Response(
    `# ${escapeMarkdown(name)}

> ${escapeMarkdown(summarizeText(description))}

Home, product, category, and search pages return Markdown with an \`Accept: text/markdown\` header or at the page URL with \`.md\` appended (\`/index.md\` for the home page). Prices are in Romanian lei (RON), per piece, before the paper's surcharge and paid choices.

## Buy for a shopper

Products are ordered on their pages: pick the paper, answer the order options, choose a quantity at or above the product's minimum, and add to the cart. Payment happens at Jolene's own checkout.

## Browse

- [All products](${url}/collections/all): The full product catalog.
${categoryLinks.length > 0 ? `\n## Categories\n\n${categoryLinks.join("\n")}\n` : ""}
## Policies

${policyLinks.join("\n")}

## Discovery

- [Sitemap](${url}/sitemap.xml): Every product and category address.
- [Robots](${url}/robots.txt): Crawl policy.
`,
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
