# Print files set type like the studio

The workshop prints from a PDF that `packages/print` makes from the design document and the event's details: every face of every piece, a page for each ink, with bleed, crop marks and the die line. It draws with PDFKit, sets text with fontkit and reads images with sharp, on a server, rather than printing the studio's SVG from a browser, which can't mark the trim or put each foil on a page of its own.

What the couple approved has to be what prints, so the print file sets type from the same font files as the studio, with the same rules:

- The studio asks Google Fonts for each face as one file holding every letter it uses (`fontCharacters`, `googleFontsHref`). Split by alphabet, as Google sends them by default, a browser shapes ă, ș and ț apart from their neighbours and drops the kerning around them. The studio measures with kerning on, as it draws.
- The print file asks for the same faces whole, as TrueType, and measures and draws with them, so lines break in the same places. A line sits on the middle of its face, as the browser's central baseline puts it.
- A symbol the typeface lacks (a heart, a star, a cross) comes from the same symbol faces in both, in the same order (`symbolFonts`), and both fake a bold or an italic the face lacks the way browsers do.
- Text is normalised before it is set: accents typed apart are joined to their letters, and the selectors a phone adds to ask for a colour emoji are dropped, so a ❤ prints as type in its layer's ink, as the screen shows it.

The colour plate is RGB, as the studio shows it, without the paper's colour. White ink, each foil, embossing, debossing and spot UV each get a plate of their own in solid black, at the same size and place, for the workshop to make its plate or block from.

## Consequences

- A letter that no face has can't print as the screen shows it; the print file reports it, with words past the safe margin, details left empty, photos not given and images under 300 dpi, for the proof to show before a couple orders.
- Couples approve a proof drawn by the studio; only the workshop gets print files.
- Whatever makes print files fetches the faces from Google Fonts, and the artwork from the studio's address (ADR 0005).
- A face drawn by the studio and the same face in its print file, both at 10 pixels a millimetre, put every letter and image within a pixel of each other. That comparison is worth repeating after changing how either sets type.
