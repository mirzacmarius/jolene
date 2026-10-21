/**
 * Lifts jolene.ro's blog from its WordPress into blog/posts.json:
 *
 *   bun scripts/blog.ts
 *
 * It reads the posts from WordPress's REST API, finds each photo on
 * jolene.ro at its largest and measures it, and turns each post into the
 * shop's blocks. It needs jolene.ro to still serve WordPress, as does the
 * photo copy that then keeps the photos in the photo store.
 */
import { join } from "node:path";
import sharp from "sharp";
import type { Post } from "../src/blog";
import { catalog } from "../src/data";
import {
  liftPost,
  linkTarget,
  type MeasuredPhoto,
  parseHtml,
  postPhotoSources,
  type WordPressPost,
} from "../src/lift/posts";

const api = "https://jolene.ro/wp-json/wp/v2/posts";
const headers = { "user-agent": "Jolene blog lift (jolene.ro)" };

const posts: WordPressPost[] = [];
for (let page = 1, pages = 1; page <= pages; page++) {
  const response = await fetch(
    `${api}?per_page=100&page=${page}&_embed=wp:featuredmedia`,
    { headers },
  );
  if (!response.ok) throw new Error(`${response.status} for page ${page}`);
  pages = Number(response.headers.get("x-wp-totalpages") ?? 1);
  posts.push(...((await response.json()) as WordPressPost[]));
}

/** A photo's size, or null when jolene.ro has no such file. */
async function measure(url: string): Promise<MeasuredPhoto | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status} for ${url}`);
      const meta = await sharp(await response.arrayBuffer()).metadata();
      // The photo copy turns a photo upright, so its sides swap with it.
      const turned = (meta.orientation ?? 1) >= 5;
      return {
        url,
        width: (turned ? meta.height : meta.width) ?? 0,
        height: (turned ? meta.width : meta.height) ?? 0,
      };
    } catch (error) {
      if (attempt === 3) throw error;
      await Bun.sleep(attempt * 2000);
    }
  }
}

const sources = new Map<string, string[]>();
for (const post of posts)
  for (const [src, candidates] of postPhotoSources(post))
    sources.set(src, candidates);

const photos = new Map<string, MeasuredPhoto>();
const missing: string[] = [];
const queue = [...sources];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [src, candidates] = next;
      let found: MeasuredPhoto | null = null;
      for (const candidate of candidates) {
        found = await measure(candidate);
        if (found) break;
      }
      if (found) photos.set(src, found);
      else missing.push(src);
    }
  }),
);

const context = {
  catalog,
  slugs: new Set(posts.map(({ slug }) => slug)),
  photos,
};
const blog: Post[] = posts
  .map((post) => liftPost(post, context))
  .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
await Bun.write(
  join(import.meta.dir, "../blog/posts.json"),
  `${JSON.stringify(blog, null, 2)}\n`,
);

// The links that lead nowhere in the shop, which the lift leaves as text.
const dropped = new Set<string>();
for (const post of posts) {
  const walk = (node: ReturnType<typeof parseHtml>) => {
    for (const child of node.children) {
      if (typeof child === "string") continue;
      if (
        child.tag === "a" &&
        child.attrs.href &&
        !linkTarget(child.attrs.href, context)
      )
        dropped.add(`${post.slug}: ${child.attrs.href}`);
      walk(child);
    }
  };
  walk(parseHtml(post.content.rendered));
}

console.log(
  [
    `${blog.length} posts, ${photos.size} of their ${sources.size} photos found`,
    ...missing.map((src) => `not found: ${src}`),
    `${dropped.size} links left as text:`,
    ...[...dropped].sort(),
  ].join("\n"),
);
