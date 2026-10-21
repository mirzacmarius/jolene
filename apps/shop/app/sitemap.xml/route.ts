import { ALL_PRODUCTS_HANDLE } from "@/lib/categories";
import { getCategories } from "@/lib/categories/server";
import { shopConfig } from "@/lib/config";
import { getProductHandles } from "@/lib/product/server";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A few hundred products fit one sitemap, which takes up to 50,000 addresses.
export async function GET(): Promise<Response> {
  const [categories, handles] = await Promise.all([getCategories(), getProductHandles()]);
  const paths = [
    "/",
    "/collections",
    `/collections/${ALL_PRODUCTS_HANDLE}`,
    ...categories.map((category) => category.path),
    ...handles.map((handle) => `/products/${handle}`),
  ];
  const entries = paths
    .map((path) => `  <url><loc>${escapeXml(`${shopConfig.site.url}${path}`)}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
