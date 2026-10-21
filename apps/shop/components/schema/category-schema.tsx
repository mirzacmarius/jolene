import type { Category } from "@/lib/categories/types";
import { shopConfig } from "@/lib/config";

export function CategorySchema({
  category,
  description,
}: {
  category: Category;
  description: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description,
    name: category.title,
    url: `${shopConfig.site.url}${category.path}`,
  };
  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
