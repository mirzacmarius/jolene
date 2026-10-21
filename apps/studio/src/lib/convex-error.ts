import { ConvexError } from "convex/values";

/** The code a Convex function failed with (its utils/errors.ts), if any. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : undefined;
}
