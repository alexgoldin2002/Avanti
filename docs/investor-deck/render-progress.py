#!/usr/bin/env python3
"""Render the Progress to Date slide split into Live vs Roadmap in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "progress-preview.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
MUTED = (90, 90, 90)
FAINT = (150, 150, 150)
BORDER = (222, 224, 218)
INK = (50, 50, 50)


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


def tracked_w(d, text, fnt, sp):
    return sum(d.textlength(ch, font=fnt) + sp * SCALE for ch in text) - sp * SCALE


def ctext(d, cx, y, text, fnt, fill, tracking=0):
    if tracking:
        total = tracked_w(d, text, fnt, tracking)
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


def checkmark(d, x, y, s, color):
    d.line([(x, y + s * 0.52), (x + s * 0.38, y + s * 0.9), (x + s, y + s * 0.08)],
           fill=color, width=max(2, int(3 * SCALE)), joint="curve")


def render_column(d, x0, colw, top, title, accent, feats, live):
    """Render a labeled sub-column of feature bullets. Returns bottom y."""
    tf = sans(15, bold=True)
    tracked(d, (x0, top), title, tf, accent, 2.5)
    d.line([(x0, top + 30 * SCALE), (x0 + colw, top + 30 * SCALE)], fill=BORDER, width=2)
    bf = sans(17)
    y = top + 52 * SCALE
    indent = 30 * SCALE
    textw = colw - indent
    for feat in feats:
        if live:
            checkmark(d, x0 + 2 * SCALE, y + 3 * SCALE, 16 * SCALE, accent)
            tcol = INK
        else:
            d.ellipse([x0 + 3 * SCALE, y + 4 * SCALE, x0 + 15 * SCALE, y + 16 * SCALE],
                      outline=accent, width=2)
            tcol = MUTED
        lines = wrap(d, feat, bf, textw)
        for ln in lines:
            d.text((x0 + indent, y), ln, font=bf, fill=tcol)
            y += 28 * SCALE
        y += 16 * SCALE
    return y


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE
    rightx = (W - 110) * SCALE

    tracked(d, (m, 74 * SCALE), "PROGRESS TO DATE", sans(20, bold=True), MUTED, 6)
    d.text((m, 116 * SCALE), "What\u2019s live today \u2014 and what\u2019s next.", font=font(56), fill=FOREST_DEEP)
    d.rectangle([m, 206 * SCALE, rightx, 209 * SCALE], fill=FOREST)

    # ---- two panels ----
    ptop = 250 * SCALE
    pbot = 902 * SCALE
    gap = 46 * SCALE
    panelw = (rightx - m - gap) / 2
    lx0 = m
    lx1 = m + panelw
    rx0 = lx1 + gap
    rx1 = rightx
    pad = 40 * SCALE

    # Left panel: LIVE
    rounded(d, [lx0, ptop, lx1, pbot], 20 * SCALE, fill=FOREST_PALE)
    # Right panel: ROADMAP
    rounded(d, [rx0, ptop, rx1, pbot], 20 * SCALE, fill=WHITE, outline=BORDER, width=2)

    # panel headers
    hy = ptop + pad
    # left header pill
    lhw = 340 * SCALE
    rounded(d, [lx0 + pad, hy, lx0 + pad + lhw, hy + 52 * SCALE], 26 * SCALE, fill=FOREST)
    checkmark(d, lx0 + pad + 26 * SCALE, hy + 18 * SCALE, 18 * SCALE, WHITE)
    d.text((lx0 + pad + 62 * SCALE, hy + 12 * SCALE), "READY TO USE NOW", font=sans(20, bold=True), fill=WHITE)
    d.text((lx0 + pad + lhw + 20 * SCALE, hy + 15 * SCALE), "usable today", font=sans(18), fill=FOREST_SOFT)

    # right header pill
    rhw = 320 * SCALE
    rounded(d, [rx0 + pad, hy, rx0 + pad + rhw, hy + 52 * SCALE], 26 * SCALE, outline=FOREST_SOFT, width=2)
    d.text((rx0 + pad + 26 * SCALE, hy + 12 * SCALE), "ON THE ROADMAP", font=sans(20, bold=True), fill=FOREST_MID)
    d.text((rx0 + pad + rhw + 20 * SCALE, hy + 15 * SCALE), "next up", font=sans(18), fill=FAINT)

    # columns
    coltop = hy + 92 * SCALE
    colgap = 34 * SCALE
    colw = (panelw - 2 * pad - colgap) / 2

    # LIVE data (reorganized by theme; all confirmed live)
    live_a = ("GROUP & COORDINATION", [
        "Invite links & join codes",
        "SMS invites & nudges",
        "Traveler profiles & travel docs",
        "Saved companions across trips",
        "Group date-overlap analysis",
        "Preference questionnaire",
        "Expense splitting & settle-up",
    ])
    live_b = ("DECIDE TOGETHER", [
        "3 planning paths",
        "AI destination cards + matrix",
        "Price + weather per option",
        "Two-round voting (rank \u2192 split)",
        "Per-traveler AI personalization",
        "Phases, deadlines & reveal",
    ])
    render_column(d, lx0 + pad, colw, coltop, live_a[0], FOREST, live_a[1], live=True)
    render_column(d, lx0 + pad + colw + colgap, colw, coltop, live_b[0], FOREST, live_b[1], live=True)

    # ROADMAP data
    road_a = ("BOOK", [
        "AI group flight analysis",
        "Live hotels, activities & dining",
        "Real prices (Duffel/LiteAPI/GYG)",
        "Affiliate booking links",
        "AI day-by-day itinerary",
        "Per-person cost & budget fit",
        "In-app checkout",
    ])
    road_b = ("ON THE GROUND", [
        "Merged daily itineraries",
        "Saved places (TikTok/IG \u2192 plan)",
        "Bookings vault (auto-parse)",
        "Safety & local-app guides",
        "SMS morning/evening briefings",
    ])
    render_column(d, rx0 + pad, colw, coltop, road_a[0], FOREST_SOFT, road_a[1], live=False)
    render_column(d, rx0 + pad + colw + colgap, colw, coltop, road_b[0], FOREST_SOFT, road_b[1], live=False)

    # ---- footer: platform strip ----
    ctext(d, (m + rightx) / 2, 942 * SCALE, "PLATFORM & INTEGRATIONS", sans(14, bold=True), FOREST_SOFT, tracking=3)
    integ = "Anthropic Claude   \u00b7   Supabase   \u00b7   Duffel   \u00b7   LiteAPI   \u00b7   GetYourGuide   \u00b7   Twilio SMS   \u00b7   Google Places"
    ctext(d, (m + rightx) / 2, 976 * SCALE, integ, sans(18, bold=True), FOREST_DEEP)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
