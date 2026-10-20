"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { toast } from "@jolene/ui/toaster";
import { useConvexAuth, useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

/**
 * Starts a design from a template and opens it. A first-time visitor is signed
 * in anonymously on the way, so nobody fills in a form before they design.
 */
export function StartDesignButton({
  template,
  children,
  ...props
}: { template: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const t = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const start = useMutation(api.designs.start);
  const [pending, setPending] = useState(false);
  // One design per click, however often the effect below runs.
  const requested = useRef(false);

  const fail = () => {
    requested.current = false;
    setPending(false);
    toast.error(t("common.error"));
  };

  // The design starts once the session is in place: a mutation sent while a
  // new session is still being set up would arrive signed out.
  useEffect(() => {
    if (!pending || !isAuthenticated || requested.current) return;
    requested.current = true;
    start({ template })
      .then((designId) => router.push(`/studio/design/${designId}`))
      .catch(fail);
  });

  const onClick = () => {
    setPending(true);
    if (!isAuthenticated) signIn("anonymous").catch(fail);
  };

  return (
    <Button {...props} onClick={onClick} disabled={pending || props.disabled}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
