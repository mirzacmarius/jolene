import type { Occasion, PrintIssue } from "@jolene/design";

/**
 * The header of a print file's answer that says what its checks found: the
 * file itself is the answer's body.
 */
export const PRINT_CHECK_HEADER = "x-print-check";

/** The most issues the header lists; it counts the rest. */
export const PRINT_ISSUES_LISTED = 20;

/** An issue of the print file, with its piece's name and the words it's about. */
export type PrintNote = PrintIssue & {
  /** The piece's name, as the file's captions write it. */
  pieceName?: string;
  /** The words of the text layer it's about, cut short. */
  text?: string;
};

/** What a print file's checks found, for the workshop to look at. */
export interface PrintCheck {
  pages: number;
  /** The design's occasion, which names the details it lists as missing. */
  occasion: Occasion;
  issues: PrintNote[];
  /** How many issues there are in all, listed or not. */
  total: number;
}

export function writePrintCheck(check: PrintCheck): string {
  return encodeURIComponent(JSON.stringify(check));
}

export function readPrintCheck(header: string | null): PrintCheck | null {
  if (!header) return null;
  try {
    return JSON.parse(decodeURIComponent(header)) as PrintCheck;
  } catch {
    return null;
  }
}
