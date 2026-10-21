import type { Post, PostBlock, PostInline, PostPhoto } from "../blog";
import type { Catalog } from "../catalog";
import { decodeEntities, textOf } from "./text";

/** A post as WordPress's REST API gives it, with its featured image. */
export type WordPressPost = {
  slug: string;
  /** jolene.ro's time, without a zone: 2019-11-07T10:00:00. */
  date: string;
  modified: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    "wp:featuredmedia"?: { source_url?: string; alt_text?: string }[];
  };
};

/** A photo as the lift found it on jolene.ro: its full size and how big. */
export type MeasuredPhoto = { url: string; width: number; height: number };

export type PostContext = {
  catalog: Pick<Catalog, "categories" | "products">;
  /** Every post's slug, for links between posts. */
  slugs: Set<string>;
  /** Each photo by the address the post gave, once found and measured. */
  photos: Map<string, MeasuredPhoto>;
};

/** The shop's address for couples to write to, where jolene.ro had its contact page. */
const CONTACT = "mailto:invitatii.jolene@gmail.com";

const UPLOADS = "/wp-content/uploads/";

type Element = { tag: string; attrs: Record<string, string>; children: Node[] };
type Node = Element | string;

const isElement = (node: Node): node is Element => typeof node !== "string";

/** Tags that end an open paragraph, as a browser ends it: a gallery's div after WordPress's <p>. */
const endsParagraph = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "center",
  "details",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

/** Elements a paragraph inside them can't be ended from outside. */
const paragraphScope = new Set(["button", "caption", "table", "td", "th"]);

/** WordPress's HTML as a tree, its text and attributes decoded. */
export function parseHtml(html: string): Element {
  const root: Element = { tag: "#root", attrs: {}, children: [] };
  const open: Element[] = [root];
  const top = () => open[open.length - 1] as Element;
  const close = (node: Element) => {
    const at = open.lastIndexOf(node);
    if (at > 0) open.splice(at);
  };
  // A text can come in pieces, split anywhere, even inside &nbsp;.
  let text = "";
  new HTMLRewriter()
    .on("*", {
      element(element) {
        const tag = element.tagName.toLowerCase();
        if (endsParagraph.has(tag))
          for (let at = open.length - 1; at > 0; at--) {
            const { tag: parent } = open[at] as Element;
            if (paragraphScope.has(parent)) break;
            if (parent === "p") {
              open.splice(at);
              break;
            }
          }
        const node: Element = {
          tag,
          attrs: Object.fromEntries(
            [...element.attributes].map(([name, value]) => [
              name,
              decodeEntities(value),
            ]),
          ),
          children: [],
        };
        top().children.push(node);
        if (element.canHaveContent && !element.selfClosing) {
          open.push(node);
          element.onEndTag(() => close(node));
        }
      },
    })
    .onDocument({
      text(piece) {
        text += piece.text;
        if (!piece.lastInTextNode) return;
        if (text) top().children.push(decodeEntities(text));
        text = "";
      },
    })
    .transform(html);
  return root;
}

function findAll(node: Element, tag: string): Element[] {
  return node.children
    .filter(isElement)
    .flatMap((child) => [
      ...(child.tag === tag ? [child] : []),
      ...findAll(child, tag),
    ]);
}

const find = (node: Element, tag: string) => findAll(node, tag)[0];

/**
 * The addresses a photo may be found at, best first: the largest in its
 * srcset, the file its link opens, then its own address without the size
 * WordPress gave a smaller copy (a-768x1024.jpg is a.jpg), then as it is.
 */
export function photoCandidates(img: Element, link?: string): string[] {
  const src = img.attrs.src ?? "";
  const set = (img.attrs.srcset ?? "")
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url = "", width = ""]) => ({
      url,
      width: Number.parseInt(width, 10),
    }))
    .filter(({ url, width }) => url && Number.isFinite(width))
    .sort((a, b) => b.width - a.width);
  const isUpload = (url: string | undefined) =>
    url &&
    /^https:\/\/(www\.)?jolene\.ro\/wp-content\/uploads\/.+\.(jpe?g|png)$/i.test(
      url,
    );
  return [
    ...new Set(
      [
        set[0]?.url,
        isUpload(link) ? link : undefined,
        src.replace(/-\d+x\d+(\.\w+)$/, "$1"),
        src,
      ].filter((url): url is string => Boolean(isUpload(url))),
    ),
  ].map((url) => url.replace("://www.jolene.ro/", "://jolene.ro/"));
}

