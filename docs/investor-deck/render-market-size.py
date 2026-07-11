#!/usr/bin/env python3
"""Render the Market Size funnel slide as a PNG in the Avanti brand palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "market-size-preview.png"

# 16:9 canvas
W, H = 1920, 1080
SCALE = 2  # supersample for crisp text

# Brand palette (from app/globals.css, exact nav-bar green)
WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)     # #0B2010 nav bar
FOREST = (31, 58, 37)          # #1F3A25
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
MUTED = (106, 106, 106)
BORDER = (224, 224, 216)


def font(size, bold=False):
    paths = [
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/Library/Fonts/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
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
        "/Library/Fonts/Arial.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size * SCALE)
        except OSError:
            continue
    return ImageFont.load_default()


def tracked(draw, xy, text, fnt, fill, spacing_px, anchor_left=True):
    """Draw text with extra letter-spacing (for eyebrow caps)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        w = draw.textlength(ch, font=fnt)
        x += w + spacing_px * SCALE


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)

    m = 110 * SCALE  # left margin

    # Eyebrow
    tracked(d, (m, 90 * SCALE), "MARKET SIZE", sans(20, bold=True), MUTED, 6)

    # Headline
    d.text((m, 135 * SCALE), "A massive, growing market.", font=font(66), fill=FOREST_DEEP)

    # Divider
    d.rectangle([m, 245 * SCALE, (W - 110) * SCALE, 248 * SCALE], fill=FOREST)

    # Funnel geometry (left side), text panel (right side)
    tiers = [
        ("TAM", "$713B", "Global online travel (2025) \u2192 apx. $1.4T by 2035, 7.4% CAGR", FOREST_DEEP, 1.00),
        ("SAM", "apx. $187B", "US group travel market (2025), apx. 6.8% CAGR", FOREST_MID, 0.66),
        ("SOM", "Beachhead", "Affluent US Millennial & Gen Z group travelers", FOREST_SOFT, 0.34),
    ]

    fx_center = 560 * SCALE
    top = 330 * SCALE
    tier_h = 200 * SCALE
    gap = 24 * SCALE
    max_half = 430 * SCALE
    min_half = 150 * SCALE

    y = top
    for i, (label, fig, desc, color, frac) in enumerate(tiers):
        top_frac = 1.0 - i * 0.34
        bot_frac = 1.0 - (i + 1) * 0.34
        half_top = min_half + (max_half - min_half) * top_frac
        half_bot = min_half + (max_half - min_half) * bot_frac
        pts = [
            (fx_center - half_top, y),
            (fx_center + half_top, y),
            (fx_center + half_bot, y + tier_h),
            (fx_center - half_bot, y + tier_h),
        ]
        d.polygon(pts, fill=color)

        # Label (centered, tracked) + figure centered in trapezoid
        lf = sans(20, bold=True)
        label_w = sum(d.textlength(ch, font=lf) + 4 * SCALE for ch in label) - 4 * SCALE
        tracked(d, (fx_center - label_w / 2, y + 40 * SCALE), label, lf, (255, 255, 255), 4)
        figf = font(52, bold=True)
        fw = d.textlength(fig, font=figf)
        d.text((fx_center - fw / 2, y + 92 * SCALE), fig, font=figf, fill=(255, 255, 255))
        y += tier_h + gap

    # Right-side descriptions aligned to tiers
    rx = 1130 * SCALE
    ry = top
    for label, fig, desc, color, frac in tiers:
        dot = 14 * SCALE
        d.ellipse([rx, ry + 20 * SCALE, rx + dot, ry + 20 * SCALE + dot], fill=color)
        d.text((rx + 34 * SCALE, ry + 8 * SCALE), f"{label} \u2014 {fig}", font=font(38, bold=True), fill=FOREST_DEEP)
        # wrap description
        words = desc.split()
        line, lines = "", []
        wf = sans(22)
        maxw = 620 * SCALE
        for w in words:
            test = (line + " " + w).strip()
            if d.textlength(test, font=wf) > maxw:
                lines.append(line)
                line = w
            else:
                line = test
        lines.append(line)
        ty = ry + 62 * SCALE
        for ln in lines:
            d.text((rx + 34 * SCALE, ty), ln, font=wf, fill=MUTED)
            ty += 34 * SCALE
        ry += tier_h + gap

    # Growth callout — labels then an upward arrow, in clear bottom-right space
    gx = 1164 * SCALE
    d.text((gx, 892 * SCALE), "$713B \u2192 apx. $1.4T by 2035", font=sans(22, bold=True), fill=FOREST_DEEP)
    d.text((gx, 928 * SCALE), "Both markets compounding 7%+ annually", font=sans(18), fill=MUTED)
    # upward arrow beneath the labels
    ax0, ay0 = gx, 1002 * SCALE           # tail (bottom-left)
    ax1, ay1 = 1610 * SCALE, 968 * SCALE  # head (top-right)
    d.line([ax0, ay0, ax1, ay1], fill=FOREST, width=8 * SCALE)
    import math
    ang = math.atan2(ay1 - ay0, ax1 - ax0)
    ah = 30 * SCALE
    for da in (math.radians(150), math.radians(-150)):
        hx = ax1 + ah * math.cos(ang + da)
        hy = ay1 + ah * math.sin(ang + da)
        d.line([ax1, ay1, hx, hy], fill=FOREST, width=8 * SCALE)

    # Footer note
    d.text((m, (H - 60) * SCALE), "SOM finalized bottom-up after business model  ·  Sources: Precedence Research, Emergen Research",
            font=sans(18), fill=MUTED)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
