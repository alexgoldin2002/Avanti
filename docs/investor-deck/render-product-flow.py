#!/usr/bin/env python3
"""Render the Product 'end-to-end flow' slide as a PNG in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "product-flow-preview.png"
HERO = ROOT / "screenshots" / "live" / "brainstorm.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
MUTED = (106, 106, 106)
BORDER = (210, 210, 200)


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


def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE

    tracked(d, (m, 88 * SCALE), "PRODUCT", sans(20, bold=True), MUTED, 6)
    d.text((m, 132 * SCALE), "Three stages. One seamless trip.", font=font(64), fill=FOREST_DEEP)
    d.rectangle([m, 240 * SCALE, (W - 110) * SCALE, 243 * SCALE], fill=FOREST)

    # Three stages
    steps = [
        ("01", "Decide",
         "Where, who, and when. Structured input and group voting turn everyone's competing preferences into one trip.",
         ["Group invites", "Preference collection", "AI destination matrix", "Structured voting", "Per-person costs", "Feasibility checks"]),
        ("02", "Book",
         "Flights, hotels, activities, and dining \u2014 real prices and perks, decided and booked in one place.",
         ["Flight analysis", "Hotels & rentals", "Activities & dining", "Card perks & status"]),
        ("03", "On the ground",
         "Minute-by-minute daily itineraries, local essentials, and every tool the group needs once the trip begins.",
         ["Daily itineraries", "SMS briefings", "Bookings vault", "Expense splitting", "Local essentials", "Saved places"]),
    ]
    n = len(steps)
    gap = 40 * SCALE
    total_w = (W - 220) * SCALE
    card_w = (total_w - gap * (n - 1)) / n
    card_h = 520 * SCALE
    x = m
    y = 360 * SCALE
    shades = [FOREST_DEEP, FOREST_MID, FOREST_SOFT]
    for i, (num, title, desc, feats) in enumerate(steps):
        rounded(d, [x, y, x + card_w, y + card_h], 18 * SCALE, fill=FOREST_PALE, outline=BORDER, width=2)
        pad = 32 * SCALE
        # number badge
        bs = 64 * SCALE
        rounded(d, [x + pad, y + pad, x + pad + bs, y + pad + bs], 12 * SCALE, fill=shades[i])
        nf = font(26, bold=True)
        nw = d.textlength(num, font=nf)
        d.text((x + pad + bs / 2 - nw / 2, y + pad + 14 * SCALE), num, font=nf, fill=WHITE)
        # title
        d.text((x + pad, y + 122 * SCALE), title, font=font(38, bold=True), fill=FOREST_DEEP)
        # desc wrap
        words = desc.split()
        line, lines = "", []
        wf = sans(19)
        maxw = card_w - 2 * pad
        for w in words:
            t = (line + " " + w).strip()
            if d.textlength(t, font=wf) > maxw:
                lines.append(line)
                line = w
            else:
                line = t
        lines.append(line)
        ty = y + 182 * SCALE
        for ln in lines:
            d.text((x + pad, ty), ln, font=wf, fill=MUTED)
            ty += 29 * SCALE

        # feature pills (wrap within card)
        pf = sans(16, bold=True)
        px = x + pad
        py = ty + 22 * SCALE
        ph = 44 * SCALE
        pgap = 12 * SCALE
        for feat in feats:
            tw = d.textlength(feat, font=pf)
            pw = tw + 34 * SCALE
            if px + pw > x + card_w - pad:
                px = x + pad
                py += ph + pgap
            rounded(d, [px, py, px + pw, py + ph], ph / 2, fill=WHITE, outline=FOREST_SOFT, width=2)
            d.text((px + 17 * SCALE, py + 11 * SCALE), feat, font=pf, fill=FOREST)
            px += pw + pgap

        # arrow to next
        if i < n - 1:
            ax = x + card_w + gap / 2
            ay = y + card_h / 2
            d.text((ax - 12 * SCALE, ay - 26 * SCALE), "\u203a", font=font(46, bold=True), fill=FOREST_MID)
        x += card_w + gap

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
