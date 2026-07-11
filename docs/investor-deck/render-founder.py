#!/usr/bin/env python3
"""Render the Founder slide (solo, personal / founder-market fit) in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "founder-preview.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
MUTED = (96, 96, 96)
PLACEHOLDER = (150, 158, 150)
FAINT = (150, 150, 150)
BORDER = (222, 224, 218)


def font(size, bold=False, italic=False):
    if italic:
        name = "Georgia Bold Italic.ttf" if bold else "Georgia Italic.ttf"
    else:
        name = "Georgia Bold.ttf" if bold else "Georgia.ttf"
    for p in [f"/System/Library/Fonts/Supplemental/{name}", "/Library/Fonts/Georgia.ttf"]:
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


def ctext(d, cx, y, text, fnt, fill):
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


def para(d, text, x, y, fnt, fill, maxw, step):
    for ln in wrap(d, text, fnt, maxw):
        d.text((x, y), ln, font=fnt, fill=fill)
        y += step
    return y


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE
    rightx = (W - 110) * SCALE

    tracked(d, (m, 84 * SCALE), "FOUNDER", sans(20, bold=True), MUTED, 6)
    d.text((m, 128 * SCALE), "Who's building Avanti.", font=font(60), fill=FOREST_DEEP)
    d.rectangle([m, 228 * SCALE, rightx, 231 * SCALE], fill=FOREST)

    # ---- photo placeholder ----
    pw, ph = 430 * SCALE, 520 * SCALE
    px, py = m, 300 * SCALE
    rounded(d, [px, py, px + pw, py + ph], 20 * SCALE, fill=FOREST_PALE, outline=BORDER, width=2)
    # silhouette
    scx = px + pw / 2
    hr = 76 * SCALE
    hcy = py + 200 * SCALE
    d.ellipse([scx - hr, hcy - hr, scx + hr, hcy + hr], fill=FOREST_SOFT)
    d.pieslice([scx - 150 * SCALE, hcy + 40 * SCALE, scx + 150 * SCALE, hcy + 340 * SCALE], 180, 360, fill=FOREST_SOFT)
    ctext(d, scx, py + ph - 70 * SCALE, "ADD PHOTO", sans(16, bold=True), FOREST_SOFT)

    # ---- right column ----
    cx = px + pw + 70 * SCALE
    colw = rightx - cx

    d.text((cx, 300 * SCALE), "Alexandra Goldin", font=font(56, bold=True), fill=FOREST_DEEP)
    d.text((cx, 372 * SCALE), "Founder & CEO", font=sans(22, bold=True), fill=FOREST_MID)
    # LinkedIn
    linkedin = "linkedin.com/in/alexandra-goldin"  # TODO: replace with exact URL
    d.text((cx, 410 * SCALE), linkedin, font=sans(18, bold=True), fill=FOREST_SOFT)
    d.line([(cx, 452 * SCALE), (rightx, 452 * SCALE)], fill=BORDER, width=2)

    tracked(d, (cx, 480 * SCALE), "WHO I AM", sans(16, bold=True), FOREST_SOFT, 3)
    # (intentionally left blank)

    tracked(d, (cx, 640 * SCALE), "WHY AVANTI", sans(16, bold=True), FOREST_SOFT, 3)
    # (intentionally left blank)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
