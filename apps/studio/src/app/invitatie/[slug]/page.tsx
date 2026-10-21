import { Suspense } from "react";
import {
  GuestLoading,
  GuestPage,
  type GuestRoute,
  guestMetadata,
} from "../guest-page";

/** The invitation's open link: anyone with it can reply, once it's open. */
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
