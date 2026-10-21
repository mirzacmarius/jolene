import type { Post } from "@jolene/products/blog";
import { photoUrl } from "@jolene/products/photos";

import { getPostCover, getPostPath } from "@/lib/blog";
import { shopConfig } from "@/lib/config";

export function PostSchema({ post }: { post: Post }) {
  const cover = getPostCover(post);
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    dateModified: post.updatedOn,
    datePublished: post.publishedOn,
    description: post.description,
    headline: post.title,
    ...(cover ? { image: photoUrl(cover.url) } : {}),
    inLanguage: "ro",
    mainEntityOfPage: `${shopConfig.site.url}${getPostPath(post.slug)}`,
    publisher: { "@type": "Organization", name: shopConfig.site.name, url: shopConfig.site.url },
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}
