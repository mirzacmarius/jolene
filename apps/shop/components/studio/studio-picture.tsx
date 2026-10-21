import { cn } from "cn";
import Image from "next/image";

interface StudioPictureProps {
  alt: string;
  className?: string;
  fit: "contain" | "cover";
  src: string | null;
}

export function StudioPicture({ alt, className, fit, src }: StudioPictureProps) {
  return (
    <div className={cn("relative overflow-hidden bg-accent", className)}>
      {src ? (
        <Image
          alt={alt}
          className="data-[fit=contain]:object-contain data-[fit=cover]:object-cover"
          data-fit={fit}
          fill
          sizes="100vw"
          src={src}
          // The studio sizes its pictures when it draws them, and Convex serves them as they are.
          unoptimized
        />
      ) : null}
    </div>
  );
}
