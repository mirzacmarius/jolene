import { shopConfig } from "@/lib/config";
import { escapeMarkdown, markdownFrontmatter } from "@/lib/markdown";
import { markdownHeaders } from "@/lib/markdown/representation";

export function GET(): Response {
  const { description, name, url } = shopConfig.site;

  return new Response(
    `${markdownFrontmatter({ canonicalUrl: new URL("/", url).toString(), description, title: name })}

# ${escapeMarkdown(name)}

${escapeMarkdown(description)}

## Browse

- [All products](${url}/collections/all): The complete catalog.
- [Search](${url}/search): Search products by name.
- [Categories](${url}/collections): Products by category.
- [Studio](${url}/studio): Design an invitation and see it before it's printed.

## Agent resources

- [Storefront guide](${url}/llms.txt): When and how to use this storefront.
- [Sitemap](${url}/sitemap.xml): Every product and category address.

---

*Locale: ${shopConfig.localization.locale}*`,
    {
      headers: markdownHeaders({
        cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
        pathname: "/",
      }),
    },
  );
}
