"""Lifts a collection's artwork out of the photos on jolene.ro, until Jolene's
source files replace it.

A recipe (recipes/<suite>.json) names, for each card, the photo it comes from,
where the card's corners sit in it and the card's size in millimetres. The
card is straightened to that size, its words are erased (the template sets
them as text), and the paper is made transparent, so the artwork sits on
whatever paper the couple picks. What is left is cut into the recipe's layers,
each written as a WebP next to the studio's other files, and art.ts records
where each one sat on the card.

usage: python3 -I lift.py recipes/<suite>.json [--catalog DIR] [--preview DIR]
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps/studio/public"
SRC = ROOT / "packages/suites/src"


def load(path: Path) -> np.ndarray:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.asarray(image).astype(np.float32) / 255


def straighten(image: np.ndarray, quad, size_px) -> np.ndarray:
    """The card as if scanned: its corners (TL, TR, BR, BL) moved to a rectangle."""
    w, h = size_px
    src = np.array(quad, dtype=np.float32)
    dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(
        image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    ).clip(0, 1)


def even_paper(image: np.ndarray, ppmm: float, window_mm: float) -> np.ndarray:
    """Divides out the light falling on the paper, so bare paper reads pure white.

    The paper is the brightest thing on the card, so a wide maximum filter
    finds it under the artwork; blurring that gives the light at each point.
    """
    k = max(3, int(window_mm * ppmm) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    small = 4
    reduced = cv2.resize(image, None, fx=1 / small, fy=1 / small, interpolation=cv2.INTER_AREA)
    kr = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, (k // small) | 1),) * 2)
    light = cv2.morphologyEx(reduced, cv2.MORPH_CLOSE, kr)
    light = cv2.GaussianBlur(light, (0, 0), max(1, k / small / 3))
    light = cv2.resize(light, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_CUBIC)
    # Bare paper's own brightness across all three channels, so white stays neutral.
    return (image / np.maximum(light, 0.2)).clip(0, 1)


def mm_box(rect, ppmm, shape):
    x, y, w, h = rect
    x0, y0 = max(0, round(x * ppmm)), max(0, round(y * ppmm))
    x1, y1 = min(shape[1], round((x + w) * ppmm)), min(shape[0], round((y + h) * ppmm))
    return x0, y0, x1, y1


def text_mask(card: np.ndarray, box, rule: dict) -> np.ndarray:
    """The pixels inside box that look like printed words, per the rule."""
    x0, y0, x1, y1 = box
    region = card[y0:y1, x0:x1]
    hsv = cv2.cvtColor((region * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    value, sat = hsv[..., 2] / 255, hsv[..., 1] / 255
    kind = rule.get("select", "dark")
    if kind == "dark":
        mask = value < rule.get("below", 0.8)
    elif kind == "light":
        mask = (value > rule.get("above", 0.75)) & (sat < rule.get("saturation", 0.25))
    elif kind == "grey":
        mask = (value < rule.get("below", 0.85)) & (sat < rule.get("saturation", 0.25))
    elif kind == "all":
        mask = np.ones(value.shape, bool)
    else:
        raise SystemExit(f"unknown select {kind!r}")
    grow = rule.get("grow", 2)
    if grow:
        mask = cv2.dilate(mask.astype(np.uint8), np.ones((2 * grow + 1,) * 2, np.uint8)) > 0
    full = np.zeros(card.shape[:2], bool)
    full[y0:y1, x0:x1] = mask
    return full


def fill_vertically(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Fills each masked run of a column from the pixels just above and below
    it, keeping the vertical texture of the painting around it (and whatever
    the camera saw grain in it)."""
    out = image.copy()
    smooth = cv2.GaussianBlur(image, (0, 0), 1.5)
    height = image.shape[0]
    for x in np.nonzero(mask.any(axis=0))[0]:
        column = mask[:, x]
        y = 0
        while y < height:
            if not column[y]:
                y += 1
                continue
            start = y
            while y < height and column[y]:
                y += 1
            # A few pixels clear of the gap, past any halo the camera left.
            reach = 4
            top_y, bottom_y = start - 1 - reach, y + reach
            above = smooth[max(top_y, 0), x] if start > 0 else smooth[min(bottom_y, height - 1), x]
            below = smooth[bottom_y, x] if bottom_y < height else above
            start, stop = max(start - reach, 0), min(y + reach, height)
            t = np.linspace(0, 1, stop - start + 2)[1:-1, None]
            out[start:stop, x] = above * (1 - t) + below * t
    return borrow_grain(out, image, mask, axes=(1,))


