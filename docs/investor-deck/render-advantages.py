#!/usr/bin/env python3
"""Render the Competitive Advantages slide (2x3 grid) in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "advantages-preview.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
MUTED = (96, 96, 96)
FAINT = (150, 150, 150)
BORDER = (222, 224, 218)


def font(size, bold=False):
    paths = [
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/Library/Fonts/Georgia.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size * SCALE)
        except OSError:
            continue
    return ImageFont.load_default()


def sans(size, bold=False):
    paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size * SCALE)
        except OSError:
            continue
    return ImageFont.load_default()


def tracked(d, xy, text, fnt, fill, sp):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + sp * SCALE


def ctext(d, cx, y, text, fnt, fill, tracking=0):
    if tracking:
        total = sum(d.textlength(ch, font=fnt) + tracking * SCALE for ch in text) - tracking * SCALE
        tracked(d, (cx - total / 2, y), text, fnt, fill, tracking)
    else:
        w = d.textlength(text, font=fnt)
        d.text((cx - w / 2, y), text, font=fnt, fill=fill)


def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def wrap(d, text, fnt, maxw):
    words, line, lines = text.split(), "", []
    for w in words:
        t = (line + " " + w).strip()
        if d.textlength(t, font=fnt) > maxw:
            lines.append(line)
            line = w
        else:
            line = t
    lines.append(line)
    return lines


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE
    rightx = (W - 110) * SCALE

    tracked(d, (m, 84 * SCALE), "COMPETITIVE ADVANTAGES", sans(20, bold=True), MUTED, 6)
    d.text((m, 128 * SCALE), "Why Avanti wins \u2014 and keeps winning.", font=font(60), fill=FOREST_DEEP)
    d.rectangle([m, 228 * SCALE, rightx, 231 * SCALE], fill=FOREST)

    rows = [
        [
            ("GROUP-NATIVE",
             "Built for the whole group \u2014 voting, per-person costs, and splitting \u2014 not a solo app with sharing bolted on."),
            ("END-TO-END",
             "Decide, book, and run the trip in one place. Everyone else owns a single slice."),
            ("STRUCTURED + CONVERSATIONAL",
             "Preprogrammed flows plus an AI assistant. You control how specific and hands-on it gets \u2014 and can ask anything, anytime."),
            ("AI + REAL PRICES",
             "AI plans against live prices and perks \u2014 surfacing the savings and upgrades others keep hidden."),
        ],
        [
            ("BUILT-IN VIRALITY",
             "Every trip pulls in 5\u201315 travelers who become users. Near-zero CAC, K > 1."),
            ("ON THE GROUND",
             "Minute-by-minute itineraries and local essentials, long after competitors stop at checkout."),
            ("COMPOUNDING DATA",
             "Group preferences and outcomes make every next trip smarter \u2014 a moat that grows with usage."),
        ],
    ]

    total_w = rightx - m
    pill_centers = [372 * SCALE, 680 * SCALE]
    maxw = total_w / 4 - 56 * SCALE

    hf = sans(23, bold=True)
    df = sans(18)
    for r, row_items in enumerate(rows):
        k = len(row_items)
        pcy = pill_centers[r]
        for i, (title, desc) in enumerate(row_items):
            cx = m + total_w * (i + 0.5) / k
            tw = d.textlength(title, font=hf)
            pw = tw + 64 * SCALE
            ph = 72 * SCALE
            rounded(d, [cx - pw / 2, pcy - ph / 2, cx + pw / 2, pcy + ph / 2], 12 * SCALE, fill=FOREST_DEEP)
            ctext(d, cx, pcy - 16 * SCALE, title, hf, WHITE)
            dy = pcy + ph / 2 + 28 * SCALE
            for ln in wrap(d, desc, df, maxw):
                ctext(d, cx, dy, ln, df, MUTED)
                dy += 30 * SCALE

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
