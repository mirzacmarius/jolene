import type { Post, PostPhoto } from "@jolene/products/blog";

export const BLOG_PATH = "/blog";

const POST_DATE = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function formatPostDate(day: string): string {
  return POST_DATE.format(new Date(`${day}T00:00:00Z`));
}

// jolene.ro showed a post without a featured photo by its first one.
export function getPostCover(post: Post): PostPhoto | undefined {
  if (post.photo) return post.photo;
  for (const block of post.blocks) if (block.kind === "photos") return block.photos[0];
  return undefined;
}

// Posts keep the address they had on jolene.ro, which next.config.ts rewrites to the blog's route.
export function getPostPath(slug: string): string {
  return `/${slug}`;
}

export function isPostRoutePath(pathname: string): boolean {
  return pathname.startsWith(`${BLOG_PATH}/`);
}
