"use client";

import { cn } from "cn";
import Image, { getImageProps } from "next/image";
import { useEffect, useState } from "react";
import { preload } from "react-dom";

import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import type { Image as ImageType } from "@/lib/media/types";

import { Lightbox, LightboxTrigger } from "./lightbox";

// The LCP image gets a preload link + eager + fetchpriority=high (`preload` alone no longer implies high).
// Everything else stays lazy so the hidden viewport twin (mobile carousel vs desktop grid) never downloads.
const LCP_IMAGE_PROPS = { fetchPriority: "high", loading: "eager", preload: true } as const;

const LAZY_IMAGE_PROPS = { loading: "lazy" } as const;

// Tailwind `lg`, where the 2x2 grid replaces the carousel.
const DESKTOP_MEDIA = "(min-width: 1024px)";
// The 2x2 desktop grid is entirely above the fold, so desktop preloads all four tiles at parse time.
const DESKTOP_GRID_PRELOAD_COUNT = 4;

function preloadDesktopGridImage(image: ImageType) {
  const { props } = getImageProps({ alt: "", fill: true, sizes: "100vw", src: image.url });
  preload(props.src, {
    as: "image",
    imageSizes: props.sizes,
    imageSrcSet: props.srcSet,
    media: DESKTOP_MEDIA,
  });
}

interface MediaImageProps {
  image: ImageType;
  index: number;
  priority: boolean;
  title: string;
}

function MediaImage({ image, index, priority, title }: MediaImageProps) {
  return (
    <Image
      alt={image.altText || `${title}, fotografia ${index + 1}`}
      className="absolute inset-0 size-full object-cover"
      draggable={false}
      fill
      sizes="100vw"
      src={image.url}
      {...(priority ? LCP_IMAGE_PROPS : LAZY_IMAGE_PROPS)}
    />
  );
}

function Carousel({ images, title }: { images: ImageType[]; title: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const count = Math.max(1, images.length);

  function scrollToImage(index: number) {
    container?.scrollTo({ behavior: "smooth", left: index * container.offsetWidth });
    setSelectedIndex(index);
  }

  useEffect(() => {
    if (!container) return;
    const sync = () => {
      const width = container.offsetWidth;
      if (width === 0) return;
      setSelectedIndex(Math.min(Math.round(container.scrollLeft / width), count - 1));
    };
    container.addEventListener("scroll", sync, { passive: true });
    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(container);
    return () => {
      container.removeEventListener("scroll", sync);
      resizeObserver.disconnect();
    };
  }, [container, count]);

  return (
    <div className="grid gap-5">
      <div
        className="relative -mx-5 flex w-[calc(100%+2.5rem)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        ref={setContainer}
        style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
      >
        {images.length ? (
          images.map((image, index) => (
            <div
              className="relative aspect-square w-full shrink-0 snap-start snap-always overflow-hidden"
              key={image.url}
            >
              <MediaImage image={image} index={index} priority={index === 0} title={title} />
            </div>
          ))
        ) : (
          <ImagePlaceholder className="aspect-square w-full shrink-0" />
        )}
      </div>
      <div className={cn("flex justify-center gap-2", count <= 1 && "invisible")}>
        {Array.from({ length: count }, (_, index) => (
          <button
            aria-label={`Fotografia ${index + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === selectedIndex
                ? "w-8 bg-foreground"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
            key={index}
            onClick={() => scrollToImage(index)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

function Grid({ images, title }: { images: ImageType[]; title: string }) {
  for (const [index, image] of images.entries()) {
    if (index >= DESKTOP_GRID_PRELOAD_COUNT) break;
    // The first tile is the LCP image, already preloaded through next/image's `preload` prop.
    if (index > 0) preloadDesktopGridImage(image);
  }
  if (!images.length) return <ImagePlaceholder className="aspect-square w-full" />;
  return (
    <Lightbox label={title}>
      <div className="grid grid-cols-2 gap-2.5">
        {images.map((image, index) => (
          <div className="relative aspect-square w-full overflow-hidden" key={image.url}>
            <LightboxTrigger image={image}>
              <MediaImage image={image} index={index} priority={index === 0} title={title} />
            </LightboxTrigger>
          </div>
        ))}
      </div>
    </Lightbox>
  );
}

interface ProductMediaProps {
  className?: string;
  images: ImageType[];
  title: string;
}

export function ProductMedia({ className, images, title }: ProductMediaProps) {
  return (
    <div className={className}>
      <div className="lg:hidden">
        <Carousel images={images} title={title} />
      </div>
      <div className="hidden lg:block">
        <Grid images={images} title={title} />
      </div>
    </div>
  );
}
