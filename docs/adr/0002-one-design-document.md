# One design document, changed by operations

A design is one JSON document (`packages/design/src/schema.ts`): its pieces in millimetres, each face's layers, the inks they take, the accessories and envelope, a palette, a language. The studio's editor, every preview, the AI co-designer and the print files all read this one document, so what a couple sees is what the workshop prints. Every change to a design is an operation from a fixed set (`packages/design/src/ops.ts`) that both the browser and Convex apply with the same code: the studio shows a change before the backend confirms it, the backend applies a batch all or nothing, and the AI changes designs exactly as a person does.

The couple's details (names, date, venues) are not in the document. They belong to the event, and every design of the event fills its text with them, so a couple writes them once for the whole collection.

## Consequences

- A new feature of a design (a die cut, a finish, an accessory) is added to the schema and the renderer once, and every surface shows it.
- The document has a schema version; changing its shape needs a migration for stored designs and templates.
- Versions are copies of the document after a change, so restoring one is replacing the document with it.
