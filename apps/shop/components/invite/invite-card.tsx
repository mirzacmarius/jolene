import { cn } from "cn";
import Image from "next/image";

import { StudioLink } from "@/components/studio/studio-link";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { describeEvent } from "@/lib/invite";
import type { InviteEvent } from "@/lib/invite/types";

const LINK_CLASS =
  "cursor-pointer justify-self-start text-foreground underline underline-offset-4 transition-opacity hover:opacity-70";

interface InviteCardProps {
  event: InviteEvent;
}

export function InviteCard({ event }: InviteCardProps) {
  const about = describeEvent(event);
  return (
    <div className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4">
      <InviteImage className="aspect-3/4 rounded-sm" event={event} />
      <div className="grid gap-2.5 text-sm">
        <p className="font-medium text-foreground">Invitația voastră</p>
        {about ? <p className="text-muted-foreground">{about}</p> : null}
        <p className="text-muted-foreground">
          {event.unlocked
            ? "E deschisă deja tuturor invitaților: nu mai e nimic de plătit."
            : "Odată plătită, o pot deschide toate familiile din listă."}
        </p>
        <StudioLink className={LINK_CLASS} path={`/invitatie-digitala/${event.id}`}>
          Înapoi la invitație
        </StudioLink>
      </div>
    </div>
  );
}

// The studio's link carries the event; without one, the page can't say whose invitation it would unlock.
export function InviteCardMissing() {
  return (
    <div className="grid gap-2.5 rounded-md border border-border p-4 text-sm">
      <p className="font-medium text-foreground">Se cumpără din studio, pentru invitația voastră</p>
      <p className="text-muted-foreground">
        Apăsați „Deblocați-o” pe pagina invitației digitale, în studio: butonul vă aduce aici, cu
        invitația voastră.
      </p>
      <StudioLink className={LINK_CLASS} path="/designurile-mele">
        Designurile mele
      </StudioLink>
    </div>
  );
}

export function InviteCardSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4"
    >
      <Skeleton className="aspect-3/4 rounded-sm" />
      <div className="grid gap-2.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10" />
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}

interface InviteImageProps {
  className?: string;
  event: Pick<InviteEvent, "image"> | null;
}

export function InviteImage({ className, event }: InviteImageProps) {
  if (!event?.image) return <ImagePlaceholder className={className} />;
  return (
    <div className={cn("relative overflow-hidden bg-accent", className)}>
      <Image
        alt="Invitația voastră, cum o văd invitații"
        className="object-contain"
        fill
        sizes="100vw"
        src={event.image}
        // The studio sized the picture when the couple published it, and Convex serves it as is.
        unoptimized
      />
    </div>
  );
}
