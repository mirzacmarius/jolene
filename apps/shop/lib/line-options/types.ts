export interface Fee {
  description?: string;
  key: string;
  label: string;
  /** Bani the order pays once, however many lines choose it. */
  price: number;
}

export interface LineOption {
  choices: LineOptionChoice[];
  hint?: string;
  key: string;
  kind: LineOptionKind;
  label: string;
  required: boolean;
}

/** Each line option's answer, by its key. */
export type LineOptionAnswers = Record<string, string>;

export interface LineOptionChoice {
  label: string;
  /** Bani added to each one ordered. */
  price: number;
}

export type LineOptionKind = "email" | "select" | "text" | "textarea";
