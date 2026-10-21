import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";

/** What the workshop shows of an order option to tell it from the others. */
interface Asking {
  kind: "select" | "text" | "textarea" | "email";
  choices: { label: string; price: number }[];
  hint?: string | null;
}

/**
 * What an order option asks, in a line: a select's choices and what each
 * adds, or what the couple writes and the line under its name.
 */
export function useAsks() {
  const t = useI18n();
  const format = useFormats();
  return (option: Asking) =>
    option.kind === "select"
      ? option.choices
          .map((choice) =>
            choice.price
              ? `${choice.label} (+${format.lei(choice.price)})`
              : choice.label,
          )
          .join(", ")
      : [t(`workshop.catalog.kinds.${option.kind}`), option.hint]
          .filter(Boolean)
          .join(" · ");
}
