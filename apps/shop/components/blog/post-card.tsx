import type { Post } from "@jolene/products/blog";
import { photoUrl } from "@jolene/products/photos";
import Image from "next/image";

import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Link } from "@/components/ui/link";
import { formatPostDate, getPostCover, getPostPath } from "@/lib/blog";

interface PostCardProps {
  loading?: "eager" | "lazy";
  post: Post;
}

export function PostCard({ loading = "lazy", post }: PostCardProps) {
  const cover = getPostCover(post);
  return (
    <article className="group relative grid content-start gap-4">
      <div className="relative aspect-4/3 overflow-hidden bg-accent">
        {cover ? (
          <Image
            alt={cover.alt}
            className="absolute inset-0 size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-103"
            fill
            loading={loading}
            sizes="100vw"
            src={photoUrl(cover.url)}
          />
        ) : (
          <ImagePlaceholder className="size-full" />
        )}
      </div>
      <div className="grid gap-2.5">
        <time className="text-xs text-muted-foreground" dateTime={post.publishedOn}>
          {formatPostDate(post.publishedOn)}
        </time>
        <h3 className="text-lg leading-snug font-medium">
          <Link className="after:absolute after:inset-0" href={getPostPath(post.slug)}>
            {post.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">{post.description}</p>
      </div>
    </article>
  );
}
