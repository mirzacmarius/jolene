"use client";

import { type ComponentProps } from "react";

import {
  InvitationCard,
  InvitationCardSkeleton,
} from "@/components/digital-invitation/invitation-card";
import { BuyButtons } from "@/components/product-detail/buy-buttons";
import { StudioLink } from "@/components/studio/studio-link";
import { Link } from "@/components/ui/link";
import { useCart } from "@/lib/cart/client";
import { getInvitationAttributes, getLineEventId } from "@/lib/digital-invitation";
import { useEventInvitation } from "@/lib/digital-invitation/client";

type InvitationBuyButtonsProps = Pick<
  ComponentProps<typeof BuyButtons>,
  "availableForSale" | "fallbackVariant"
>;

const LINK_CLASS =
  "cursor-pointer text-foreground underline underline-offset-4 transition-opacity hover:opacity-70";

export function InvitationBuyButtons(props: InvitationBuyButtonsProps) {
  const { eventId, invitation } = useEventInvitation();
  const isInCart = useCart((state) =>
    state.data.lines.nodes.some(
      (line) => eventId !== undefined && getLineEventId(line.attributes ?? []) === eventId,
    ),
  );
  return (
    <div className="grid gap-5">
      {eventId && invitation ? (
        <InvitationCard eventId={eventId} invitation={invitation} />
      ) : invitation === undefined ? (
        <InvitationCardSkeleton />
      ) : null}
      {!eventId ? (
        <p className="text-sm text-muted-foreground" role="status">
          Invitația digitală se cumpără din studio, de pe pagina ei, ca să știm pentru ce eveniment
          este.{" "}
          <StudioLink className={LINK_CLASS} path="/cont">
            Deschideți studioul
          </StudioLink>
        </p>
      ) : invitation === null ? (
        <p className="text-sm text-muted-foreground" role="status">
          Nu găsim invitația aceasta. Deschideți-o din nou din studio și apăsați pe „Deblocați-o”.
        </p>
      ) : isInCart && !invitation?.unlocked ? (
        <p className="text-sm text-muted-foreground" role="status">
          Invitația e deja în coș.{" "}
          <Link className={LINK_CLASS} href="/cart">
            Vedeți coșul
          </Link>
        </p>
      ) : null}
      <BuyButtons
        {...props}
        attributes={
          eventId && invitation ? getInvitationAttributes(eventId, invitation) : undefined
        }
        // Shop Pay's buy-now link skips the cart, and with it the event the invitation is for.
        buyWithShop={false}
        disabled={!eventId || !invitation || invitation.unlocked || isInCart}
        quantityPicker={false}
      />
    </div>
  );
}
