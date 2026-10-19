# Lifting artwork from jolene.ro

Until Jolene's source files arrive, each collection's artwork is lifted from the photos and mockups on jolene.ro. `lift.py` straightens a card, erases its words (templates set them as text), makes the paper transparent and cuts what is left into layers. The layers are written to `apps/studio/public/studio/art/<suite>/` as WebP, and `src/<suite>/art.ts` records where each one sat on its card. A source file replaces a lifted one under the same key, and the templates don't change.

```sh
python3 -I lift.py recipes/forest.json --preview <folder for contact sheets>
```

It needs Python 3 with numpy, Pillow and OpenCV (`opencv-python-headless`), and the catalog pulled from jolene.ro (`--catalog`, by default `/mnt/project-files/jolene-catalog`).

## Recipes

A recipe lists the cards of one collection. Lengths are millimetres on the straightened card.

| Field | |
|---|---|
| `id` | The card's name, for messages and the preview |
| `image` | The photo, relative to the catalog |
| `quad` | The card's corners in the photo, in pixels: top left, top right, bottom right, bottom left |
| `size` | The card's width and height |
| `ppmm` | Pixels per millimetre to write (8) |
| `opaque` | Artwork covering the whole card, such as a painting: kept as it is, no transparency |
| `paperSample` | A bare patch of paper, `[x, y, width, height]`; for evenly lit mockups. Without it the light is evened out over `paperWindow` (12) millimetres, for photos |
| `erase` | Words to remove: `rect`, and `select` `all` (everything), `dark`, `grey` or `light` (only pixels that look like ink of that kind; `below`, `above` and `saturation` tune it), `grow` (pixels around each letter) and `fill`: `paper` (default), or `inpaint` for words over artwork |
| `inpaint` | How words over artwork are painted out: Telea inpainting (default), `vertical` (from above and below, for trees and stripes) or `turn` (from the same ring a turn away about `turnAbout`, for round things like a wood slice) |
| `layers` | What to cut the artwork into: `key` (the asset key, `<suite>-<what>`), `name` (Romanian, for the layers panel) and `rect`. Artwork that touches goes whole to the layer holding most of it. A layer with `hue` (`[from, to]` degrees, with `saturation` and `shape: "hull"` for round objects) takes the largest patch of that colour first, such as a wood slice among ferns. A `recolorable` layer is one-colour line art, kept as its shape only, so a template can tint it with the palette or print it in foil |
| `quality` | WebP quality (82) |

The preview writes, per card: the layers on white, the erased words in red, the layers on dark green (paper left around the artwork shows up here) and which layer took which artwork.