/** Every photo a post shows, by the address it gives, with where to look for it. */
export function postPhotoSources(post: WordPressPost): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  const featured = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  if (featured)
    sources.set(
      featured,
      photoCandidates({ tag: "img", attrs: { src: featured }, children: [] }),
    );
  const walk = (node: Element, link?: string) => {
    for (const child of node.children.filter(isElement)) {
      if (child.tag === "img" && child.attrs.src)
        sources.set(child.attrs.src, photoCandidates(child, link));
      walk(child, child.tag === "a" ? child.attrs.href : link);
    }
  };
  walk(parseHtml(post.content.rendered));
  return sources;
}

/**
 * Where a post's link goes in the shop: jolene.ro's products, categories,
 * posts and search at their new addresses, its contact page to Jolene's
 * email, anywhere else on the web as it was. Null for one of jolene.ro's
 * pages the shop has no place for, such as a photo's attachment page.
 */
export function linkTarget(
  href: string | undefined,
  context: PostContext,
): string | null {
  const trimmed = href?.trim();
  if (!trimmed) return null;
  if (/^(mailto|tel):/i.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed, "https://jolene.ro/");
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "jolene.ro" && url.hostname !== "www.jolene.ro")
    return url.href;

  const path = `${url.pathname.replace(/\/+$/, "")}/`;
  if (path.startsWith(UPLOADS)) return null;
  const query = url.searchParams.get("s")?.trim();
  if (path === "/" && query) return `/search?q=${encodeURIComponent(query)}`;
  if (path === "/") return "/";
  if (path.startsWith("/produs/")) {
    const product = context.catalog.products.find((p) => p.woo.path === path);
    return product ? `/products/${product.handle}` : null;
  }
  if (path.startsWith("/categorie-produs/")) {
    const handle = path.split("/").filter(Boolean).at(-1);
    return context.catalog.categories.some(
      (category) => category.handle === handle,
    )
      ? `/collections/${handle}`
      : null;
  }
  const slug = path.slice(1, -1);
  if (context.slugs.has(slug)) return `/${slug}`;
  if (slug === "shop-jolene") return "/collections/all";
  if (slug === "contact-jolene" || slug === "contact") return CONTACT;
  if (slug === "personalizare-invitatii-de-nunta") return "/studio";
  return null;
}

/** A YouTube video's own page, from the player WordPress embedded. */
function youtubePage(src: string | undefined): string | null {
  const id = src?.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/)?.[1];
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Inline content with its spaces collapsed and nothing empty left in it. */
function tidy(inlines: PostInline[]): PostInline[] {
  const out: PostInline[] = [];
  const text = (words: string) => {
    const last = out.at(-1);
    if (typeof last === "string")
      out[out.length - 1] = `${last}${words}`.replace(/\s+/g, " ");
    else if (words) out.push(words.replace(/\s+/g, " "));
  };
  for (const inline of inlines) {
    if (typeof inline === "string") text(inline);
    else if (inline.kind === "break") {
      if (out.length > 0 && !isBreak(out.at(-1))) out.push(inline);
    } else {
      const children = tidy(inline.children);
      // Bold or a link around nothing but a space leaves the space.
      if (children.some(hasText)) out.push({ ...inline, children });
      else if (children.length > 0) text(" ");
    }
  }
  while (isBreak(out.at(-1))) out.pop();
  return out;
}

const isBreak = (inline: PostInline | undefined) =>
  typeof inline === "object" && inline.kind === "break";

function hasText(inline: PostInline): boolean {
  if (typeof inline === "string") return inline.trim().length > 0;
  return inline.kind !== "break" && inline.children.some(hasText);
}

/** A run of inline content without spaces at its ends. */
function trim(inlines: PostInline[]): PostInline[] {
  const edge = (items: PostInline[], end: "start" | "end"): PostInline[] => {
    const index = end === "start" ? 0 : items.length - 1;
    const item = items[index];
    if (item === undefined) return items;
    let trimmed: PostInline | undefined;
    if (typeof item === "string") {
      const text = end === "start" ? item.trimStart() : item.trimEnd();
      trimmed = text || undefined;
    } else if (item.kind === "break") trimmed = undefined;
    else {
      const children = edge(item.children, end);
      trimmed = children.some(hasText) ? { ...item, children } : undefined;
    }
    const rest = items.filter((_, i) => i !== index);
    if (trimmed === undefined) return edge(rest, end);
    return end === "start" ? [trimmed, ...rest] : [...rest, trimmed];
  };
  return edge(edge(tidy(inlines), "start"), "end");
}

/** Whether WordPress centered a paragraph or heading, as it did a sample invitation's lines. */
function centered(node: Element): { centered?: true } {
  const isCentered =
    /\bhas-text-align-center\b/.test(node.attrs.class ?? "") ||
    /text-align:\s*center/.test(node.attrs.style ?? "");
  return isCentered ? { centered: true } : {};
}

