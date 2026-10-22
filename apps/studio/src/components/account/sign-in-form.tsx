"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { POLICIES } from "@/lib/shop";
import { useCurrentLocale, useI18n } from "@/locales/client";

type Step = { kind: "email" } | { kind: "code"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINK = "underline underline-offset-4 hover:text-foreground";

/**
 * Signs a visitor in with a code sent to their email (Convex Auth's email
 * provider, packages/backend/convex/auth.ts). Whatever they designed
 * anonymously in this browser moves to the account as they do.
 */
export function SignInForm({ lead }: { lead?: string }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { signIn } = useAuthActions();
  const me = useQuery(api.accounts.me);
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ReactNode>(null);
  const emailId = useId();
  const codeId = useId();

  const explain = (error: unknown) => {
    const data = error instanceof ConvexError ? error.data : undefined;
    setProblem(
      data === "too-many"
        ? t("account.tooMany")
        : data === "email-unavailable"
          ? t("account.unavailable")
          : data === "use-google"
            ? t("account.useGoogle", {
                workshop: (
                  <Link href="/studio/atelier" className={LINK}>
                    {t("account.workshop")}
                  </Link>
                ),
              })
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

  return (
    <div className="max-w-md">
      <h2 className="font-display text-3xl">{t("account.signInTitle")}</h2>
      <p className="mt-2 text-muted-foreground">
        {lead ?? t("account.signInLead")}
      </p>
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
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
