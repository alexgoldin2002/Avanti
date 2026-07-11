#!/usr/bin/env python3
"""Create on-brand placeholder screenshots when live captures aren't available."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screenshots"

CREAM = (252, 249, 244)
FOREST_DEEP = (31, 51, 41)
FOREST = (42, 69, 56)
FOREST_PALE = (232, 245, 238)
MUTED = (106, 106, 106)
BORDER = (224, 224, 216)

W, H = 1280, 800

SCREENS = [
    ("brainstorm.png", "Brainstorm & Compare", "Destination matrix · Budget / Mid / Luxury tiers"),
    ("voting.png", "Decide Together", "Structured voting · Feasibility gates · Async windows"),
    ("gametime.png", "Game Time", "Itinerary · Bookings vault · Briefings · Expenses"),
]


def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_screen(filename, title, subtitle):
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 72], fill=FOREST_DEEP)
    draw.text((40, 22), "AVANTI", fill=CREAM, font=load_font(28))

    draw.rectangle([40, 110, W - 40, H - 40], outline=BORDER, width=2, fill=FOREST_PALE)
    draw.text((72, 150), title, fill=FOREST_DEEP, font=load_font(42, bold=True))
    draw.text((72, 210), subtitle, fill=MUTED, font=load_font(22))

    for i, label in enumerate(["Option A", "Option B", "Option C"]):
        y = 300 + i * 120
        draw.rectangle([72, y, W - 120, y + 88], outline=BORDER, width=1, fill=CREAM)
        draw.text((96, y + 28), label, fill=FOREST, font=load_font(24))

    img.save(OUT / filename, "PNG")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for fname, title, subtitle in SCREENS:
        draw_screen(fname, title, subtitle)
        print(f"Wrote {OUT / fname}")


if __name__ == "__main__":
    main()