/** Splits an element where it holds photos: the text before, each photo, the text after. */
function splitAtPhotos(node: Element): Element[] {
  const parts: Element[] = [];
  let current: Element = { ...node, children: [] };
  for (const child of node.children) {
    if (!isElement(child) || (child.tag !== "img" && !find(child, "img"))) {
      current.children.push(child);
      continue;
    }
    for (const part of child.tag === "img" ? [child] : splitAtPhotos(child)) {
      if (part.tag === "img") {
        parts.push(current, part);
        current = { ...node, children: [] };
      } else current.children.push(part);
    }
  }
  parts.push(current);
  return parts;
}

class PostLift {
  constructor(
    private readonly context: PostContext,
    private readonly title: string,
    /** The level each of the post's heading tags takes, from headingLevels. */
    private readonly levels = new Map<string, 2 | 3 | 4>(),
  ) {}

  photo(img: Element, caption?: PostInline[]): PostPhoto | null {
    const found = this.context.photos.get(img.attrs.src ?? "");
    if (!found) return null;
    const alt =
      (img.attrs.alt ?? "").replace(/[_\s]+/g, " ").trim() || this.title;
    return { ...found, alt, ...(caption?.length ? { caption } : {}) };
  }

  /** A block's text, without spaces at its ends. */
  inline(nodes: Node[]): PostInline[] {
    return trim(this.run(nodes));
  }

  /** Text as the post wrote it, spaces kept where a tag meets the words around it. */
  private run(nodes: Node[]): PostInline[] {
    const out: PostInline[] = [];
    for (const node of nodes) {
      if (!isElement(node)) {
        out.push(node);
        continue;
      }
      switch (node.tag) {
        case "strong":
        case "b":
          out.push({ kind: "strong", children: this.run(node.children) });
          break;
        case "em":
        case "i":
          out.push({ kind: "em", children: this.run(node.children) });
          break;
        case "a": {
          const href = linkTarget(node.attrs.href, this.context);
          const children = this.run(node.children);
          if (href) out.push({ kind: "link", href, children });
          else out.push(...children);
          break;
        }
        case "br":
          out.push({ kind: "break" });
          break;
        case "button":
        case "iframe":
        case "img":
        case "noscript":
        case "script":
        case "style":
          break;
        case "abbr":
        case "font":
        case "mark":
        case "small":
        case "span":
        case "sub":
        case "sup":
        case "u":
          out.push(...this.run(node.children));
          break;
        default:
          // A block inside the text, such as a list item's paragraph, keeps its words apart from the next.
          out.push(" ", ...this.run(node.children), " ");
      }
    }
    return out;
  }

  /** A photo's caption, unless it's only a file's name, such as Jolene_invitatie_nunta. */
  private caption(figcaption: Element): PostInline[] | undefined {
    const caption = this.inline(figcaption.children);
    const [only] = caption;
    if (
      caption.length === 1 &&
      typeof only === "string" &&
      /^[\w-]+$/.test(only) &&
      only.includes("_")
    )
      return undefined;
    return caption;
  }

  photos(node: Element, caption?: PostInline[]): PostPhoto[] {
    if (node.tag === "img") {
      const photo = this.photo(node, caption);
      return photo ? [photo] : [];
    }
    if (!find(node, "img")) return [];
    const own =
      findAll(node, "img").length === 1
        ? node.children.find(
            (child) => isElement(child) && child.tag === "figcaption",
          )
        : undefined;
    const ownCaption = own && isElement(own) ? this.caption(own) : undefined;
    return node.children
      .filter(isElement)
      .filter((child) => child.tag !== "figcaption")
      .flatMap((child) =>
        this.photos(child, ownCaption?.length ? ownCaption : caption),
      );
  }

  /** A paragraph, heading or list item's text as blocks, its photos between them. */
  private textWithPhotos(
    node: Element,
    make: (children: PostInline[]) => PostBlock,
  ): PostBlock[] {
    return splitAtPhotos(node).flatMap((part): PostBlock[] => {
      if (part.tag === "img") {
        const photos = this.photos(part);
        return photos.length ? [{ kind: "photos", photos }] : [];
      }
      const children = this.inline(part.children);
      return children.some(hasText) ? [make(children)] : [];
    });
  }

  figure(node: Element): PostBlock[] {
    const iframe = find(node, "iframe");
    if (iframe) {
      const url = youtubePage(iframe.attrs.src);
      return url ? [{ kind: "video", url }] : [];
    }
    const table = find(node, "table");
    if (table) return this.table(table);
    const quote = find(node, "blockquote");
    if (quote) return this.quote(quote);
    if (!find(node, "img")) return this.blocks(node.children);
    const photos = this.photos(node);
    return photos.length ? [{ kind: "photos", photos }] : [];
  }

