# Brand

`jolene-logo.png` is Jolene's logo: the watercolour rose with its leaves and the
JOLENE wordmark, 651×313 px on a transparent background. `generate.py` makes
every logo, icon and share image the apps use from it:

| File | What it's for |
|---|---|
| `apps/shop/components/nav/jolene-logo.webp`, `packages/ui/src/components/jolene-logo.webp` | The logo in the shop's and the studio's headers: 132 px tall, over three times the 40 px they draw it at |
| `apps/shop/app/favicon.ico` (16, 32, 48 px), `apps/shop/app/icon.png`, `apps/studio/src/app/studio/icon.png` (96 px) | Browser tabs, bookmarks and search results: the rose alone, since its leaves turn to noise this small |
| `apps/shop/app/apple-icon.png`, `apps/studio/src/app/studio/apple-icon.png` (180 px) | Home screens on iPhone and iPad: the rose with its leaves on paper |
| `apps/shop/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | The web app manifest (`apps/shop/app/manifest.ts`); the 512 px icon is also the logo in the shop's Schema.org data |
| `apps/shop/public/og-default.png`, `apps/studio/src/app/studio/opengraph-image.png` (1200×630 px) | The picture shown with a link shared on social networks and in chats |

To change any of them, edit `generate.py` or replace the logo, then run it from
the repository root and commit what it writes:

```sh
pip install pillow numpy
python3 -I -B brand/generate.py
```

The 512 px icons draw the rose twice as large as it is in this file, so they
are a little soft. A larger original of the logo, exported as a PNG with a
transparent background and saved over `jolene-logo.png`, sharpens them and
every other file in one run.
