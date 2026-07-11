#!/usr/bin/env python3
"""Render the Adoption Strategy slide (Airbnb 3-column style) in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "adoption-preview.png"

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


def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def bullets(d, items, x, y, step, dot_fill):
    bf = sans(19)
    for it in items:
        d.ellipse([x, y + 9 * SCALE, x + 9 * SCALE, y + 18 * SCALE], fill=dot_fill)
        d.text((x + 24 * SCALE, y), it, font=bf, fill=(60, 60, 60))
        y += step
    return y


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE
    rightx = (W - 110) * SCALE

    tracked(d, (m, 84 * SCALE), "ADOPTION STRATEGY", sans(20, bold=True), MUTED, 6)
    d.text((m, 128 * SCALE), "Three engines of growth.", font=font(60), fill=FOREST_DEEP)
    d.rectangle([m, 228 * SCALE, rightx, 231 * SCALE], fill=FOREST)

    gap = 70 * SCALE
    total_w = rightx - m
    col_w = (total_w - gap * 2) / 3
    cols = [m + i * (col_w + gap) for i in range(3)]
    cc = [c + col_w / 2 for c in cols]

    head_y = 300 * SCALE
    sub_y = 352 * SCALE
    bul_y = 430 * SCALE

    headers = [
        ("VIRAL INVITES", "every trip pulls in the group"),
        ("CREATORS & SOCIAL", "where Gen Z plans trips"),
        ("DISTRIBUTION PARTNERS", "where organizers already are"),
    ]
    for i, (h, s) in enumerate(headers):
        ctext(d, cc[i], head_y, h, sans(30, bold=True), FOREST_DEEP, tracking=1)
        ctext(d, cc[i], sub_y, s, sans(19), MUTED)

    # ---- Column 1: viral invites + invite widget ----
    bullets(d, [
        "Organizer invites 5\u201315 travelers",
        "Each joins to vote, pay & plan",
        "New travelers start their own trips",
        "K > 1  \u00b7  near-zero CAC",
    ], cols[0] + 6 * SCALE, bul_y, 50 * SCALE, FOREST_MID)

    # invite widget mock
    wx0, wy0 = cols[0] + 30 * SCALE, 660 * SCALE
    wx1, wy1 = cols[0] + col_w - 30 * SCALE, 950 * SCALE
    rounded(d, [wx0, wy0, wx1, wy1], 14 * SCALE, fill=WHITE, outline=BORDER, width=2)
    d.rectangle([wx0, wy0, wx1, wy0 + 52 * SCALE], fill=FOREST_DEEP)
    rounded(d, [wx0, wy0, wx1, wy0 + 60 * SCALE], 14 * SCALE, fill=FOREST_DEEP)
    d.text((wx0 + 22 * SCALE, wy0 + 15 * SCALE), "Nashville \u2014 Bach Trip", font=sans(18, bold=True), fill=WHITE)
    names = [("Maya", "Joined"), ("Sofia", "Joined"), ("Priya", "Joined"), ("Jess", "Invited")]
    ry = wy0 + 86 * SCALE
    for nm, st in names:
        d.ellipse([wx0 + 22 * SCALE, ry, wx0 + 22 * SCALE + 34 * SCALE, ry + 34 * SCALE], fill=FOREST_PALE, outline=FOREST_SOFT, width=2)
        d.text((wx0 + 70 * SCALE, ry + 5 * SCALE), nm, font=sans(17, bold=True), fill=FOREST_DEEP)
        joined = st == "Joined"
        chip = st
        cf = sans(14, bold=True)
        cw = d.textlength(chip, font=cf) + 26 * SCALE
        chx1 = wx1 - 22 * SCALE
        rounded(d, [chx1 - cw, ry + 2 * SCALE, chx1, ry + 32 * SCALE], 15 * SCALE,
                fill=(FOREST_MID if joined else WHITE), outline=FOREST_SOFT, width=0 if joined else 2)
        d.text((chx1 - cw + 13 * SCALE, ry + 8 * SCALE), chip, font=cf, fill=(WHITE if joined else FOREST))
        ry += 48 * SCALE

    # ---- Column 2: creators & social + post mock ----
    bullets(d, [
        "#TravelTok \u2014 billions of views",
        "Bachelorette & wedding creators",
        "Group-trip Reels & TikToks",
        "Creator affiliate codes",
    ], cols[1] + 6 * SCALE, bul_y, 50 * SCALE, FOREST_MID)

    px0, py0 = cols[1] + 60 * SCALE, 660 * SCALE
    px1, py1 = cols[1] + col_w - 60 * SCALE, 950 * SCALE
    rounded(d, [px0, py0, px1, py1], 14 * SCALE, fill=WHITE, outline=BORDER, width=2)
    # top row (avatar + handle)
    d.ellipse([px0 + 18 * SCALE, py0 + 16 * SCALE, px0 + 18 * SCALE + 36 * SCALE, py0 + 16 * SCALE + 36 * SCALE], fill=FOREST_SOFT)
    d.text((px0 + 66 * SCALE, py0 + 20 * SCALE), "@grouptrips", font=sans(16, bold=True), fill=FOREST_DEEP)
    d.text((px0 + 66 * SCALE, py0 + 42 * SCALE), "planned on Avanti", font=sans(13), fill=MUTED)
    # image area
    rounded(d, [px0 + 18 * SCALE, py0 + 72 * SCALE, px1 - 18 * SCALE, py1 - 72 * SCALE], 10 * SCALE, fill=FOREST_PALE)
    ctext(d, (px0 + px1) / 2, (py0 + py1) / 2 - 20 * SCALE, "\u25b6", font(40, bold=True), FOREST_SOFT)
    # caption bars
    d.rounded_rectangle([px0 + 18 * SCALE, py1 - 56 * SCALE, px1 - 60 * SCALE, py1 - 42 * SCALE], radius=6 * SCALE, fill=HAIR)
    d.rounded_rectangle([px0 + 18 * SCALE, py1 - 34 * SCALE, px1 - 110 * SCALE, py1 - 20 * SCALE], radius=6 * SCALE, fill=HAIR)

    # ---- Column 3: distribution partners logos ----
    ctext(d, cc[2], bul_y - 8 * SCALE, "Co-marketing into group-forming moments", sans(17), FAINT)
    partners = ["The Knot", "Zola", "Amex Travel", "Chase Travel", "Eventbrite"]
    ly = bul_y + 40 * SCALE
    lw0, lw1 = cols[2] + 40 * SCALE, cols[2] + col_w - 40 * SCALE
    for p in partners:
        lh = 74 * SCALE
        rounded(d, [lw0, ly, lw1, ly + lh], 12 * SCALE, fill=WHITE, outline=BORDER, width=2)
        ctext(d, cc[2], ly + lh / 2 - 16 * SCALE, p, sans(24, bold=True), FOREST_DEEP)
        ly += lh + 16 * SCALE

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
