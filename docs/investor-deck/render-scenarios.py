#!/usr/bin/env python3
"""Render the Business Model scenarios (bear / base / bull) slide in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "scenarios-preview.png"

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
HAIR = (232, 234, 228)


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


def rtext(d, rx, y, text, fnt, fill):
    w = d.textlength(text, font=fnt)
    d.text((rx - w, y), text, font=fnt, fill=fill)


def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE

    tracked(d, (m, 84 * SCALE), "BUSINESS MODEL \u00b7 SCENARIOS", sans(20, bold=True), MUTED, 6)
    d.text((m, 128 * SCALE), "One engine, three outcomes.", font=font(60), fill=FOREST_DEEP)
    d.rectangle([m, 228 * SCALE, (W - 110) * SCALE, 231 * SCALE], fill=FOREST)

    cards = [
        ("BEAR", FOREST_SOFT, WHITE, "$144M",
         [("Serviceable share", "~2%"),
          ("Group trips / yr", "400K"),
          ("Avg trip value", "$8,000"),
          ("Blended take", "4.5%"),
          ("Avg commission", "$360")],
         "Pure affiliate links, slow adoption"),
        ("BASE", FOREST_MID, FOREST_PALE, "$540M",
         [("Serviceable share", "~5%"),
          ("Group trips / yr", "1.0M"),
          ("Avg trip value", "$9,000"),
          ("Blended take", "6%"),
          ("Avg commission", "$540")],
         "Affiliate at scale, higher tiers"),
        ("BULL", FOREST_DEEP, WHITE, "$1.35B",
         [("Serviceable share", "~7%"),
          ("Group trips / yr", "1.5M"),
          ("Avg trip value", "$10,000"),
          ("Blended take", "9%"),
          ("Avg commission", "$900")],
         "Direct / merchant deals + premium segments"),
    ]

    gap = 44 * SCALE
    total_w = (W - 220) * SCALE
    card_w = (total_w - gap * 2) / 3
    card_h = 588 * SCALE
    x = m
    y = 300 * SCALE
    for tag, shade, fill, rev, rows, note in cards:
        is_base = tag == "BASE"
        rounded(d, [x, y, x + card_w, y + card_h], 20 * SCALE,
                fill=fill, outline=(FOREST_MID if is_base else BORDER), width=3 if is_base else 2)
        pad = 40 * SCALE
        # tag pill
        tf = sans(16, bold=True)
        tw = d.textlength(tag, font=tf)
        tph = 44 * SCALE
        tpw = tw + 40 * SCALE
        cxc = x + card_w / 2
        rounded(d, [cxc - tpw / 2, y + 34 * SCALE, cxc + tpw / 2, y + 34 * SCALE + tph], tph / 2, fill=shade)
        ctext(d, cxc, y + 34 * SCALE + 10 * SCALE, tag, tf, WHITE, tracking=1)
        # revenue
        ctext(d, cxc, y + 108 * SCALE, rev, font(66, bold=True), FOREST_DEEP)
        ctext(d, cxc, y + 196 * SCALE, "REVENUE / YR AT SCALE", sans(15, bold=True), MUTED, tracking=1)
        # divider
        d.line([(x + pad, y + 244 * SCALE), (x + card_w - pad, y + 244 * SCALE)], fill=HAIR, width=2)
        # rows
        ry = y + 272 * SCALE
        lf = sans(19)
        vf = sans(20, bold=True)
        for label, value in rows:
            d.text((x + pad, ry), label, font=lf, fill=MUTED)
            rtext(d, x + card_w - pad, ry, value, vf, FOREST_DEEP)
            ry += 52 * SCALE
        # note
        d.line([(x + pad, ry + 4 * SCALE), (x + card_w - pad, ry + 4 * SCALE)], fill=HAIR, width=2)
        # wrap note
        words, line, lines = note.split(), "", []
        nf = sans(16)
        maxw = card_w - 2 * pad
        for w in words:
            t = (line + " " + w).strip()
            if d.textlength(t, font=nf) > maxw:
                lines.append(line)
                line = w
            else:
                line = t
        lines.append(line)
        ny = ry + 24 * SCALE
        for ln in lines:
            ctext(d, cxc, ny, ln, nf, FAINT)
            ny += 26 * SCALE
        x += card_w + gap

    foot = ("Serviceable market ~20.8M US group trips/yr ($187B \u00f7 ~$9K). Take rates per Booking.com, Viator "
            "& rate-card benchmarks (2025). Each case = group trips \u00d7 avg commission.")
    ctext(d, (m + (W - 110) * SCALE) / 2, (H - 62) * SCALE, foot, sans(15), FAINT)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
