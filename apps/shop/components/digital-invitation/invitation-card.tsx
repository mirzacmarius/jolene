import { StudioLink } from "@/components/studio/studio-link";
import { StudioPicture } from "@/components/studio/studio-picture";
import { Skeleton } from "@/components/ui/skeleton";
import { describeInvitation } from "@/lib/digital-invitation";
import type { InvitationSummary } from "@/lib/digital-invitation/types";

interface InvitationCardProps {
  eventId: string;
  invitation: InvitationSummary;
}

export function InvitationCard({ eventId, invitation }: InvitationCardProps) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4">
      <InvitationImage className="aspect-3/4 rounded-sm" fit="contain" invitation={invitation} />
      <div className="grid gap-2.5 text-sm">
        <div className="grid gap-1">
          <p className="font-medium text-foreground">Invitația voastră digitală</p>
          <p className="text-muted-foreground">{describeInvitation(invitation)}</p>
        </div>
        <p className="text-muted-foreground">
          {invitation.unlocked
            ? "E deja deblocată, deci nu mai trebuie cumpărată: o puteți trimite tuturor invitaților."
            : "După plată, o puteți trimite tuturor invitaților și le vedeți confirmările în studio."}
        </p>
        <StudioLink
          className="cursor-pointer justify-self-start text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
          path={`/invitatie-digitala/${eventId}`}
        >
          Înapoi la lista de invitați
        </StudioLink>
      </div>
    </div>
  );
}

export function InvitationCardSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4"
    >
      <Skeleton className="aspect-3/4 rounded-sm" />
      <div className="grid gap-2.5">
        <div className="grid gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10" />
        <Skeleton className="h-5 w-44" />
      </div>
    </div>
  );
}

interface InvitationImageProps {
  className?: string;
  fit: "contain" | "cover";
  invitation: InvitationSummary;
}

export function InvitationImage({ className, fit, invitation }: InvitationImageProps) {
  return (
    <StudioPicture
      alt={`Invitația digitală: ${describeInvitation(invitation)}`}
      className={className}
      fit={fit}
      src={invitation.image}
    />
  );
}
