## Working here

- Read `GLOSSARY.md` before naming anything. Jolene speaks Romanian first, and the glossary fixes each word in both languages and in code.
- Architecture decisions are in `docs/adr/`. A change that goes against one comes with a new ADR.
- Work in your own git worktree: another agent session may be using this checkout.
- `apps/shop` started from the Vercel Shop template and sells from Convex. It keeps the template's conventions (oxlint, oxfmt, TypeScript 7) and has its own `AGENTS.md`; Biome checks everything else.
- When a page behaves differently locally than in CI, reinstall with `rm -rf node_modules && bun install`: bun keeps stale nested packages after lockfile changes.

## Designs

- A design is one JSON document (`packages/design/src/schema.ts`). The editor, every preview, the AI co-designer and the print files all read that document; don't add a second representation of a design.
- A design changes only through operations (`packages/design/src/ops.ts`). The studio applies them to its cached copy for an instant preview, and Convex applies the same code to the stored design, all or nothing.
- Lengths are millimetres. A layer's ink is how it reaches paper (print, foil, white, emboss…), and every ink but print becomes its own plate in the print file.
- The couple's details (names, date, venues) belong to their event, not to a design: every design of the event shows the same details.

## Languages

- Every text a visitor reads exists in Romanian and English, Romanian first. The studio's are in `apps/studio/src/locales/{ro,en}.ts`, and a missing key fails typecheck.
- A design has its own language (`document.language`), separate from the visitor's: a couple can write an English invitation in the Romanian studio.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend, in `packages/backend`.

When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

<!-- convex-ai-end -->