def fill_by_turning(image: np.ndarray, mask: np.ndarray, centre_px) -> np.ndarray:
    """Fills a gap in something round, such as a wood slice, from the same
    ring a turn away, so the rings and grain carry on through it."""
    out = image.copy()
    todo = mask.copy()
    height, width = mask.shape
    for angle in (72, -72, 144, -144, 36, -36, 108, -108, 180):
        if not todo.any():
            break
        turn = cv2.getRotationMatrix2D(centre_px, angle, 1)
        turned = cv2.warpAffine(image, turn, (width, height), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        turned_gap = cv2.warpAffine(mask.astype(np.uint8), turn, (width, height), flags=cv2.INTER_NEAREST, borderValue=1) > 0
        take = todo & ~turned_gap
        out[take] = turned[take]
        todo &= ~take
    if todo.any():
        bgr = cv2.cvtColor((out * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        bgr = cv2.inpaint(bgr, todo.astype(np.uint8) * 255, 6, cv2.INPAINT_TELEA)
        out[todo] = (cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255)[todo]
    # Soften the seam between what was there and what was turned in.
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.2)[..., None]
    return image * (1 - soft) + out * soft


def borrow_grain(filled: np.ndarray, original: np.ndarray, mask: np.ndarray, axes=(0, 1)) -> np.ndarray:
    """Adds the paper's and paint's grain to a fill, borrowed from beside the
    gap (never from the gap itself, which still holds the words' edges), so
    the fill isn't flat."""
    rng = np.random.default_rng(7)
    smooth = cv2.GaussianBlur(original, (0, 0), 1.5)
    grown = cv2.dilate(mask.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    grain = np.where(grown[..., None], 0, original - smooth)
    have = (~grown).astype(np.float32)
    borrowed = np.zeros_like(original)
    weight = np.zeros(mask.shape, np.float32)
    for axis in axes:
        for shift in (rng.integers(60, 90), -rng.integers(60, 90), rng.integers(120, 160)):
            borrowed += np.roll(grain, shift, axis=axis)
            weight += np.roll(have, shift, axis=axis)
    out = filled.copy()
    out[grown] = (filled + borrowed / np.maximum(weight, 1)[..., None])[grown]
    return out.clip(0, 1)


def to_alpha(card: np.ndarray, floor: float, knee: float):
    """Colour to alpha against white: the least ink that, laid on white paper,
    gives the same colour. Faint specks under `floor` vanish; above `knee` the
    artwork is untouched."""
    alpha = 1 - card.min(axis=2)
    safe = np.maximum(alpha, 1e-4)[..., None]
    color = (1 - (1 - card) / safe).clip(0, 1)
    t = ((alpha - floor) / max(knee - floor, 1e-4)).clip(0, 1)
    alpha = alpha * t * t * (3 - 2 * t)
    return color, alpha


def by_colour(color, alpha, layer, ppmm, shape) -> np.ndarray:
    """One object picked out by its colour, such as a wood slice among ferns:
    the largest patch of that hue inside the layer's rect, holes filled, so its
    pale middle comes too."""
    hsv = cv2.cvtColor((color * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    lo, hi = layer["hue"]
    hue = hsv[..., 0] * 2
    mask = (hue >= lo) & (hue <= hi) & (hsv[..., 1] / 255 >= layer.get("saturation", 0.15)) & (alpha > 0.04)
    x0, y0, x1, y1 = mm_box(layer["rect"], ppmm, shape)
    inside = np.zeros(shape[:2], bool)
    inside[y0:y1, x0:x1] = True
    mask &= inside
    close = max(1, round(layer.get("close", 1.5) * ppmm))
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * close + 1,) * 2))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count < 2:
        raise SystemExit(f"{layer['key']}: nothing of that hue")
    biggest = 1 + int(stats[1:, cv2.CC_STAT_AREA].argmax())
    blob = (labels == biggest).astype(np.uint8)
    if layer.get("shape") == "hull":
        # A round object: everything inside its outline, pale middle included.
        points = cv2.findNonZero(blob)
        hull = cv2.convexHull(points)
        filled = np.zeros(shape[:2], np.uint8)
        cv2.fillConvexPoly(filled, hull, 1)
        return (filled > 0) & (alpha > 0.004)
    # Fill holes: whatever the outside can't reach is inside the object.
    flood = blob.copy()
    cv2.floodFill(flood, np.zeros((shape[0] + 2, shape[1] + 2), np.uint8), (0, 0), 1)
    return (blob > 0) | (flood == 0)


def webp_bytes(rgba: np.ndarray, quality: int) -> bytes:
    from io import BytesIO

    image = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA" if rgba.shape[2] == 4 else "RGB")
    buffer = BytesIO()
    # Watercolour is translucent everywhere, so its alpha is worth compressing too.
    image.save(buffer, "WEBP", quality=quality, alpha_quality=72, method=6)
    return buffer.getvalue()


def lift_card(card_recipe: dict, suite: str, catalog: Path, preview: Path | None):
    width_mm, height_mm = card_recipe["size"]
    ppmm = card_recipe.get("ppmm", 8)
    size_px = (round(width_mm * ppmm), round(height_mm * ppmm))
    image = load(catalog / card_recipe["image"])
    quad = card_recipe["quad"]
    top = np.hypot(*np.subtract(quad[1], quad[0]))
    left = np.hypot(*np.subtract(quad[3], quad[0]))
    stretch = (size_px[0] / top) / (size_px[1] / left)
    print(f"  {card_recipe['id']}: {top:.0f}×{left:.0f}px → {size_px[0]}×{size_px[1]}px, x/y stretch {stretch:.3f}")
    card = straighten(image, quad, size_px)
    opaque = card_recipe.get("opaque", False)

    if not opaque and "paperSample" in card_recipe:
        # Evenly lit mockups: one paper colour for the whole card, read where
        # it's bare, so large pale artwork keeps its tint.
        x0, y0, x1, y1 = mm_box(card_recipe["paperSample"], ppmm, card.shape)
        paper = np.percentile(card[y0:y1, x0:x1].reshape(-1, 3), 60, axis=0)
        card = (card / paper).clip(0, 1)
    elif not opaque:
        card = even_paper(card, ppmm, card_recipe.get("paperWindow", 12))
        level = card_recipe.get("whitePoint")
        if level:
            card = (card / level).clip(0, 1)

    # Words on bare paper become paper; words over artwork are painted over
    # from the artwork around them ("fill": "inpaint").
    erased = np.zeros(card.shape[:2], bool)
    repaint = np.zeros(card.shape[:2], bool)
    for rule in card_recipe.get("erase", []):
        box = mm_box(rule["rect"], ppmm, card.shape)
        mask = text_mask(card, box, rule)
        if opaque or rule.get("fill", "paper") == "inpaint":
            repaint |= mask
        else:
            erased |= mask
    card[erased] = 1
    repaint &= ~erased
    if repaint.any() and card_recipe.get("inpaint") == "vertical":
        card = fill_vertically(card, repaint)
    elif repaint.any() and card_recipe.get("inpaint") == "turn":
        cx, cy = card_recipe["turnAbout"]
        card = fill_by_turning(card, repaint, (cx * ppmm, cy * ppmm))
    elif repaint.any():
        bgr = cv2.cvtColor((card * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        radius = card_recipe.get("inpaintRadius", 6)
        bgr = cv2.inpaint(bgr, repaint.astype(np.uint8) * 255, radius, cv2.INPAINT_TELEA)
        filled = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
        card = borrow_grain(filled, card, repaint)
    erased |= repaint
    if opaque:
        color, alpha = card, np.ones(card.shape[:2], np.float32)
    else:
        color, alpha = to_alpha(card, card_recipe.get("floor", 0.035), card_recipe.get("knee", 0.09))

    layers = card_recipe["layers"]
    owner = np.full(card.shape[:2], -1, np.int32)
    if card_recipe.get("assign", "component") == "rect" or opaque:
        for index, layer in reversed(list(enumerate(layers))):
            x0, y0, x1, y1 = mm_box(layer.get("rect", [0, 0, width_mm, height_mm]), ppmm, card.shape)
            owner[y0:y1, x0:x1] = index
    else:
        # Artwork that touches is kept whole in the layer holding most of it;
        # a piece shared more evenly between layers is cut along their edges.
        # Pieces are found from the solid artwork; the faint wash around each
        # goes with it, and faint grain far from any artwork goes nowhere.
        claimed = np.zeros(card.shape[:2], bool)
        for index, layer in enumerate(layers):
            if "hue" in layer:
                mask = by_colour(color, alpha, layer, ppmm, card.shape)
                owner[mask] = index
                claimed |= mask
        solid = ((alpha > card_recipe.get("solid", 0.08)) & ~claimed).astype(np.uint8)
        join = max(1, round(card_recipe.get("join", 1.5) * ppmm))
        grown = cv2.dilate(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * join + 1,) * 2))
        count, labels = cv2.connectedComponents(grown, connectivity=8)
        by_rect = np.full(card.shape[:2], -1, np.int32)
        for index, layer in reversed(list(enumerate(layers))):
            if "hue" in layer:
                continue
            x0, y0, x1, y1 = mm_box(layer["rect"], ppmm, card.shape)
            by_rect[y0:y1, x0:x1] = index
        for label in range(1, count):
            region = (labels == label) & ~claimed
            part = region & (solid > 0)
            total = part.sum()
            # Specks of dust and grain belong to no layer.
            if total / ppmm / ppmm < card_recipe.get("minArea", 2):
                continue
            shares = np.bincount(by_rect[part] + 1, minlength=len(layers) + 1)[1:] / total
            best = int(shares.argmax())
            if shares[best] == 0:
                ys, xs = np.nonzero(part)
                if total / ppmm / ppmm > 4:
                    print(f"    left out: {total / ppmm / ppmm:.0f} mm² of artwork around ({xs.mean() / ppmm:.0f}, {ys.mean() / ppmm:.0f}) mm")
                continue
            if shares[best] >= card_recipe.get("keepWhole", 0.85):
                owner[region] = best
            else:
                owner[region] = np.where(by_rect[region] >= 0, by_rect[region], best)
        owner[alpha <= 0.004] = -1

    out_dir = PUBLIC / "studio/art" / suite
    out_dir.mkdir(parents=True, exist_ok=True)
    entries = {}
    composite = np.ones(card.shape, np.float32)
    for index, layer in enumerate(layers):
        mine = owner == index
        if opaque:
            ys, xs = np.nonzero(mine)
        else:
            ys, xs = np.nonzero(mine & (alpha > 0.004))
        if len(xs) == 0:
            raise SystemExit(f"layer {layer['key']} is empty")
        pad = 2
        x0, x1 = max(0, xs.min() - pad), min(card.shape[1], xs.max() + 1 + pad)
        y0, y1 = max(0, ys.min() - pad), min(card.shape[0], ys.max() + 1 + pad)
        if opaque:
            pixels = color[y0:y1, x0:x1]
        else:
            a = np.where(mine, alpha, 0)[y0:y1, x0:x1, None]
            composite[y0:y1, x0:x1] = composite[y0:y1, x0:x1] * (1 - a) + color[y0:y1, x0:x1] * a
            if layer.get("recolorable"):
                # Line art in one colour: only its shape matters, since a layer's
                # tint repaints it (in foil, say), so the strokes go fully opaque.
                core = np.percentile(a[a > 0.1], 90) if (a > 0.1).any() else 1
                a = (a / core).clip(0, 1)
                pixels = np.concatenate([np.zeros_like(color[y0:y1, x0:x1]), a], axis=2)
            else:
                pixels = np.concatenate([color[y0:y1, x0:x1], a], axis=2)
        data = webp_bytes(pixels, layer.get("quality", card_recipe.get("quality", 82)))
        digest = hashlib.sha256(data).hexdigest()[:10]
        name = f"{layer['key']}.{digest}.webp"
        (out_dir / name).write_bytes(data)
        entries[layer["key"]] = {
            "path": f"/studio/art/{suite}/{name}",
            "name": layer["name"],
            "recolorable": bool(layer.get("recolorable")),
            "card": card_recipe["id"],
            "frame": {
                "x": round(x0 / ppmm, 2),
                "y": round(y0 / ppmm, 2),
                "width": round((x1 - x0) / ppmm, 2),
                "height": round((y1 - y0) / ppmm, 2),
            },
            "pixels": [int(x1 - x0), int(y1 - y0)],
        }
        print(f"    {layer['key']}: {x1 - x0}×{y1 - y0}px, {len(data) // 1024} KB")

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        shown = color if opaque else composite
        panels = [shown, np.where(erased[..., None], [1, 0.3, 0.3], shown)]
        if not opaque:
            # The artwork on dark green paper shows any paper left around it.
            panels.append(np.array([0.12, 0.22, 0.16]) * (1 - alpha[..., None]) + color * alpha[..., None])
            hues = np.array([[0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.95, 0.75, 0.2], [0.5, 0.8, 0.4], [0.7, 0.4, 0.9], [0.3, 0.8, 0.8], [0.9, 0.5, 0.7], [0.6, 0.6, 0.6]])
            tinted = np.ones_like(shown)
            for index in range(len(layers)):
                tinted[owner == index] = hues[index % len(hues)]
            panels.append(np.where((alpha > 0.02)[..., None], tinted, 1))
        side = np.concatenate(panels, axis=1)
        Image.fromarray((side.clip(0, 1) * 255).astype(np.uint8)).save(preview / f"{suite}-{card_recipe['id']}.jpg", quality=88)
    return entries


def write_manifest(suite: str, entries: dict, recipe_name: str):
    def num(value: float) -> str:
        return f"{value:g}"

    lines = [
        f"// Made by packages/suites/lift/lift.py from recipes/{recipe_name}: run it",
        "// again rather than editing this file.",
        'import type { Artwork } from "../suite";',
        "",
        "export const art = {",
    ]
    for key, entry in entries.items():
        frame = entry["frame"]
        box = ", ".join(f"{k}: {num(frame[k])}" for k in ("x", "y", "width", "height"))
        lines += [
            f'  "{key}": {{',
            f'    path: "{entry["path"]}",',
            f"    name: {json.dumps(entry['name'], ensure_ascii=False)},",
            *(["    recolorable: true,"] if entry["recolorable"] else []),
            f"    frame: {{ {box} }},",
            "  },",
        ]
    lines += ["} satisfies Record<string, Artwork>;", ""]
    target = SRC / suite / "art.ts"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines))
    print(f"wrote {target.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("recipe", type=Path)
    parser.add_argument("--catalog", type=Path, default=Path("/mnt/project-files/jolene-catalog"))
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    suite = recipe["suite"]
    print(suite)
    entries = {}
    for card in recipe["cards"]:
        entries.update(lift_card(card, suite, args.catalog, args.preview))
    # Files from an earlier run that no layer names any more.
    kept = {Path(entry["path"]).name for entry in entries.values()}
    for stale in (PUBLIC / "studio/art" / suite).glob("*.webp"):
        if stale.name not in kept:
            stale.unlink()
    write_manifest(suite, entries, args.recipe.name)


if __name__ == "__main__":
    sys.exit(main())
