"""Makes every logo, icon and share image the apps use from Jolene's logo.

Reads brand/jolene-logo.png and overwrites the files listed in main(), so a
larger original of the logo, saved over that file, sharpens all of them in one
run. The share images are set in Jost, the apps' typeface, which is downloaded
once into the system's temporary folder.

usage: python3 -I -B brand/generate.py   (needs Pillow and NumPy)
"""

import tempfile
import urllib.request
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "brand" / "jolene-logo.png"
SHOP = ROOT / "apps" / "shop"
STUDIO = ROOT / "apps" / "studio"

# Jolene's palette, from the apps' globals.css: paper, muted ink, gold and
# blush, with a sage that echoes the logo's leaves.
PAPER = (251, 248, 243)
MUTED = (110, 102, 92)
GOLD = (168, 130, 63)
BLUSH = (236, 214, 204)
SAGE = (214, 226, 205)

JOST_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/jost/Jost%5Bwght%5D.ttf"
JOST = Path(tempfile.gettempdir()) / "jolene-brand" / "Jost[wght].ttf"

# The headers draw the logo 40 px tall; 132 px keeps it sharp on 3x screens.
HEADER_HEIGHT = 132


def trim(image: Image.Image) -> Image.Image:
    """The image cut to its visible pixels."""
    return image.crop(image.getchannel("A").getbbox())


def split(logo: Image.Image) -> tuple[Image.Image, Image.Image]:
    """The rose with its leaves, and the wordmark: the parts either side of
    the widest gap between them."""
    filled = np.asarray(logo.getchannel("A")).max(axis=0) > 0
    gap, start = (0, 0), None
    for x, column in enumerate(filled):
        if not column and start is None:
            start = x
        elif column and start is not None:
            if x - start > gap[1] - gap[0]:
                gap = (start, x)
            start = None
    mark = logo.crop((0, 0, gap[0], logo.height))
    wordmark = logo.crop((gap[1], 0, logo.width, logo.height))
    return trim(mark), trim(wordmark)


def largest_region(mask: np.ndarray) -> np.ndarray:
    """The biggest group of touching pixels in a mask."""
    height, width = mask.shape
    seen = np.zeros_like(mask)
    best: list[tuple[int, int]] = []
    for y, x in zip(*np.nonzero(mask), strict=True):
        if seen[y, x]:
            continue
        region = []
        queue = deque([(y, x)])
        seen[y, x] = True
        while queue:
            cy, cx = queue.popleft()
            region.append((cy, cx))
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        if len(region) > len(best):
            best = region
    out = np.zeros_like(mask)
    out[tuple(np.array(best).T)] = True
    return out


def rose(mark: Image.Image) -> Image.Image:
    """The rose without its leaves, which turn to noise at favicon sizes."""
    pixels = np.asarray(mark).astype(int)
    red, green, blue, alpha = (pixels[..., i] for i in range(4))
    leaf = (green > red + 8) & (green > blue + 8)
    flower = largest_region((alpha > 6) & ~leaf)
    # Two pixels more all round keep the flower's soft watercolour edge.
    edge = Image.fromarray(flower.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))
    keep = (np.asarray(edge) > 0) & ~leaf
    out = pixels.copy()
    out[..., 3] = np.where(keep, alpha, 0)
    return trim(Image.fromarray(out.astype(np.uint8), "RGBA"))


def scaled(image: Image.Image, scale: float) -> Image.Image:
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    # Pillow resizes RGBA in premultiplied alpha, so edges keep their colour.
    return image.resize(size, Image.Resampling.LANCZOS)


def square(art: Image.Image, size: int, fill: float, background=None) -> Image.Image:
    """The art centred on a square, as wide or tall as `fill` of it."""
    canvas = Image.new("RGBA", (size, size), (*background, 255) if background else (0, 0, 0, 0))
    art = scaled(art, size * fill / max(art.width, art.height))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def maskable(art: Image.Image, size: int, background) -> Image.Image:
    """The art inside a maskable icon's safe zone, the central circle that
    every launcher's mask keeps (its radius is 40% of the icon's width)."""
    ys, xs = np.nonzero(np.asarray(art.getchannel("A")) > 24)
    reach = np.hypot(xs + 0.5 - art.width / 2, ys + 0.5 - art.height / 2).max()
    art = scaled(art, size * 0.4 * 0.96 / reach)
    canvas = Image.new("RGBA", (size, size), (*background, 255))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def jost(size: int, weight: int) -> ImageFont.FreeTypeFont:
    if not JOST.exists():
        JOST.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading Jost to {JOST}")
        urllib.request.urlretrieve(JOST_URL, JOST)
    font = ImageFont.truetype(str(JOST), size)
    font.set_variation_by_axes([weight])
    return font


