"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { fieldsFor } from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { FileDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import {
  PRINT_CHECK_HEADER,
  type PrintCheck,
  type PrintNote,
  readPrintCheck,
} from "./print-check";
import { ToCheck } from "./to-check";

type Translate = ReturnType<typeof useI18n>;
type Locale = ReturnType<typeof useCurrentLocale>;

type State =
  | { status: "idle" }
  | { status: "making" }
  | { status: "made"; check: PrintCheck | null }
  | { status: "failed"; message: string };

/** The name the studio gave the file, from its Content-Disposition. */
function fileNameOf(response: Response) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(
    response.headers.get("content-disposition") ?? "",
  )?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}

/** Hands a file to the browser to save, as a link to it would. */
function save(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The print file of a line's proof: the studio makes it when asked, the
 * browser saves it, and what its checks found shows under the button.
 */
export function PrintFile({
  proofId,
  order,
}: {
  proofId: string;
  /** The order's name, such as "#1001", which the file's pages carry. */
  order: string;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const token = useAuthToken();
  const [state, setState] = useState<State>({ status: "idle" });

  const make = async () => {
    setState({ status: "making" });
    try {
      const response = await fetch(
        `/studio/api/print-files/${encodeURIComponent(proofId)}?order=${encodeURIComponent(order)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const answer: { message?: string } | null = await response
          .json()
          .catch(() => null);
        setState({
          status: "failed",
          message:
            response.status === 404
              ? t("workshop.print.notFound")
              : t("workshop.print.failed", {
                  message: answer?.message ?? `${response.status}`,
                }),
        });
        return;
      }
      save(
        await response.blob(),
        fileNameOf(response) ?? `${order} ${proofId}.pdf`,
      );
      setState({
        status: "made",
        check: readPrintCheck(response.headers.get(PRINT_CHECK_HEADER)),
      });
    } catch (error) {
      setState({
        status: "failed",
        message: t("workshop.print.failed", {
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  };

  const making = state.status === "making";
  const check = state.status === "made" ? state.check : null;
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={make}
        disabled={making}
        aria-busy={making}
      >
        {making ? (
          <LoaderCircle className="animate-spin" aria-hidden />
        ) : (
          <FileDown aria-hidden />
        )}
        {making ? t("workshop.print.making") : t("workshop.print.make")}
      </Button>
      {state.status === "failed" ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "made" ? (
        <div className="mt-2 text-sm" role="status">
          <p className="text-muted-foreground">
            {check
              ? t("workshop.print.made", { count: check.pages })
              : t("workshop.print.saved")}
          </p>
          {check ? (
            <ToCheck
              title={t("workshop.print.toCheck")}
              items={[
                ...check.issues.map((note) =>
                  describeNote(note, check, t, locale),
                ),
                ...(check.total > check.issues.length
                  ? [
                      t("workshop.print.more", {
                        count: check.total - check.issues.length,
                      }),
                    ]
                  : []),
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function describeNote(
  note: PrintNote,
  check: PrintCheck,
  t: Translate,
  locale: Locale,
) {
  if (note.kind === "missing-details") {
    const labels = fieldsFor(check.occasion);
    return t("workshop.print.missingDetails", {
      fields: note.fields
        .map((key) => labels[key]?.labels[locale] ?? key)
        .join(", "),
    });
  }
  const place = t("workshop.print.place", {
    piece: note.pieceName ?? note.piece,
    side:
      note.face === "back"
        ? t("workshop.print.back")
        : t("workshop.print.front"),
  });
  switch (note.kind) {
    case "overflow":
      return t("workshop.print.overflow", { text: note.text ?? "", place });
    case "outside-safe-area":
      return t("workshop.print.outsideSafeArea", {
        text: note.text ?? "",
        place,
      });
    case "missing-photo":
      return t("workshop.print.missingPhoto", { place });
    case "missing-artwork":
      return t("workshop.print.missingArtwork", { asset: note.asset, place });
    case "low-resolution":
      return t("workshop.print.lowResolution", { dpi: note.dpi, place });
    case "missing-glyphs":
      return t("workshop.print.missingGlyphs", {
        characters: note.characters,
        place,
      });
    case "unusual-characters":
      return t("workshop.print.unusualCharacters", {
        characters: note.characters,
        place,
      });
  }
}
