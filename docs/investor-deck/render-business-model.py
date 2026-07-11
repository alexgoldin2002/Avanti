#!/usr/bin/env python3
"""Render the Business Model slide (Airbnb-style flow) in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "business-model-preview.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
MUTED = (106, 106, 106)
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


def arrow(d, x0, x1, y, color):
    d.line([(x0, y), (x1, y)], fill=color, width=3 * SCALE)
    hs = 12 * SCALE
    d.polygon([(x1, y), (x1 - hs, y - hs * 0.7), (x1 - hs, y + hs * 0.7)], fill=color)


def centered_pills(d, items, cx, y0, max_w, pf):
    """Draw pills centered under cx, wrapping into rows within max_w."""
    ph = 48 * SCALE
    pgap = 14 * SCALE
    rows, row, row_w = [], [], 0
    for it in items:
        pw = d.textlength(it, font=pf) + 44 * SCALE
        add = pw if not row else pw + pgap
        if row and row_w + add > max_w:
            rows.append((row, row_w))
            row, row_w = [it], pw
        else:
            row.append(it)
            row_w += add
    if row:
        rows.append((row, row_w))
    y = y0
    for row, row_w in rows:
        x = cx - row_w / 2
        for it in row:
            pw = d.textlength(it, font=pf) + 44 * SCALE
            rounded(d, [x, y, x + pw, y + ph], ph / 2, fill=WHITE, outline=FOREST_SOFT, width=2)
            d.text((x + 22 * SCALE, y + 13 * SCALE), it, font=pf, fill=FOREST)
            x += pw + pgap
        y += ph + pgap
    return y


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE

    tracked(d, (m, 84 * SCALE), "BUSINESS MODEL", sans(20, bold=True), MUTED, 6)
    d.text((m, 128 * SCALE), "We earn a commission on every booking.", font=font(60), fill=FOREST_DEEP)
    d.rectangle([m, 228 * SCALE, (W - 110) * SCALE, 231 * SCALE], fill=FOREST)

    # framing card
    cx0, cy0, cx1, cy1 = m, 290 * SCALE, (W - 110) * SCALE, (H - 90) * SCALE
    rounded(d, [cx0, cy0, cx1, cy1], 24 * SCALE, fill=WHITE, outline=BORDER, width=2)

    # node centers
    n1 = 500 * SCALE
    n2 = 960 * SCALE
    n3 = 1420 * SCALE
    mid_y = 452 * SCALE  # vertical center of figures

    # arrows
    arrow(d, 660 * SCALE, 820 * SCALE, mid_y, FAINT)
    arrow(d, 1100 * SCALE, 1260 * SCALE, mid_y, FAINT)

    # ---- Node 1: circle with trips ----
    r = 118 * SCALE
    d.ellipse([n1 - r, mid_y - r, n1 + r, mid_y + r], fill=FOREST_DEEP)
    ctext(d, n1, mid_y - 44 * SCALE, "1M", font(60, bold=True), WHITE)
    ctext(d, n1, mid_y + r + 30 * SCALE, "GROUP TRIPS / YR", sans(24, bold=True), FOREST_DEEP, tracking=1)
    ctext(d, n1, mid_y + r + 74 * SCALE, "~5% serviceable share", sans(20), MUTED)
    ctext(d, n1, mid_y + r + 110 * SCALE, "of ~20.8M US group trips/yr", sans(15), FAINT)

    # ---- Node 2: avg commission ----
    ctext(d, n2, mid_y - 44 * SCALE, "$540", font(76, bold=True), FOREST_MID)
    ctext(d, n2, mid_y + r + 30 * SCALE, "AVG COMMISSION", sans(24, bold=True), FOREST_DEEP, tracking=1)
    ctext(d, n2, mid_y + r + 74 * SCALE, "~6% blended take on ~$9,000 trip", sans(20), MUTED)
    ctext(d, n2, mid_y + r + 110 * SCALE, "hotels 4\u20138% \u00b7 activities 8% \u00b7 flights 1\u20133%", sans(15), FAINT)

    # ---- Node 3: revenue ----
    ctext(d, n3, mid_y - 44 * SCALE, "$540M", font(76, bold=True), FOREST_DEEP)
    ctext(d, n3, mid_y + r + 30 * SCALE, "REVENUE", sans(24, bold=True), FOREST_DEEP, tracking=1)
    ctext(d, n3, mid_y + r + 74 * SCALE, "Annual run-rate at scale", sans(20), MUTED)
    ctext(d, n3, mid_y + r + 110 * SCALE, "1M trips \u00d7 $540", sans(15), FAINT)

    # ---- segments strip: every kind of group trip ----
    ccx = (cx0 + cx1) / 2
    seg_head_y = mid_y + r + 168 * SCALE
    ctext(d, ccx, seg_head_y, "SERVES EVERY KIND OF GROUP TRIP", sans(17, bold=True), FOREST_SOFT, tracking=3)
    segments = [
        "Friends getaways", "Bachelor / bachelorette", "Family reunions",
        "Destination weddings", "Corporate & team offsites", "Youth sports & clubs",
    ]
    centered_pills(d, segments, ccx, seg_head_y + 40 * SCALE, cx1 - cx0 - 80 * SCALE, sans(17, bold=True))

    # source footnote inside card
    foot = ("Sources: US group travel market $187B, 6.8% CAGR (Emergen Research, 2025); affiliate take "
            "\u2014 hotels 4\u20138%, activities 8%, flights 1\u20133% (Booking.com, Viator, rate-card benchmarks, 2025).")
    ctext(d, ccx, cy1 - 44 * SCALE, foot, sans(14), FAINT)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
