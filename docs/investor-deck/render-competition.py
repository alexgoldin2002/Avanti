#!/usr/bin/env python3
"""Render the Competition slide (2x2 positioning map) in the Avanti palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "competition-preview.png"

W, H = 1920, 1080
SCALE = 2

WHITE = (255, 255, 255)
FOREST_DEEP = (11, 32, 16)
FOREST = (31, 58, 37)
FOREST_MID = (54, 92, 66)
FOREST_SOFT = (92, 128, 104)
FOREST_PALE = (232, 245, 238)
TINT = (244, 250, 247)
MUTED = (106, 106, 106)
FAINT = (150, 150, 150)
AXIS = (170, 172, 165)
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


def main():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    d = ImageDraw.Draw(img)
    m = 110 * SCALE

    tracked(d, (m, 74 * SCALE), "COMPETITIVE LANDSCAPE", sans(20, bold=True), MUTED, 6)
    d.text((m, 116 * SCALE), "Everyone solves a slice. Avanti runs the whole trip.", font=font(54), fill=FOREST_DEEP)
    d.rectangle([m, 206 * SCALE, (W - 110) * SCALE, 209 * SCALE], fill=FOREST)

    # plot box
    px_l, px_r = 320 * SCALE, 1600 * SCALE
    py_t, py_b = 300 * SCALE, 930 * SCALE
    cx = (px_l + px_r) / 2
    cy = (py_t + py_b) / 2
    hw = (px_r - px_l) / 2
    hh = (py_b - py_t) / 2

    def mx(x):
        return cx + x * hw

    def my(y):
        return cy - y * hh

    # highlight top-right quadrant
    d.rectangle([cx, py_t, px_r, cy], fill=TINT)
    tracked(d, (cx + 30 * SCALE, py_t + 22 * SCALE), "WHERE GROUP TRAVEL IS WON", sans(15, bold=True), FOREST_SOFT, 3)

    # axes
    d.line([(px_l, cy), (px_r, cy)], fill=AXIS, width=3 * SCALE)
    d.line([(cx, py_t), (cx, py_b)], fill=AXIS, width=3 * SCALE)
    a = 12 * SCALE
    d.polygon([(px_r + a, cy), (px_r - a, cy - a * 0.7), (px_r - a, cy + a * 0.7)], fill=AXIS)  # right
    d.polygon([(px_l - a, cy), (px_l + a, cy - a * 0.7), (px_l + a, cy + a * 0.7)], fill=AXIS)  # left
    d.polygon([(cx, py_t - a), (cx - a * 0.7, py_t + a), (cx + a * 0.7, py_t + a)], fill=AXIS)  # up
    d.polygon([(cx, py_b + a), (cx - a * 0.7, py_b - a), (cx + a * 0.7, py_b - a)], fill=AXIS)  # down

    # axis end labels
    ctext(d, cx, py_t - 46 * SCALE, "END-TO-END", sans(19, bold=True), FOREST_DEEP)
    ctext(d, cx, py_t - 22 * SCALE, "decide \u00b7 book \u00b7 on the ground", sans(14), MUTED)
    ctext(d, cx, py_b + 22 * SCALE, "POINT TOOL / MANUAL", sans(19, bold=True), FOREST_DEEP)
    lbl = "SOLO"
    d.text((px_l - 16 * SCALE - d.textlength(lbl, font=sans(19, bold=True)), cy - 44 * SCALE), lbl, font=sans(19, bold=True), fill=FOREST_DEEP)
    d.text((px_l - 16 * SCALE - d.textlength("single-player", font=sans(14)), cy - 18 * SCALE), "single-player", font=sans(14), fill=MUTED)
    d.text((px_r + 18 * SCALE, cy - 44 * SCALE), "GROUP-NATIVE", font=sans(19, bold=True), fill=FOREST_DEEP)
    d.text((px_r + 18 * SCALE, cy - 18 * SCALE), "multiplayer", font=sans(14), fill=MUTED)

    # competitors: (name, subtitle, x, y, dot)
    comps = [
        ("Group chat \u00b7 Spreadsheets", "the status quo", 0.82, -0.80, FAINT),
        ("Splitwise", "expenses only", 0.80, -0.30, FOREST_SOFT),
        ("Troupe \u00b7 TripRelay \u00b7 Wandroo", "decide / vote only", 0.60, -0.02, FOREST_MID),
        ("Wanderlog \u00b7 FlowTrip \u00b7 AvoSquado", "collaborative itinerary", 0.20, 0.20, FOREST_MID),
        ("Contiki \u00b7 G Adventures", "packaged group tours", 0.60, 0.16, FOREST_MID),
        ("Batch", "celebrations only \u00b7 no flights", 0.54, 0.42, FOREST_MID),
        ("Navan \u00b7 TravelPerk", "B2B travel mgmt", 0.30, 0.62, FOREST_SOFT),
        ("Tourlane \u00b7 tailor-made agencies", "human concierge, end-to-end", -0.12, 0.68, FOREST_SOFT),
        ("Mindtrip \u00b7 Layla \u00b7 Odessia", "solo AI: plan + book", -0.55, 0.50, FOREST_SOFT),
        ("Tripadvisor", "reviews + AI planner", -0.16, 0.32, FOREST_SOFT),
        ("Wonderplan \u00b7 Roam Around", "purpose-built AI planners", -0.66, 0.14, FOREST_SOFT),
        ("ChatGPT \u00b7 Gemini \u00b7 Claude", "general AI assistants", -0.83, -0.16, FAINT),
        ("Google", "Travel \u00b7 Maps \u00b7 Gemini", -0.22, -0.30, FAINT),
        ("TripIt \u00b7 Tineo", "solo organizer", -0.68, -0.46, FOREST_SOFT),
        ("OTAs & booking apps", "Expedia \u00b7 Booking \u00b7 Airbnb \u00b7 Hopper \u00b7 Kayak", -0.40, -0.68, FOREST_SOFT),
    ]
    for name, sub, x, y, dot in comps:
        px, py = mx(x), my(y)
        nf = sans(17, bold=True)
        sf = sans(13)
        nw = d.textlength(name, font=nf)
        sw = d.textlength(sub, font=sf)
        bw = max(nw, sw) + 40 * SCALE
        bh = 66 * SCALE
        rounded(d, [px - bw / 2, py - bh / 2, px + bw / 2, py + bh / 2], 12 * SCALE, fill=WHITE, outline=BORDER, width=2)
        d.ellipse([px - bw / 2 + 14 * SCALE, py - 7 * SCALE, px - bw / 2 + 14 * SCALE + 12 * SCALE, py + 5 * SCALE], fill=dot)
        ctext(d, px + 8 * SCALE, py - 20 * SCALE, name, nf, FOREST_DEEP)
        ctext(d, px + 8 * SCALE, py + 6 * SCALE, sub, sf, MUTED)

    # Avanti hero chip
    ax, ay = mx(0.74), my(0.80)
    aw, ah = 220 * SCALE, 90 * SCALE
    rounded(d, [ax - aw / 2, ay - ah / 2, ax + aw / 2, ay + ah / 2], 16 * SCALE, fill=FOREST_DEEP)
    ctext(d, ax, ay - 30 * SCALE, "Avanti", font(34, bold=True), WHITE)
    ctext(d, ax, ay + 18 * SCALE, "group-native \u00b7 end-to-end \u00b7 AI", sans(14, bold=True), FOREST_PALE)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
