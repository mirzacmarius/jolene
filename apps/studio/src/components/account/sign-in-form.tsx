"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { POLICIES } from "@/lib/shop";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { SIGN_IN_RETURN, useSignInReturn } from "./sign-in-return";

type Step = { kind: "email" } | { kind: "code"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINK = "underline underline-offset-4 hover:text-foreground";

/** Google's "G", as its sign-in buttons show it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Signs a visitor in with a code sent to their email (Convex Auth's email
 * provider, packages/backend/convex/auth.ts). Whatever they designed
 * anonymously in this browser moves to the account as they do. With
 * `google`, for the workshop's team, it offers their Google account first,
 * once the deployment has Google's client.
 */
export function SignInForm({
  lead,
  google = false,
}: {
  lead?: string;
  google?: boolean;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { signIn } = useAuthActions();
  const me = useQuery(api.accounts.me);
  const returned = useSignInReturn();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const emailId = useId();
  const codeId = useId();

  const explain = (error: unknown) => {
    const data = error instanceof ConvexError ? error.data : undefined;
    setProblem(
      data === "too-many"
        ? t("account.tooMany")
        : data === "email-unavailable"
          ? t("account.unavailable")
          : step.kind === "code"
            ? t("account.wrongCode")
            : t("common.error"),
    );
  };

  const sendCode = async (address: string) => {
    setPending(true);
    setProblem(null);
    try {
      await signIn("email", { email: address });
      setStep({ kind: "code", email: address });
      setCode("");
    } catch (error) {
      explain(error);
    } finally {
      setPending(false);
    }
  };

  const withGoogle = async () => {
    setPending(true);
    setProblem(null);
    try {
      // Google sends the browser back to this page, which then signs in.
      const back = new URL(window.location.href);
      back.searchParams.set(SIGN_IN_RETURN, "google");
      await signIn("google", { redirectTo: back.href });
    } catch (error) {
      explain(error);
      setPending(false);
    }
  };

  const onEmail = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setProblem(t("account.badEmail"));
      return;
    }
    void sendCode(address);
  };

  const onCode = async (event: FormEvent) => {
    event.preventDefault();
    if (step.kind !== "code") return;
    setPending(true);
    setProblem(null);
    try {
      await signIn("email", {
        email: step.email,
        code: code.replace(/\s/g, ""),
      });
    } catch (error) {
      explain(error);
      setPending(false);
    }
  };

  const unavailable = me !== undefined && !me.emailSignIn;
  const offerGoogle = google && me?.googleSignIn === true;
  // A Google account that came back refused, until something else goes wrong.
  const shown =
    problem ??
    (returned === "refused" && step.kind === "email"
      ? t("account.googleRefused")
      : null);

  return (
    <div className="max-w-md">
      <h2 className="font-display text-3xl">{t("account.signInTitle")}</h2>
      <p className="mt-2 text-muted-foreground">
        {lead ?? t("account.signInLead")}
      </p>
      {offerGoogle && step.kind === "email" ? (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void withGoogle()}
            className="mt-6"
          >
            <GoogleMark />
            {t("account.google")}
          </Button>
          {unavailable ? null : (
            <p className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("account.orByEmail")}
              <span className="h-px flex-1 bg-border" />
            </p>
          )}
        </>
      ) : null}
      {unavailable ? (
        <p className="mt-6 rounded-2xl bg-secondary px-4 py-3 text-sm">
          {t("account.unavailable")}
        </p>
      ) : step.kind === "email" ? (
        <form onSubmit={onEmail} className="mt-6 flex flex-col gap-3">
          <Label htmlFor={emailId}>{t("account.email")}</Label>
          <Input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("account.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={problem ? true : undefined}
            required
          />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : null}
            {pending ? t("account.sending") : t("account.sendCode")}
          </Button>
          {/* The shop's pages, on this address: the browser loads them whole. */}
          <p className="text-xs leading-snug text-muted-foreground">
            {t("account.legal", {
              terms: (
                <a href={POLICIES[locale].terms} className={LINK}>
                  {t("account.terms")}
                </a>
              ),
              privacy: (
                <a href={POLICIES[locale].privacy} className={LINK}>
                  {t("account.privacy")}
                </a>
              ),
            })}
          </p>
        </form>
      ) : (
        <form onSubmit={onCode} className="mt-6 flex flex-col gap-3">
          <p className="text-sm">
            {t("account.codeSent", { email: step.email })}
          </p>
          <Label htmlFor={codeId}>{t("account.code")}</Label>
          <Input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={9}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={problem ? true : undefined}
            className="max-w-48 text-lg tracking-[0.3em]"
            required
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {pending ? t("account.signingIn") : t("account.signIn")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void sendCode(step.email)}
            >
              {t("account.resend")}
            </Button>
            <Button
              type="button"
              variant="link"
              disabled={pending}
              onClick={() => {
                setStep({ kind: "email" });
                setProblem(null);
              }}
            >
              {t("account.otherEmail")}
            </Button>
          </div>
        </form>
      )}
      {shown ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {shown}
        </p>
      ) : null}
    </div>
  );
}
