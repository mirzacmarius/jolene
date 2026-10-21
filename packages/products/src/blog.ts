/**
 * jolene.ro's blog, lifted from its WordPress by scripts/blog.ts and written
 * to blog/posts.json. The shop shows each post at the address it had on
 * jolene.ro, and the photo copy puts its photos in the photo store with the
 * catalog's.
 */
import posts from "../blog/posts.json";

/** One of jolene.ro's articles, under the address it had there. */
export type Post = {
  slug: string;
  title: string;
  /** When jolene.ro published it, and last changed it: YYYY-MM-DD. */
  publishedOn: string;
  updatedOn: string;
  /** A sentence or two for search results and the blog's list. */
  description: string;
  /** The picture WordPress showed with it in lists, if it had one. */
  photo?: PostPhoto;
  blocks: PostBlock[];
};

/** A photo from jolene.ro's uploads, at the size it was uploaded. */
export type PostPhoto = {
  url: string;
  alt: string;
  width: number;
  height: number;
  caption?: PostInline[];
};

/** A post's text, inside a block: words, emphasis, links and line breaks. */
export type PostInline =
  | string
  | { kind: "strong" | "em"; children: PostInline[] }
  | { kind: "link"; href: string; children: PostInline[] }
  | { kind: "break" };

export type PostBlock =
  | { kind: "paragraph"; children: PostInline[]; centered?: true }
  | {
      kind: "heading";
      level: 2 | 3 | 4;
      children: PostInline[];
      centered?: true;
    }
  | { kind: "list"; ordered: boolean; items: PostInline[][] }
  | { kind: "quote"; paragraphs: PostInline[][] }
  /** One photo, or a gallery of several. */
  | { kind: "photos"; photos: PostPhoto[] }
  | { kind: "table"; rows: PostInline[][][] }
  | { kind: "video"; url: string }
  | { kind: "rule" };

/** The blog's posts, newest first, as the lift last wrote them. */
export const blog = posts as Post[];

/** Every photo the blog shows, for the photo copy. */
export function blogPhotos(of: Post[] = blog): string[] {
  return of.flatMap((post) => [
    ...(post.photo ? [post.photo.url] : []),
    ...post.blocks.flatMap((block) =>
      block.kind === "photos" ? block.photos.map(({ url }) => url) : [],
    ),
  ]);
}