  table(node: Element): PostBlock[] {
    const rows = findAll(node, "tr")
      .map((row) =>
        row.children
          .filter(isElement)
          .filter((cell) => cell.tag === "td" || cell.tag === "th")
          .map((cell) => this.inline(cell.children)),
      )
      .filter((row) => row.some((cell) => cell.some(hasText)));
    return rows.length ? [{ kind: "table", rows }] : [];
  }

  quote(node: Element): PostBlock[] {
    const paragraphs = this.blocks(node.children)
      .flatMap((block) => (block.kind === "paragraph" ? [block.children] : []))
      .filter((paragraph) => paragraph.some(hasText));
    return paragraphs.length ? [{ kind: "quote", paragraphs }] : [];
  }

  list(node: Element): PostBlock[] {
    const items = node.children
      .filter(isElement)
      .filter((item) => item.tag === "li")
      .map((item) => this.inline(item.children))
      .filter((item) => item.some(hasText));
    return items.length
      ? [{ kind: "list", ordered: node.tag === "ol", items }]
      : [];
  }

  blocks(nodes: Node[]): PostBlock[] {
    const blocks: PostBlock[] = [];
    let loose: Node[] = [];
    const flush = () => {
      if (loose.length === 0) return;
      blocks.push(...this.paragraph({ tag: "p", attrs: {}, children: loose }));
      loose = [];
    };
    for (const node of nodes) {
      if (!isElement(node)) {
        loose.push(node);
        continue;
      }
      switch (node.tag) {
        case "p":
          flush();
          blocks.push(...this.paragraph(node));
          break;
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          flush();
          blocks.push(...this.heading(node));
          break;
        case "ul":
        case "ol":
          flush();
          blocks.push(...this.list(node));
          break;
        case "blockquote":
          flush();
          blocks.push(...this.quote(node));
          break;
        case "figure":
          flush();
          blocks.push(...this.figure(node));
          break;
        case "table":
          flush();
          blocks.push(...this.table(node));
          break;
        case "hr":
          flush();
          blocks.push({ kind: "rule" });
          break;
        case "img":
        case "iframe":
          flush();
          blocks.push(
            ...this.figure({ tag: "figure", attrs: {}, children: [node] }),
          );
          break;
        case "button":
        case "form":
        case "noscript":
        case "script":
        case "style":
        case "video":
          break;
        case "center":
        case "dd":
        case "div":
        case "dl":
        case "dt":
        case "section":
          flush();
          blocks.push(...this.blocks(node.children));
          break;
        default:
          loose.push(node);
      }
    }
    flush();
    return blocks;
  }

  paragraph(node: Element): PostBlock[] {
    return this.textWithPhotos(node, (children) => ({
      kind: "paragraph",
      children,
      ...centered(node),
    }));
  }

  heading(node: Element): PostBlock[] {
    const level = this.levels.get(node.tag) ?? 4;
    return this.textWithPhotos(node, (children) => {
      const [only] = children;
      const plain =
        children.length === 1 &&
        typeof only === "object" &&
        only.kind === "strong"
          ? only.children
          : children;
      return { kind: "heading", level, children: plain, ...centered(node) };
    });
  }
}

/**
 * The level each heading tag a post uses takes in the shop, its biggest the
 * page's second after the title: jolene.ro's posts mostly put their
 * sections in h4s.
 */
function headingLevels(content: Element): Map<string, 2 | 3 | 4> {
  const used = ["h1", "h2", "h3", "h4", "h5", "h6"].filter((tag) =>
    find(content, tag),
  );
  return new Map(
    used.map((tag, rank) => [tag, Math.min(rank + 2, 4) as 2 | 3 | 4]),
  );
}

/** Text from HTML, without the […] WordPress ends an excerpt with. */
function plainText(html: string): string {
  return textOf(html)
    .replace(/\[\s*(…|\.\.\.)\s*\]/g, "")
    .trim();
}

/** At most `max` characters, cut at a word with an ellipsis. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** A post of jolene.ro's blog as the shop shows it. */
export function liftPost(post: WordPressPost, context: PostContext): Post {
  const title = plainText(post.title.rendered);
  const content = parseHtml(post.content.rendered);
  const lift = new PostLift(context, title, headingLevels(content));
  const featured = post._embedded?.["wp:featuredmedia"]?.[0];
  const photo = featured?.source_url
    ? lift.photo({
        tag: "img",
        attrs: { src: featured.source_url, alt: featured.alt_text ?? "" },
        children: [],
      })
    : null;
  return {
    slug: post.slug,
    title,
    publishedOn: post.date.slice(0, 10),
    updatedOn: post.modified.slice(0, 10),
    description: shorten(plainText(post.excerpt.rendered), 160),
    ...(photo ? { photo } : {}),
    blocks: lift.blocks(content.children),
  };
}
