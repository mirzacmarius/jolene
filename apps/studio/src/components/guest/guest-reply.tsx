"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { repliesClosed } from "@jolene/backend/convex/invites/rules";
import type {
  Questions,
  Reply,
} from "@jolene/backend/convex/invites/validators";
import type { Fields, Language } from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { plainDate } from "@/lib/programme";
import { useI18n } from "@/locales/client";
import { ReplyForm, useReplyLine } from "./reply-form";
import { forget, recall, remember } from "./visit";

/**
 * Where a family answers: the form, until they have, then their reply with
 * a way to change it, until the reply date. Through the open link the
 * family joins the couple's list as they reply, and the page moves to their
 * own link, where they can come back to change it.
 */
export function GuestReply({
  slug,
  language,
  fields,
  hosts,
  questions,
  household,
}: {
  slug: string;
  language: Language;
  fields: Fields;
  hosts: string;
  questions: Questions;
  household: {
    name: string;
    code: string;
    seats: number;
    plusOne: boolean;
    reply: Reply | null;
  } | null;
}) {
  const t = useI18n();
  const router = useRouter();
  const reply = useMutation(api.guests.reply);
  const join = useMutation(api.guests.join);
  const replyLine = useReplyLine();
  const [editing, setEditing] = useState(false);
  const [thanks, setThanks] = useState<boolean | null>(null);
  const [closedNow, setClosedNow] = useState(false);
  const section = useRef<HTMLElement>(null);
  const code = household?.code;

  // A family who just replied through the open link lands here, on their
  // own link: thank them as the open link would have, where they replied.
  useEffect(() => {
    const replied = code ? recall("replied", slug, code) : null;
    if (!replied) return;
    forget("replied", slug, code);
    setThanks(replied === "yes");
    // A frame later, once the page has dropped the envelope's closed view.
    requestAnimationFrame(() =>
      section.current?.scrollIntoView({ block: "start" }),
    );
  }, [slug, code]);
  const by = fields.rsvpBy?.trim();
  const contact = fields.rsvpContact?.trim();
  const closed = closedNow || repliesClosed(fields, Date.now());
  const answer = household?.reply ?? null;

  const closedNote = (
    <div className="flex flex-col gap-1 text-muted-foreground">
      {by ? (
        <p>{t("guest.closed", { date: plainDate(by, language) })}</p>
      ) : null}
      {contact ? <p>{t("guest.closedContact", { contact })}</p> : null}
    </div>
  );

  const summary = answer ? (
    <div className="flex flex-col gap-2 rounded-3xl border border-border/80 bg-card p-6">
      <p className="text-sm text-muted-foreground">{t("guest.yourReply")}</p>
      <p className="font-display text-2xl">{replyLine(answer)}</p>
      {answer.coming && answer.guests.some((guest) => guest.meal) ? (
        <ul className="text-sm text-muted-foreground">
          {answer.guests.map((guest, index) =>
            guest.meal ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reply's guests have no ids, and the list is only read
              <li key={index}>
                {guest.name || t("guest.person", { number: index + 1 })}:{" "}
                {guest.meal}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      {answer.message ? (
        <p className="mt-2 whitespace-pre-line italic">“{answer.message}”</p>
      ) : null}
    </div>
  ) : null;

  let body: ReactNode;
  if (closed)
    body = (
      <div className="flex flex-col gap-6">
        {summary}
        {closedNote}
      </div>
    );
  else if (thanks !== null && !editing)
    body = (
      <div className="flex flex-col items-start gap-6">
        <p className="font-display text-3xl">
          {thanks
            ? hosts
              ? t("guest.thanksYes", { hosts })
              : t("guest.thanksYesUnnamed")
            : t("guest.thanksNo")}
        </p>
        {summary}
        {household ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {t("guest.change")}
          </Button>
        ) : null}
      </div>
    );
  else if (answer && !editing)
    body = (
      <div className="flex flex-col items-start gap-6">
        {summary}
        <Button variant="outline" onClick={() => setEditing(true)}>
          {t("guest.change")}
        </Button>
      </div>
    );
  else
    body = (
      <div className="flex flex-col gap-6">
        {by ? (
          <p className="text-muted-foreground">
            {t("guest.replyBy", { date: plainDate(by, language) })}
          </p>
        ) : null}
        <ReplyForm
          family={household}
          questions={questions}
          hosts={hosts}
          initial={answer}
          allergiesHint={
            hosts
              ? t("guest.allergiesHint", { hosts })
              : t("guest.allergiesHintUnnamed")
          }
          onCancel={answer ? () => setEditing(false) : undefined}
          onSubmit={async (input, name) => {
            try {
              if (household)
                await reply({ slug, code: household.code, reply: input });
              else {
                const joined = await join({
                  slug,
                  name,
                  reply: input,
                  language,
                });
                // Their own link, to come back to and change the reply.
                remember("opened", slug, joined);
                remember("replied", slug, joined, input.coming ? "yes" : "no");
                router.replace(
                  `${window.location.pathname.replace(/\/$/, "")}/${joined}`,
                  // The page there scrolls to the reply itself.
                  { scroll: false },
                );
                return;
              }
            } catch (error) {
              if (errorCode(error) === "reply-closed") {
                setClosedNow(true);
                return;
              }
              throw error;
            }
            setThanks(input.coming);
            setEditing(false);
          }}
        />
      </div>
    );

  return (
    <section
      ref={section}
      id="confirmare"
      className="mx-auto w-full max-w-2xl scroll-mt-8 px-6"
    >
      <h2 className="mb-6 text-center font-display text-4xl sm:text-5xl">
        {t("guest.replyTitle")}
      </h2>
      {body}
    </section>
  );
}