def glow(canvas: Image.Image, colour, centre, radius: int, strength: float) -> None:
    """A soft wash of colour, like watercolour bleeding into the paper."""
    layer = Image.new("L", canvas.size, 0)
    x, y = centre
    ImageDraw.Draw(layer).ellipse((x - radius, y - radius, x + radius, y + radius), fill=round(255 * strength))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.6))
    canvas.paste(Image.new("RGBA", canvas.size, (*colour, 255)), (0, 0), layer)


def tracked(draw: ImageDraw.ImageDraw, centre_x: float, top: float, text: str, font, fill, tracking: float) -> None:
    """Spaced-out capitals, centred, with `tracking` ems after each letter."""
    space = font.size * tracking
    advances = [font.getlength(letter) + space for letter in text]
    x = centre_x - (sum(advances) - space) / 2
    for letter, advance in zip(text, advances, strict=True):
        draw.text((x, top), letter, font=font, fill=fill)
        x += advance


def share_card(logo: Image.Image, lines: list[dict]) -> Image.Image:
    """The 1200×630 picture shown with a shared link: the logo on paper, and
    `lines` of text under a gold rule."""
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (*PAPER, 255))
    glow(card, BLUSH, (930, 90), 330, 0.75)
    glow(card, SAGE, (170, 600), 300, 0.6)
    art = scaled(logo, 560 / logo.width)
    rule_gap, rule_to_text, line_gap = 34, 34, 14
    text_height = sum(line["size"] * 1.25 for line in lines) + line_gap * (len(lines) - 1)
    top = round((height - (art.height + rule_gap + rule_to_text + text_height)) / 2)
    card.alpha_composite(art, ((width - art.width) // 2, top))
    draw = ImageDraw.Draw(card)
    rule_y = top + art.height + rule_gap
    draw.line((width / 2 - 80, rule_y, width / 2 + 80, rule_y), fill=(*GOLD, 150), width=1)
    y = rule_y + rule_to_text
    for line in lines:
        font = jost(line["size"], line["weight"])
        if "tracking" in line:
            tracked(draw, width / 2, y, line["text"], font, line["colour"], line["tracking"])
        else:
            draw.text((width / 2, y), line["text"], font=font, fill=line["colour"], anchor="ma")
        y += line["size"] * 1.25 + line_gap
    return card.convert("RGB")


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    # Drawn at under half its size, the watercolour hides any loss at 80.
    image.save(path, quality=80, alpha_quality=80, method=6)


def save_ico(frames: list[Image.Image], path: Path) -> None:
    largest, *smaller = sorted(frames, key=lambda frame: -frame.width)
    largest.save(path, sizes=[frame.size for frame in frames], append_images=smaller)


def main() -> None:
    logo = trim(Image.open(LOGO).convert("RGBA"))
    mark, _ = split(logo)
    flower = rose(mark)

    header = scaled(logo, HEADER_HEIGHT / logo.height)
    favicon = [square(flower, size, 1.0) for size in (16, 32, 48)]
    icon = square(flower, 96, 1.0)
    # Home screens: on paper, since iOS fills transparency with black and
    # rounds the corners itself.
    apple_icon = square(mark, 180, 0.78, PAPER).convert("RGB")
    shop_card = share_card(
        logo,
        [
            {"text": "Invitații de nuntă și botez, create de voi", "size": 34, "weight": 400, "colour": MUTED},
            {"text": "JOLENE.RO", "size": 19, "weight": 500, "colour": GOLD, "tracking": 0.32},
        ],
    )
    # The studio speaks two languages, so its card says only "Studio", the
    # same word in both.
    studio_card = share_card(logo, [{"text": "STUDIO", "size": 26, "weight": 500, "colour": GOLD, "tracking": 0.42}])

    outputs = [
        (save_webp, header, SHOP / "components/nav/jolene-logo.webp"),
        (save_webp, header, ROOT / "packages/ui/src/components/jolene-logo.webp"),
        # The shop's footer draws the logo 80 px tall: it gets every pixel there is.
        (save_webp, logo, SHOP / "components/footer/jolene-logo.webp"),
        (save_ico, favicon, SHOP / "app/favicon.ico"),
        (save_png, icon, SHOP / "app/icon.png"),
        (save_png, icon, STUDIO / "src/app/studio/icon.png"),
        (save_png, apple_icon, SHOP / "app/apple-icon.png"),
        (save_png, apple_icon, STUDIO / "src/app/studio/apple-icon.png"),
        # The web app manifest's icons; the 512 one is also Schema.org's logo.
        (save_png, square(mark, 192, 0.9), SHOP / "public/icons/icon-192.png"),
        (save_png, square(mark, 512, 0.9), SHOP / "public/icons/icon-512.png"),
        (save_png, maskable(mark, 512, PAPER).convert("RGB"), SHOP / "public/icons/icon-maskable-512.png"),
        (save_png, shop_card, SHOP / "public/og-default.png"),
        (save_png, studio_card, STUDIO / "src/app/studio/opengraph-image.png"),
    ]
    for save, image, path in outputs:
        save(image, path)
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
