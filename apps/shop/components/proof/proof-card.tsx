import { cn } from "cn";
import Image from "next/image";

import { StudioLink } from "@/components/studio/studio-link";
import { Skeleton } from "@/components/ui/skeleton";
import { describeProof, formatApproval } from "@/lib/proof";
import type { ProofSummary } from "@/lib/proof/types";

interface ProofCardProps {
  proof: ProofSummary;
}

export function ProofCard({ proof }: ProofCardProps) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4">
      <ProofImage className="aspect-3/4 rounded-sm" fit="contain" proof={proof} />
      <div className="grid gap-2.5 text-sm">
        <p className="font-medium text-foreground">Designul vostru</p>
        <p className="text-muted-foreground">
          Bun de tipar aprobat pe {formatApproval(proof)}. Îl tipărim exact cum l-ați aprobat.
        </p>
        <StudioLink
          className="cursor-pointer justify-self-start text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
          path={`/design/${proof.designId}`}
        >
          Modificați designul
        </StudioLink>
      </div>
    </div>
  );
}

export function ProofCardSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-[5rem_1fr] items-start gap-4 rounded-md border border-border p-4"
    >
      <Skeleton className="aspect-3/4 rounded-sm" />
      <div className="grid gap-2.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10" />
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}

interface ProofImageProps {
  className?: string;
  fit: "contain" | "cover";
  proof: ProofSummary;
}

export function ProofImage({ className, fit, proof }: ProofImageProps) {
  return (
    <div className={cn("relative overflow-hidden bg-accent", className)}>
      {proof.image ? (
        <Image
          alt={`${describeProof(proof)}, cu detaliile voastre`}
          className="data-[fit=contain]:object-contain data-[fit=cover]:object-cover"
          data-fit={fit}
          fill
          sizes="100vw"
          src={proof.image}
          // The studio sized the picture when the couple approved it, and Convex serves it as is.
          unoptimized
        />
      ) : null}
    </div>
  );
}
