import { cn } from "cn";
import Image from "next/image";

import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Link } from "@/components/ui/link";
import type { CategoryWithThumbnail } from "@/lib/categories/types";

interface CategoryCardProps {
  category: CategoryWithThumbnail;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const { path, thumbnail, title } = category;
  return (
    <Link className={cn("flex h-full flex-col overflow-hidden", className)} href={path}>
      <div className="relative aspect-square overflow-hidden bg-accent">
        {thumbnail ? (
          <Image
            alt={thumbnail.altText || title}
            className="object-cover"
            fill
            sizes="100vw"
            src={thumbnail.url}
          />
        ) : (
          <ImagePlaceholder className="size-full" />
        )}
      </div>
      <h2 className="line-clamp-1 py-2.5 text-sm font-medium text-foreground">{title}</h2>
    </Link>
  );
}
