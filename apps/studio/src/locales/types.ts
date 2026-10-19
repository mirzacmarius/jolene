import type en from "./en";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/**
 * The shape every language must match: exactly English's keys, with any text.
 * A missing or extra key in a language fails `bun run typecheck`, and so CI.
 */
export type Dictionary = Widen<typeof en>;
