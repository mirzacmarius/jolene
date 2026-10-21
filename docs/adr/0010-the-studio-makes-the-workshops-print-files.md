# The studio makes the workshop's print files

The workshop prints a designed line from its print file (docs/adr/0006), made from the proof the couple approved (docs/adr/0007), and its order list shows each line's proof (docs/adr/0009). `packages/print` runs on Node with sharp's native image library, fontkit and PDFKit, and draws the faces from Google Fonts and the artwork that ships with the studio (docs/adr/0005).

So the studio makes the file when the workshop asks for it from its list, at `/studio/api/print-files/<proof>`:

- **Convex says who may have it.** The workshop's page sends its Convex token, and the route asks Convex with it for what the file is made from (`workshop.printJob`), which only the workshop's accounts get: the design the couple approved, their details and the files it draws. A couple's photos resolve for the couple who owns the proof, as when they designed it.
- **The artwork comes from the studio's own files**, which the route's function carries (`outputFileTracingIncludes` in `apps/studio/next.config.ts`); photos come from Convex storage.
- **The file is the answer.** The PDF goes straight back to the page, which saves it under the order's number, the couple's names and the item, and lists what the file's checks found, sent in a header beside it. Nothing is stored. The templates' files run to 4.4 MB with their example details, and more with photos; Vercel streams every Node function's answer, so its 4.5 MB cap on a function's payload doesn't apply ([Vercel's guide](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)).

A Convex Node action was the other place to make it, but Convex's bundler leaves a package out of an action's bundle, as sharp's native library must be, only where it is imported from the backend's own folder, and the print package imports sharp from its own.

## Consequences

- Each line with a proof has a print file button. A file takes a second or two; the first one a function makes also fetches its faces from Google Fonts.
- The file's checks are those the couple saw on the proof, made with the file's own fonts: details left empty, words that don't fit or reach towards the cut, empty photo frames, images missing or under 300 dpi, letters no face has. The artwork lifted from jolene.ro's photos is under 300 dpi (from about 60 to 260 across the templates), so it is flagged until Jolene's own files replace it.
- A file is made afresh each time from the approved proof, so it can't fall out of step with it, and the studio keeps no copy.
- Previews can't make one: the workshop can't sign in there (docs/adr/0009).
