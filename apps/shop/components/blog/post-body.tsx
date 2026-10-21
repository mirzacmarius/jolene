import type { PostBlock, PostInline, PostPhoto } from "@jolene/products/blog";
import { photoUrl } from "@jolene/products/photos";
import { cn } from "cn";
import Image from "next/image";

import { Link } from "@/components/ui/link";

interface PostBodyProps {
  blocks: PostBlock[];
}

export function PostBody({ blocks }: PostBodyProps) {
  return (
    <div className="prose min-w-0 max-w-none prose-stone prose-headings:font-medium prose-a:underline-offset-4 prose-li:my-1">
      {blocks.map((block, index) => (
        <Block block={block} first={index === 0} key={index} />
      ))}
    </div>
  );
}

function Block({ block, first }: { block: PostBlock; first: boolean }) {
  switch (block.kind) {
    case "heading": {
      const Heading = `h${block.level}` as const;
      return (
        <Heading className={block.centered ? "text-center" : undefined}>
          <Inlines inlines={block.children} />
        </Heading>
      );
    }
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inlines inlines={item} />
            </li>
          ))}
        </List>
      );
    }
    case "paragraph":
      return (
        <p className={block.centered ? "text-center" : undefined}>
          <Inlines inlines={block.children} />
        </p>
      );
    case "photos":
      return <Photos eager={first} photos={block.photos} />;
    case "quote":
      return (
        <blockquote>
          {block.paragraphs.map((paragraph, index) => (
            <p key={index}>
              <Inlines inlines={paragraph} />
            </p>
          ))}
        </blockquote>
      );
    case "rule":
      return <hr />;
    case "table":
      return (
        <table>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>
                    <Inlines inlines={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "video":
      return (
        <p>
          <a href={block.url} rel="noopener noreferrer" target="_blank">
            Vezi filmul pe YouTube
          </a>
        </p>
      );
  }
}

function Photos({ eager, photos }: { eager: boolean; photos: PostPhoto[] }) {
  return (
    <div
      className={cn("not-prose my-8 grid gap-2.5", photos.length > 1 && "grid-cols-2")}
      data-slot="post-photos"
    >
      {photos.map((photo, index) => (
        <figure className="grid content-start gap-2.5" key={`${photo.url}-${index}`}>
          <Image
            alt={photo.alt}
            className="h-auto w-full bg-accent"
            height={photo.height}
            loading={eager && index === 0 ? "eager" : "lazy"}
            sizes="100vw"
            src={photoUrl(photo.url)}
            width={photo.width}
          />
          {photo.caption ? (
            <figcaption className="text-center text-sm text-muted-foreground">
              <Inlines inlines={photo.caption} />
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function Inlines({ inlines }: { inlines: PostInline[] }) {
  return inlines.map((inline, index) => <Inline inline={inline} key={index} />);
}

function Inline({ inline }: { inline: PostInline }) {
  if (typeof inline === "string") return inline;
  switch (inline.kind) {
    case "break":
      return <br />;
    case "em":
      return (
        <em>
          <Inlines inlines={inline.children} />
        </em>
      );
    case "link":
      // /studio belongs to the designer, another app on this address, which a plain link loads.
      return inline.href.startsWith("/") && !inline.href.startsWith("/studio") ? (
        <Link href={inline.href}>
          <Inlines inlines={inline.children} />
        </Link>
      ) : (
        <a href={inline.href}>
          <Inlines inlines={inline.children} />
        </a>
      );
    case "strong":
      return (
        <strong>
          <Inlines inlines={inline.children} />
        </strong>
      );
  }
}
