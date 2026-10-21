import { Suspense } from "react";
import {
  GuestLoading,
  GuestPage,
  type GuestRoute,
  guestMetadata,
} from "../../guest-page";

/** A family's own link: their name on the invitation, and their reply. */
export function generateMetadata(route: GuestRoute) {
  return guestMetadata(route);
}

export default function Page(route: GuestRoute) {
  return (
    <Suspense fallback={<GuestLoading />}>
      <GuestPage {...route} />
    </Suspense>
  );
}
