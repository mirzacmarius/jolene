import type { LineOption, LineOptionAnswers, LineOptionChoice } from "./types";

// A select the couple may skip starts on its first free choice, which is how jolene.ro lists "none".
export function getDefaultAnswers(options: LineOption[]): LineOptionAnswers {
  return Object.fromEntries(
    options.map((option) => [
      option.key,
      option.kind === "select" && !option.required
        ? (option.choices.find((choice) => choice.price === 0)?.label ?? "")
        : "",
    ]),
  );
}

export function canSkipChoice(option: LineOption): boolean {
  return !option.required && !option.choices.some((choice) => choice.price === 0);
}

function getChoice(option: LineOption, answer: string | undefined): LineOptionChoice | undefined {
  return option.choices.find((choice) => choice.label === answer);
}

/** What the chosen options add to each one ordered, in bani. */
export function getExtrasPerItem(options: LineOption[], answers: LineOptionAnswers): number {
  return options.reduce(
    (sum, option) =>
      option.kind === "select" ? sum + (getChoice(option, answers[option.key])?.price ?? 0) : sum,
    0,
  );
}

export function getMissingOptions(options: LineOption[], answers: LineOptionAnswers): LineOption[] {
  return options.filter((option) => option.required && !answers[option.key]?.trim());
}

/** The answers as the cart keeps them: trimmed, without the empty ones. */
export function toCartAnswers(
  options: LineOption[],
  answers: LineOptionAnswers,
): Array<{ key: string; value: string }> {
  return options.flatMap((option) => {
    const value = answers[option.key]?.trim();
    return value ? [{ key: option.key, value }] : [];
  });
}
